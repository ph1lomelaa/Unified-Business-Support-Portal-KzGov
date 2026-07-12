"""Карта профинансированных проектов (REQ-19, Фаза 4.3).

Проекты читаются из таблицы Project (раньше — генерились в map_data), поэтому
карта редактируется в админке без кода. Регионы/центры/MSB-контекст остаются
справочными константами map_data. Виджет распределения по регионам (ТЗ 6.8) —
это агрегат `regions` (count/amount/jobs/topIndustries).
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..map_data import INDUSTRIES, MSB_CONTEXT, ORGS, REGIONS
from ..models import Project

router = APIRouter(prefix="/api/v1/map", tags=["map"])

_ORG_SHORT = dict(ORGS)
_REGION_NAME = {r["id"]: r["name"] for r in REGIONS}


def _project_dto(p: Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "orgId": p.orgId,
        "org": _ORG_SHORT.get(p.orgId, p.orgId),
        "region": _REGION_NAME.get(p.regionId, p.regionId),
        "regionId": p.regionId,
        "city": p.city,
        "industry": p.industry,
        "status": p.status,
        "year": p.year,
        "amount": p.amount,
        "jobs": p.jobs,
        "lat": p.lat,
        "lon": p.lon,
        "description": p.description,
        "url": p.url,
    }


@router.get("/regions")
def regions():
    return [{"id": r["id"], "name": r["name"]} for r in REGIONS]


@router.get("/projects")
def projects(
    org: str | None = None,
    region: str | None = None,
    industry: str | None = None,
    year: int | None = None,
    yearFrom: int | None = None,
    yearTo: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_session),
):
    stmt = select(Project)
    if org:
        stmt = stmt.where(Project.orgId == org)
    if region:
        stmt = stmt.where(Project.regionId == region)
    if industry:
        stmt = stmt.where(Project.industry == industry)
    if year:
        stmt = stmt.where(Project.year == year)
    if yearFrom:
        stmt = stmt.where(Project.year >= yearFrom)
    if yearTo:
        stmt = stmt.where(Project.year <= yearTo)
    if status:
        stmt = stmt.where(Project.status == status)
    rows = db.exec(stmt).all()
    projects = [_project_dto(p) for p in rows]

    summary = []
    for reg in REGIONS:
        items = [p for p in projects if p["regionId"] == reg["id"]]
        top: dict[str, int] = {}
        for p in items:
            top[p["industry"]] = top.get(p["industry"], 0) + 1
        summary.append(
            {
                **reg,
                "count": len(items),
                "amount": sum(p["amount"] for p in items),
                "jobs": sum(p["jobs"] for p in items),
                "topIndustries": sorted(top.items(), key=lambda x: x[1], reverse=True)[:3],
                "msb": MSB_CONTEXT.get(reg["id"]),
            }
        )

    years = sorted({p["year"] for p in projects}) or [2024, 2025, 2026]
    return {
        "regions": summary,
        "projects": projects,
        "filters": {
            "orgs": [{"id": oid, "name": name} for oid, name in ORGS],
            "industries": INDUSTRIES,
            "years": years,
            "statuses": sorted({p["status"] for p in projects}),
        },
    }
