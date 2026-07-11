from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select

from ..db import get_session
from ..models import Notification
from ..session import current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
def list_notifications(request: Request, db: Session = Depends(get_session)):
    user = current_user(request)
    if not user or not user.bin:
        return []
    rows = db.exec(
        select(Notification)
        .where(Notification.userBin == user.bin)
        .order_by(Notification.createdAt.desc())
    ).all()
    return rows


@router.post("/read-all")
def mark_all_read(request: Request, db: Session = Depends(get_session)):
    user = current_user(request)
    if not user or not user.bin:
        return {"updated": 0}
    rows = db.exec(
        select(Notification).where(
            Notification.userBin == user.bin, Notification.read == False  # noqa: E712
        )
    ).all()
    for n in rows:
        n.read = True
        db.add(n)
    db.commit()
    return {"updated": len(rows)}
