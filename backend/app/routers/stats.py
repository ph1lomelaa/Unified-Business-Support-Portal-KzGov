"""Home page hero stats (spec 6.1) — one small config+aggregate endpoint so
the frontend never hardcodes numbers that drift from the actual catalog.

Two figures are real DB aggregates (published services, organizations).
Two are computed from the flagship service's live schema (field count) or
kept as an explicit, documented backend constant (paper-form baseline) —
that baseline is inherently not derivable from our own data (it describes
the offline process ЕППБ replaces), so it lives here as a single named
constant instead of a magic string in frontend JSX.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import FormSchema, Organization, Service
from ..schema_stages import split_schema_by_stage

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])

# Illustrative baseline for "N полей вместо M": a typical paper-based
# application to a subsidiary before ЕППБ. Not computable from our data —
# the whole point of the constructor is that this baseline no longer exists.
PAPER_FORM_FIELDS_BASELINE = 45
FLAGSHIP_SERVICE_SLUG = "akk-animal"


def _walk(elements: list[dict] | None):
    for el in elements or []:
        if el.get("type") == "panel":
            yield from _walk(el.get("elements"))
        else:
            yield el


def _stage1_field_count(schema: dict | None) -> int | None:
    if not schema:
        return None
    stage1_pages, _ = split_schema_by_stage(schema)
    count = 0
    for page in stage1_pages:
        for el in _walk(page.get("elements")):
            if el.get("type") not in ("html", "expression"):
                count += 1
    return count or None


@router.get("")
def get_stats(db: Session = Depends(get_session)):
    published_services = db.exec(
        select(func.count()).select_from(Service).where(Service.status == "published")
    ).one()
    organizations = db.exec(select(func.count()).select_from(Organization)).one()
    avg_review_days = db.exec(
        select(func.avg(Service.reviewDays)).where(Service.status == "published")
    ).one()

    flagship_fields = None
    flagship = db.exec(select(Service).where(Service.slug == FLAGSHIP_SERVICE_SLUG)).first()
    if flagship:
        active_form = db.exec(
            select(FormSchema)
            .where(FormSchema.serviceId == flagship.id, FormSchema.isActive == True)  # noqa: E712
            .order_by(FormSchema.version.desc())
        ).first()
        if active_form:
            flagship_fields = _stage1_field_count(active_form.schema)

    return {
        "publishedServices": published_services,
        "organizations": organizations,
        "avgReviewDays": round(avg_review_days) if avg_review_days else None,
        "flagshipFieldCount": flagship_fields,
        "paperFormFieldsBaseline": PAPER_FORM_FIELDS_BASELINE,
    }
