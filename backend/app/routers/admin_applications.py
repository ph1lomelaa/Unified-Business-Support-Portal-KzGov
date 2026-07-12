"""Admin/analyst application queue + status transitions (spec Часть 6.4, 7).

Role logic: an analyst sees only their organization's applications (filter by
orgId); an admin sees all. Transitions are validated by the status model;
needs_changes / rejected require a comment. Each transition creates an
ApplicationEvent + a client Notification.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from ..audit_log import record_audit
from ..db import get_session
from ..models import (
    Application,
    ApplicationEvent,
    Company,
    Notification,
    Organization,
    Service,
)
from ..session import require_role
from ..status import (
    STATUS,
    can_transition,
    next_statuses,
    requires_comment,
    sla_progress,
    status_label,
)

router = APIRouter(
    prefix="/api/v1/admin/applications",
    tags=["admin:applications"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


class TransitionBody(BaseModel):
    to: str
    comment: str | None = None


def _submitted_at(db: Session, app_id: str) -> datetime | None:
    ev = db.exec(
        select(ApplicationEvent)
        .where(
            ApplicationEvent.appId == app_id,
            ApplicationEvent.toStatus == "submitted",
        )
        .order_by(ApplicationEvent.createdAt)
    ).first()
    return ev.createdAt if ev else None


def _sla(db: Session, app: Application, service: Service | None) -> dict | None:
    sla_days = STATUS.get(app.status).sla if STATUS.get(app.status) else None
    if not sla_days:
        return None
    sub = _submitted_at(db, app.id)
    if not sub:
        return None
    if sub.tzinfo is None:
        sub = sub.replace(tzinfo=timezone.utc)
    return sla_progress(sub, sla_days)


@router.get("")
def list_queue(
    request: Request,
    db: Session = Depends(get_session),
    status: str | None = None,
    service: str | None = None,
    org: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    user = require_role("admin", "analyst")(request)
    stmt = (
        select(Application, Service, Organization, Company)
        .join(Service, Application.serviceId == Service.id, isouter=True)
        .join(Organization, Service.orgId == Organization.id, isouter=True)
        .join(Company, Application.companyBin == Company.bin, isouter=True)
    )
    # analyst -> only own org
    if user and user.role == "analyst":
        if not user.orgId:
            return []
        stmt = stmt.where(Service.orgId == user.orgId)
    elif org:
        stmt = stmt.where(Service.orgId == org)
    if status:
        stmt = stmt.where(Application.status == status)
    if service:
        stmt = stmt.where(Application.serviceId == service)

    rows = db.exec(
        stmt.order_by(Application.updatedAt.desc()).offset(offset).limit(limit)
    ).all()
    out = []
    for a, s, o, c in rows:
        out.append(
            {
                "id": a.id,
                "number": a.number,
                "status": a.status,
                "statusLabel": status_label(a.status),
                "createdAt": a.createdAt,
                "updatedAt": a.updatedAt,
                "sla": _sla(db, a, s),
                "company": {"name": c.name, "bin": c.bin} if c else None,
                "service": {"title": s.title, "slug": s.slug} if s else None,
                "org": {"shortName": o.shortName, "name": o.name, "color": o.color, "logo": o.logo or None}
                if o else None,
            }
        )
    return out


@router.get("/{app_id}")
def get_detail(
    app_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Заявка не найдена")
    s = db.get(Service, a.serviceId)
    if user.role == "analyst":
        if not user.orgId or not s or s.orgId != user.orgId:
            raise HTTPException(403, "Недостаточно прав для заявки другой организации")
    o = db.get(Organization, s.orgId) if s else None
    c = db.get(Company, a.companyBin)
    events = db.exec(
        select(ApplicationEvent)
        .where(ApplicationEvent.appId == a.id)
        .order_by(ApplicationEvent.createdAt)
    ).all()
    return {
        "id": a.id,
        "number": a.number,
        "status": a.status,
        "statusLabel": status_label(a.status),
        "answers": a.answers,
        "calc": a.calc,
        "pdfUrl": a.pdfUrl,
        "files": a.files,
        "schema": a.schemaSnapshot,
        "sla": _sla(db, a, s),
        "createdAt": a.createdAt,
        "company": {
            "name": c.name, "bin": c.bin, "director": c.director,
            "region": c.region, "address": c.address,
        } if c else None,
        "service": {"title": s.title, "slug": s.slug, "reviewDays": s.reviewDays}
        if s else None,
        "org": {"shortName": o.shortName, "name": o.name, "color": o.color, "logo": o.logo or None}
        if o else None,
        "nextStatuses": next_statuses(a.status),
        "events": [
            {
                "id": e.id, "fromStatus": e.fromStatus, "toStatus": e.toStatus,
                "toLabel": status_label(e.toStatus), "comment": e.comment,
                "actor": e.actor, "createdAt": e.createdAt,
            }
            for e in events
        ],
    }


@router.post("/{app_id}/transition")
def transition(
    app_id: str,
    body: TransitionBody,
    request: Request,
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    if not can_transition(app.status, body.to):
        raise HTTPException(
            409,
            f"Недопустимый переход: {status_label(app.status)} → {status_label(body.to)}",
        )
    if requires_comment(body.to) and not (body.comment and body.comment.strip()):
        raise HTTPException(400, "Для этого действия требуется комментарий")

    user = require_role("admin", "analyst")(request)
    if user.role == "analyst":
        service = db.get(Service, app.serviceId)
        if not user.orgId or not service or service.orgId != user.orgId:
            raise HTTPException(403, "Недостаточно прав для заявки другой организации")
    actor = "manager" if user and user.role in ("analyst", "admin") else "system"
    src = app.status
    app.status = body.to
    app.updatedAt = datetime.now(timezone.utc)
    db.add(app)
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus=src, toStatus=body.to,
            comment=body.comment, actor=actor,
        )
    )
    service = db.get(Service, app.serviceId)
    _notify_client(db, app, service, body.to, body.comment)
    record_audit(
        db,
        user=user,
        action="application.status_changed",
        entity_type="application",
        entity_id=app.id,
        meta={
            "applicationId": app.id,
            "number": app.number,
            "serviceId": app.serviceId,
            "fromStatus": src,
            "toStatus": body.to,
            "comment": body.comment,
        },
    )
    db.commit()
    return {"status": app.status, "statusLabel": status_label(app.status)}


def _notify_client(
    db: Session, app: Application, service: Service | None, to: str, comment: str | None
) -> None:
    title_map = {
        "approved": f"Заявка {app.number} одобрена",
        "needs_changes": f"Заявка {app.number} требует доработки",
        "rejected": f"Заявка {app.number}: отказ",
        "contract_signed": f"Заявка {app.number}: договор подписан",
        "active": f"Заявка {app.number}: субсидирование активно",
        "completed": f"Заявка {app.number} завершена",
    }
    title = title_map.get(to, f"Заявка {app.number}: {status_label(to)}")
    body = comment or f"Статус изменён на «{status_label(to)}»."
    db.add(
        Notification(
            userBin=app.companyBin,
            title=title,
            body=body,
            appId=app.id,
            kind="status",
        )
    )
