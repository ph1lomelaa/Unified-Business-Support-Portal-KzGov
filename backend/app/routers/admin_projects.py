"""Admin CRUD for map projects (Фаза 4.3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from ..db import get_session
from ..map_data import INDUSTRIES, ORGS, REGIONS, STATUSES
from ..models import Project, gen_id, utcnow
from ..session import SessionUser, require_role

router = APIRouter(
    prefix="/api/v1/admin/projects",
    tags=["admin-projects"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)

_REGION_NAME = {r["id"]: r["name"] for r in REGIONS}


def _dto(p: Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "orgId": p.orgId,
        "regionId": p.regionId,
        "regionName": _REGION_NAME.get(p.regionId, p.regionId),
        "industry": p.industry,
        "status": p.status,
        "year": p.year,
        "amount": p.amount,
        "jobs": p.jobs,
        "lat": p.lat,
        "lon": p.lon,
        "city": p.city,
        "description": p.description,
        "url": p.url,
    }


@router.get("")
def list_projects(
    region: str | None = None,
    org: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=40, ge=1, le=200),
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    stmt = select(Project)
    if user.role == "analyst":
        if not user.orgId:
            return {"items": [], "total": 0, "facets": {"orgs": [], "regions": [], "industries": [], "statuses": []}}
        stmt = stmt.where(Project.orgId == user.orgId)
    if region:
        stmt = stmt.where(Project.regionId == region)
    if org:
        stmt = stmt.where(Project.orgId == org)
    total = db.exec(select(func.count()).select_from(stmt.subquery())).one()
    rows = db.exec(stmt.order_by(Project.id).offset(offset).limit(limit)).all()
    return {
        "items": [_dto(p) for p in rows],
        "total": total,
        "facets": {
            "orgs": [{"id": oid, "name": name} for oid, name in ORGS],
            "regions": [{"id": r["id"], "name": r["name"]} for r in REGIONS],
            "industries": INDUSTRIES,
            "statuses": STATUSES,
        },
    }


class ProjectBody(BaseModel):
    title: str | None = None
    orgId: str | None = None
    regionId: str | None = None
    industry: str | None = None
    status: str | None = None
    year: int | None = None
    amount: int | None = None
    jobs: int | None = None
    lat: float | None = None
    lon: float | None = None
    city: str | None = None
    description: str | None = None
    url: str | None = None


@router.post("", status_code=201)
def create_project(
    body: ProjectBody,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    if not body.title or not body.orgId or not body.regionId or not body.industry:
        raise HTTPException(400, "title, orgId, regionId и industry обязательны")
    if user.role == "analyst" and user.orgId != body.orgId:
        raise HTTPException(403, "Аналитик может управлять проектами только своей организации")
    data = body.model_dump(exclude_none=True)
    # Default coords to the region centre so a new pin lands on the map.
    if "lat" not in data or "lon" not in data:
        centre = next((r["center"] for r in REGIONS if r["id"] == body.regionId), None)
        if centre:
            data.setdefault("lat", centre[0])
            data.setdefault("lon", centre[1])
    project = Project(id=gen_id("prj_"), **data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _dto(project)


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: ProjectBody,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Проект не найден")
    if user.role == "analyst" and (
        not user.orgId or project.orgId != user.orgId or (body.orgId and body.orgId != user.orgId)
    ):
        raise HTTPException(403, "Недостаточно прав для проекта другой организации")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(project, key, value)
    project.updatedAt = utcnow()
    db.add(project)
    db.commit()
    db.refresh(project)
    return _dto(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Проект не найден")
    if user.role == "analyst" and (not user.orgId or project.orgId != user.orgId):
        raise HTTPException(403, "Недостаточно прав для проекта другой организации")
    db.delete(project)
    db.commit()
