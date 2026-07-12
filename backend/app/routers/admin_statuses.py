"""Admin config for application statuses & routes (Фаза 4.4).

Statuses (label/color/SLA/comment rule) and transitions (per named flow) are
editable without code. After every change the in-memory status cache is
reloaded, so the application workflow picks up the new config immediately.
Different services can be pointed at different flows — a strong scalability
signal — while everything defaults to the "default" flow seeded from status.py.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import StatusModel, StatusTransition, gen_id
from ..session import require_role
from ..status import load_status_config

router = APIRouter(
    prefix="/api/v1/admin/statuses",
    tags=["admin-statuses"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)

COLORS = ["gray", "blue", "amber", "green", "red"]


def _status_dto(s: StatusModel, transitions: list[StatusTransition]) -> dict:
    return {
        "key": s.key,
        "label": s.label,
        "color": s.color,
        "who": s.who,
        "sla": s.sla,
        "commentRequired": s.commentRequired,
        "terminal": s.terminal,
        "sortOrder": s.sortOrder,
        "next": [
            {"id": t.id, "flow": t.flow, "toKey": t.toKey}
            for t in transitions
            if t.fromKey == s.key
        ],
    }


def _payload(db: Session) -> dict:
    statuses = sorted(db.exec(select(StatusModel)).all(), key=lambda s: s.sortOrder)
    transitions = db.exec(select(StatusTransition)).all()
    flows = sorted({t.flow for t in transitions} | {"default"})
    return {
        "statuses": [_status_dto(s, transitions) for s in statuses],
        "flows": flows,
        "colors": COLORS,
    }


@router.get("")
def list_statuses(db: Session = Depends(get_session)):
    return _payload(db)


class StatusBody(BaseModel):
    key: str | None = None
    label: str | None = None
    color: str | None = None
    who: str | None = None
    sla: int | None = None
    commentRequired: bool | None = None
    terminal: bool | None = None
    sortOrder: int | None = None


@router.post("", status_code=201)
def create_status(body: StatusBody, db: Session = Depends(get_session)):
    if not body.key or not body.label:
        raise HTTPException(400, "key и label обязательны")
    if db.get(StatusModel, body.key):
        raise HTTPException(409, f"Статус '{body.key}' уже существует")
    status = StatusModel(**body.model_dump(exclude_none=True))
    db.add(status)
    db.commit()
    load_status_config(db)
    return _payload(db)


@router.patch("/{key}")
def update_status(key: str, body: StatusBody, db: Session = Depends(get_session)):
    status = db.get(StatusModel, key)
    if not status:
        raise HTTPException(404, "Статус не найден")
    for field, value in body.model_dump(exclude_none=True, exclude={"key"}).items():
        setattr(status, field, value)
    db.add(status)
    db.commit()
    load_status_config(db)
    return _payload(db)


@router.delete("/{key}", status_code=200)
def delete_status(key: str, db: Session = Depends(get_session)):
    status = db.get(StatusModel, key)
    if not status:
        raise HTTPException(404, "Статус не найден")
    # Remove transitions that reference this status on either side.
    for t in db.exec(
        select(StatusTransition).where(
            (StatusTransition.fromKey == key) | (StatusTransition.toKey == key)
        )
    ).all():
        db.delete(t)
    db.delete(status)
    db.commit()
    load_status_config(db)
    return _payload(db)


class TransitionBody(BaseModel):
    flow: str = "default"
    fromKey: str
    toKey: str


@router.post("/transitions", status_code=201)
def add_transition(body: TransitionBody, db: Session = Depends(get_session)):
    if not db.get(StatusModel, body.fromKey) or not db.get(StatusModel, body.toKey):
        raise HTTPException(400, "fromKey и toKey должны быть существующими статусами")
    exists = db.exec(
        select(StatusTransition).where(
            StatusTransition.flow == body.flow,
            StatusTransition.fromKey == body.fromKey,
            StatusTransition.toKey == body.toKey,
        )
    ).first()
    if exists:
        raise HTTPException(409, "Такой переход уже есть")
    db.add(StatusTransition(id=gen_id("st_"), **body.model_dump()))
    db.commit()
    load_status_config(db)
    return _payload(db)


@router.delete("/transitions/{transition_id}", status_code=200)
def delete_transition(transition_id: str, db: Session = Depends(get_session)):
    t = db.get(StatusTransition, transition_id)
    if not t:
        raise HTTPException(404, "Переход не найден")
    db.delete(t)
    db.commit()
    load_status_config(db)
    return _payload(db)
