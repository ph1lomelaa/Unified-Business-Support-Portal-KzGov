"""Admin CRUD for interactive calculators (Фаза 4.2).

The formula is validated on save (dry-run over input defaults with the safe
evaluator), so a broken calculator can't be published. `POST /preview` computes
a result for arbitrary values without saving — the admin sees it live.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..calc_eval import FormulaError, evaluate
from ..db import get_session
from ..models import Calculator, utcnow
from ..session import require_role
from ..slugify import slugify

router = APIRouter(
    prefix="/api/v1/admin/calculators",
    tags=["admin-calculators"],
    dependencies=[Depends(require_role("admin"))],
)


def _dto(c: Calculator) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "title": c.title,
        "summary": c.summary,
        "inputs": c.inputs,
        "formula": c.formula,
        "resultLabel": c.resultLabel,
        "resultSuffix": c.resultSuffix,
        "currency": c.currency,
        "note": c.note,
        "relatedServiceSlugs": c.relatedServiceSlugs,
        "status": c.status,
    }


def _defaults(inputs: list) -> dict[str, float]:
    out: dict[str, float] = {}
    for field in inputs or []:
        if isinstance(field, dict) and field.get("name") is not None:
            try:
                out[str(field["name"])] = float(field.get("default", 0) or 0)
            except (TypeError, ValueError):
                out[str(field["name"])] = 0.0
    return out


def _validate_formula(formula: str, inputs: list) -> None:
    try:
        evaluate(formula, _defaults(inputs))
    except FormulaError as exc:
        raise HTTPException(400, f"Формула не проходит проверку: {exc}") from exc


@router.get("")
def list_calculators(db: Session = Depends(get_session)):
    rows = db.exec(select(Calculator)).all()
    return [_dto(c) for c in sorted(rows, key=lambda c: c.title)]


class CalculatorBody(BaseModel):
    slug: str | None = None
    title: str | None = None
    summary: str | None = None
    inputs: list | None = None
    formula: str | None = None
    resultLabel: str | None = None
    resultSuffix: str | None = None
    currency: bool | None = None
    note: str | None = None
    relatedServiceSlugs: list | None = None
    status: str | None = None


@router.post("", status_code=201)
def create_calculator(body: CalculatorBody, db: Session = Depends(get_session)):
    if not body.title:
        raise HTTPException(400, "title обязателен")
    slug = slugify(body.slug or body.title)
    if db.exec(select(Calculator).where(Calculator.slug == slug)).first():
        raise HTTPException(409, f"Калькулятор '{slug}' уже существует")
    data = body.model_dump(exclude_none=True)
    data["slug"] = slug
    _validate_formula(data.get("formula", ""), data.get("inputs", []))
    calc = Calculator(**data)
    db.add(calc)
    db.commit()
    db.refresh(calc)
    return _dto(calc)


@router.patch("/{calc_id}")
def update_calculator(calc_id: str, body: CalculatorBody, db: Session = Depends(get_session)):
    calc = db.get(Calculator, calc_id)
    if not calc:
        raise HTTPException(404, "Калькулятор не найден")
    data = body.model_dump(exclude_none=True, exclude={"slug"})
    new_formula = data.get("formula", calc.formula)
    new_inputs = data.get("inputs", calc.inputs)
    _validate_formula(new_formula, new_inputs)
    for key, value in data.items():
        setattr(calc, key, value)
    calc.updatedAt = utcnow()
    db.add(calc)
    db.commit()
    db.refresh(calc)
    return _dto(calc)


@router.delete("/{calc_id}", status_code=204)
def delete_calculator(calc_id: str, db: Session = Depends(get_session)):
    calc = db.get(Calculator, calc_id)
    if not calc:
        raise HTTPException(404, "Калькулятор не найден")
    db.delete(calc)
    db.commit()


class PreviewBody(BaseModel):
    formula: str
    inputs: list = []
    values: dict[str, float] = {}


@router.post("/preview")
def preview(body: PreviewBody):
    """Compute a result for the given formula/values without saving."""
    variables = _defaults(body.inputs)
    for key, value in (body.values or {}).items():
        try:
            variables[str(key)] = float(value)
        except (TypeError, ValueError):
            continue
    try:
        result = evaluate(body.formula, variables)
    except FormulaError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"result": result}
