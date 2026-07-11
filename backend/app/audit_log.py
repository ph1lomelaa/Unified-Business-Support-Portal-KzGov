from __future__ import annotations

from typing import Any

from sqlmodel import Session

from .models import AuditLog
from .session import SessionUser


def record_audit(
    db: Session,
    *,
    user: SessionUser | None,
    action: str,
    entity_type: str,
    entity_id: str,
    meta: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor=user.name if user else "System",
            actorRole=user.role if user else "system",
            action=action,
            entityType=entity_type,
            entityId=entity_id,
            meta=meta or {},
        )
    )
