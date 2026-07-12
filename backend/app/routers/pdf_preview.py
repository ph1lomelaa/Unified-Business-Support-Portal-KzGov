"""On-the-fly PDF previews: wizard step 5 (real answers) and the admin
doc-template tab (sample answers). No persistence."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..calc_eval import FormulaError, compute_schema_expressions
from ..models import Company, FormSchema, Organization, Service
from ..pdf.generator import render_application_pdf
from ..session import require_role

router = APIRouter(prefix="/api/v1", tags=["pdf"])


class PreviewBody(BaseModel):
    answers: dict = {}
    calc: dict = {}
    bin: str | None = None


def _pdf(pdf: bytes) -> Response:
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="preview.pdf"'},
    )


@router.post("/services/{slug}/preview-pdf")
def preview_pdf(slug: str, body: PreviewBody, db: Session = Depends(get_session)):
    service = db.exec(
        select(Service).where(Service.slug == slug, Service.status == "published")
    ).first()
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    org = db.get(Organization, service.orgId)
    company = db.get(Company, body.bin) if body.bin else None
    active = db.exec(
        select(FormSchema).where(
            FormSchema.serviceId == service.id, FormSchema.isActive == True  # noqa: E712
        )
    ).first()
    try:
        calc = compute_schema_expressions(active.schema if active else {}, body.answers)
    except FormulaError as exc:
        raise HTTPException(422, f"Ошибка автоматического расчёта: {exc}") from exc
    pdf = render_application_pdf(
        app_number="EPPB-2026-000124",
        app_date=None,
        service_title=service.title,
        org_name=org.name if org else "",
        company=_company_or_placeholder(company),
        answers=body.answers,
        calc=calc,
        doc_template=service.docTemplate,
    )
    return _pdf(pdf)


@router.post("/admin/services/{service_id}/test-pdf")
def test_pdf(
    service_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    if user.role == "analyst" and user.orgId != service.orgId:
        raise HTTPException(403, "Недостаточно прав для услуги другой организации")
    org = db.get(Organization, service.orgId)
    schema = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id)
        .order_by(FormSchema.version.desc())
    ).first()
    schema_payload = schema.schema if schema else {}
    answers, _legacy_calc = _sample_values(schema_payload)
    try:
        calc = compute_schema_expressions(schema_payload, answers)
    except FormulaError:
        calc = {}
    pdf = render_application_pdf(
        app_number="EPPB-2026-000000",
        app_date=None,
        service_title=service.title,
        org_name=org.name if org else "",
        company={
            "name": "ТОО «Образец»", "bin": "123456789012",
            "director": "Тестов Тест Тестович",
            "address": "г. Астана, пр. Мәңгілік Ел, 1", "region": "г. Астана",
        },
        answers=answers,
        calc=calc,
        doc_template=service.docTemplate,
    )
    return _pdf(pdf)


def _company_or_placeholder(c: Company | None) -> dict:
    if c:
        return {
            "name": c.name, "bin": c.bin, "director": c.director,
            "address": c.address, "region": c.region,
        }
    return {
        "name": "ТОО «Образец»", "bin": "—", "director": "—",
        "address": "—", "region": "—",
    }


def _sample_values(schema: dict) -> tuple[dict, dict]:
    answers: dict = {}
    calc: dict = {}

    def walk(els):
        for el in els or []:
            t = el.get("type")
            name = el.get("name")
            if t == "panel":
                walk(el.get("elements"))
                continue
            if not name:
                continue
            if t == "number":
                answers[name] = int(el.get("defaultValue") or 1000000)
            elif t == "expression":
                calc[name] = 0
            elif t in ("dropdown", "radiogroup"):
                ch = el.get("choices") or []
                first = ch[0] if ch else "образец"
                answers[name] = first.get("value") if isinstance(first, dict) else first
            elif t == "boolean":
                answers[name] = True
            else:
                answers[name] = "образец"

    for page in schema.get("pages", []):
        walk(page.get("elements"))
    return answers, calc
