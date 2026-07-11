"""Public catalog read endpoints (spec Часть 4.2–4.3).

Admin/constructor write endpoints live in routers/admin_services.py (M1).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..models import FormSchema, Organization, Service

router = APIRouter(prefix="/api/v1/services", tags=["services"])


def org_brief(org: Organization | None) -> dict | None:
    if not org:
        return None
    return {
        "id": org.id,
        "name": org.name,
        "shortName": org.shortName,
        "color": org.color,
        "logo": org.logo or None,
    }


def service_card(s: Service, org: Organization | None) -> dict:
    return {
        "id": s.id,
        "slug": s.slug,
        "title": s.title,
        "category": s.category,
        "summary": s.summary,
        "conditions": s.conditions,
        "reviewDays": s.reviewDays,
        "tags": s.tags,
        "status": s.status,
        "org": org_brief(org),
    }


def service_full(s: Service, org: Organization | None, form: dict | None) -> dict:
    return {
        **service_card(s, org),
        "description": s.description,
        "documents": s.documents,
        "materials": s.materials,
        "eligibility": s.eligibility,
        "faq": s.faq,
        "docTemplate": s.docTemplate,
        "form": form,
    }


CATEGORIES = ["credit", "subsidy", "guarantee", "leasing", "insurance", "investment"]


def _base_rows(db: Session, org: str | None, include_drafts: bool):
    stmt = select(Service, Organization).join(
        Organization, Service.orgId == Organization.id, isouter=True
    )
    if not include_drafts:
        stmt = stmt.where(Service.status == "published")
    if org:
        stmt = stmt.where(Service.orgId == org)
    return db.exec(stmt).all()


def _matches_tags(
    s: Service,
    bizSize: str | None,
    industry: str | None,
    region: str | None,
    q: str | None,
) -> bool:
    tags = s.tags or {}
    if bizSize and bizSize not in (tags.get("bizSize") or []):
        return False
    if industry and industry not in (tags.get("industries") or []):
        return False
    # A service with no regions listed is offered nationwide — it should not
    # disappear just because the applicant picked a specific region.
    regions = tags.get("regions") or []
    if region and regions and region not in regions:
        return False
    if q:
        hay = f"{s.title} {s.summary} {s.description}".lower()
        if q.lower() not in hay:
            return False
    return True


@router.get("")
def list_services(
    db: Session = Depends(get_session),
    category: str | None = Query(None),
    org: str | None = Query(None),
    bizSize: str | None = Query(None),
    industry: str | None = Query(None),
    region: str | None = Query(None),
    q: str | None = Query(None),
    include_drafts: bool = Query(False),
):
    rows = _base_rows(db, org, include_drafts)
    if category:
        rows = [(s, o) for (s, o) in rows if s.category == category]
    result = [
        service_card(s, o)
        for (s, o) in rows
        if _matches_tags(s, bizSize, industry, region, q)
    ]
    result.sort(key=lambda r: r["title"])
    return result


@router.get("/facets")
def service_facets(
    db: Session = Depends(get_session),
    org: str | None = Query(None),
    bizSize: str | None = Query(None),
    industry: str | None = Query(None),
    region: str | None = Query(None),
    q: str | None = Query(None),
    include_drafts: bool = Query(False),
):
    """Category counts for the current filter set (category itself excluded,
    so tab badges show 'what you'd get if you picked this tab')."""
    rows = _base_rows(db, org, include_drafts)
    matched = [s for (s, _) in rows if _matches_tags(s, bizSize, industry, region, q)]
    byCategory = {c: 0 for c in CATEGORIES}
    for s in matched:
        if s.category in byCategory:
            byCategory[s.category] += 1
    return {"all": len(matched), "byCategory": byCategory}


@router.get("/{slug}")
def get_service(slug: str, db: Session = Depends(get_session)):
    row = db.exec(
        select(Service, Organization)
        .join(Organization, Service.orgId == Organization.id, isouter=True)
        .where(Service.slug == slug)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    service, org = row
    active = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service.id, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()
    form = active.schema if active else None
    return service_full(service, org, form)
