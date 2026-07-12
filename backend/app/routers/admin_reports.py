"""Admin CRUD for analytics reports (Фаза 4.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Report, gen_id, utcnow
from ..reports_data import ORG_META, TYPE_LABELS
from ..session import SessionUser, require_role

router = APIRouter(
    prefix="/api/v1/admin/reports",
    tags=["admin-reports"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


def _dto(r: Report) -> dict:
    return {
        "id": r.id,
        "orgId": r.orgId,
        "type": r.type,
        "title": r.title,
        "description": r.description,
        "source": r.source,
        "period": r.period,
        "updated": r.updated,
        "url": r.url,
        "embedUrl": r.embedUrl,
        "sortOrder": r.sortOrder,
        "status": r.status,
    }


@router.get("")
def list_reports(
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    stmt = select(Report)
    if user.role == "analyst":
        if not user.orgId:
            rows = []
        else:
            rows = db.exec(stmt.where(Report.orgId == user.orgId)).all()
    else:
        rows = db.exec(stmt).all()
    return {
        "items": [_dto(r) for r in sorted(rows, key=lambda r: (r.sortOrder, r.title))],
        "orgs": [{"id": k, "name": m[0], "short": m[1]} for k, m in ORG_META.items()],
        "types": [{"id": k, "label": v} for k, v in TYPE_LABELS.items()],
    }


class ReportBody(BaseModel):
    orgId: str | None = None
    type: str | None = None
    title: str | None = None
    description: str | None = None
    source: str | None = None
    period: str | None = None
    updated: str | None = None
    url: str | None = None
    embedUrl: str | None = None
    sortOrder: int | None = None
    status: str | None = None


@router.post("", status_code=201)
def create_report(
    body: ReportBody,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    if not body.title or not body.orgId:
        raise HTTPException(400, "title и orgId обязательны")
    if user.role == "analyst" and user.orgId != body.orgId:
        raise HTTPException(403, "Аналитик может управлять материалами только своей организации")
    report = Report(id=gen_id("rep_"), **body.model_dump(exclude_none=True))
    db.add(report)
    db.commit()
    db.refresh(report)
    return _dto(report)


@router.patch("/{report_id}")
def update_report(
    report_id: str,
    body: ReportBody,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Материал не найден")
    if user.role == "analyst" and (
        not user.orgId or report.orgId != user.orgId or (body.orgId and body.orgId != user.orgId)
    ):
        raise HTTPException(403, "Недостаточно прав для материала другой организации")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(report, key, value)
    report.updatedAt = utcnow()
    db.add(report)
    db.commit()
    db.refresh(report)
    return _dto(report)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: str,
    user: SessionUser = Depends(require_role("admin", "analyst")),
    db: Session = Depends(get_session),
):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Материал не найден")
    if user.role == "analyst" and (not user.orgId or report.orgId != user.orgId):
        raise HTTPException(403, "Недостаточно прав для материала другой организации")
    db.delete(report)
    db.commit()
