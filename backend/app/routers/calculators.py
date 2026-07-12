"""Public API for interactive calculators (Фаза 4.2).

The formula stays server-side and is evaluated with the safe AST evaluator
(`calc_eval`) — the client sends input values and gets a number back. This makes
calculators a real tool, not static text, and lets admins author new ones (лизинг,
субсидия, кредит, ...) without code.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..calc_eval import FormulaError, evaluate
from ..db import get_session
from ..models import Calculator

router = APIRouter(prefix="/api/v1/calculators", tags=["calculators"])


def _public_dto(c: Calculator) -> dict:
    # Formula intentionally omitted — computation is server-side only.
    return {
        "slug": c.slug,
        "title": c.title,
        "summary": c.summary,
        "inputs": c.inputs,
        "resultLabel": c.resultLabel,
        "resultSuffix": c.resultSuffix,
        "currency": c.currency,
        "note": c.note,
        "relatedServiceSlugs": c.relatedServiceSlugs,
    }


def _defaults(c: Calculator) -> dict[str, float]:
    out: dict[str, float] = {}
    for field in c.inputs or []:
        if isinstance(field, dict) and field.get("name") is not None:
            try:
                out[str(field["name"])] = float(field.get("default", 0) or 0)
            except (TypeError, ValueError):
                out[str(field["name"])] = 0.0
    return out


@router.get("")
def list_calculators(db: Session = Depends(get_session)):
    rows = db.exec(select(Calculator).where(Calculator.status == "published")).all()
    return [
        {"slug": c.slug, "title": c.title, "summary": c.summary}
        for c in sorted(rows, key=lambda c: c.title)
    ]


@router.get("/{slug}")
def get_calculator(slug: str, db: Session = Depends(get_session)):
    c = db.exec(select(Calculator).where(Calculator.slug == slug)).first()
    if not c or c.status != "published":
        raise HTTPException(404, "Калькулятор не найден")
    return _public_dto(c)


class ComputeBody(BaseModel):
    values: dict[str, float] = {}


@router.post("/{slug}/compute")
def compute(slug: str, body: ComputeBody, db: Session = Depends(get_session)):
    c = db.exec(select(Calculator).where(Calculator.slug == slug)).first()
    if not c or c.status != "published":
        raise HTTPException(404, "Калькулятор не найден")
    variables = _defaults(c)
    for key, value in (body.values or {}).items():
        try:
            variables[str(key)] = float(value)
        except (TypeError, ValueError):
            continue
    try:
        result = evaluate(c.formula, variables)
    except FormulaError as exc:
        raise HTTPException(422, f"Ошибка расчёта: {exc}") from exc
    return {"result": result, "resultSuffix": c.resultSuffix, "currency": c.currency}
