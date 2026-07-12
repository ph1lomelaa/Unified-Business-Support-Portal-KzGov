from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..db import get_session
from ..models import AuditLog
from ..session import require_role

router = APIRouter(
    prefix="/api/v1/admin/audit",
    tags=["admin-audit"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


@router.get("")
def list_audit_events(
    actor: str | None = None,
    action: str | None = None,
    fromDate: datetime | None = None,
    toDate: datetime | None = None,
    serviceId: str | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_session),
):
    stmt = select(AuditLog)
    if actor:
        stmt = stmt.where(AuditLog.actor.contains(actor))
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if fromDate:
        stmt = stmt.where(AuditLog.createdAt >= fromDate)
    if toDate:
        stmt = stmt.where(AuditLog.createdAt <= toDate)
    if serviceId:
        stmt = stmt.where(
            (AuditLog.entityId == serviceId)
            | (AuditLog.meta["serviceId"].as_string() == serviceId)
        )
    events = db.exec(stmt.order_by(AuditLog.createdAt.desc()).limit(limit)).all()
    rows = [
        {
            "id": event.id,
            "actor": event.actor,
            "actorRole": event.actorRole,
            "action": event.action,
            "entityType": event.entityType,
            "entityId": event.entityId,
            "meta": event.meta,
            "createdAt": event.createdAt,
        }
        for event in events
    ]
    return {
        "events": rows,
        # exec() of a single-column select yields scalar strings, not rows.
        "actions": sorted(set(db.exec(select(AuditLog.action)).all())),
        "summary": {
            "events": len(rows),
            "aiEvents": sum(1 for item in rows if item["action"] == "ai.generation_used"),
            "serviceEvents": sum(1 for item in rows if item["entityType"] == "service"),
            "applicationEvents": sum(1 for item in rows if item["entityType"] == "application"),
        },
    }
