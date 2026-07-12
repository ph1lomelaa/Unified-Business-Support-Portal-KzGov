"""Admin CRUD for reference dictionaries (справочники, Фаза 2).

Everything an analyst needs to manage справочники without touching code:
create/rename dictionaries, add/edit/reorder items, bulk-paste, and — for
`source="external"` dictionaries — pull the item list from an external registry
through the integration bus (`POST /{code}/sync`). The synced payload is a plain
list of {value,label,parentValue?}, upserted by value.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..integration import bus
from ..models import Dictionary, DictionaryItem, utcnow
from ..session import require_role

router = APIRouter(
    prefix="/api/v1/admin/dictionaries",
    tags=["admin-dictionaries"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


# --- DTOs ---------------------------------------------------------------------
def _item_dto(i: DictionaryItem) -> dict:
    return {
        "id": i.id,
        "value": i.value,
        "label": i.label,
        "parentValue": i.parentValue,
        "sortOrder": i.sortOrder,
        "isActive": i.isActive,
    }


def _dict_dto(d: Dictionary, *, with_items: bool = True) -> dict:
    items = sorted(d.items, key=lambda i: (i.sortOrder, i.label))
    dto = {
        "id": d.id,
        "code": d.code,
        "title": d.title,
        "description": d.description,
        "source": d.source,
        "systemId": d.systemId,
        "operation": d.operation,
        "hierarchical": d.hierarchical,
        "status": d.status,
        "lastSyncedAt": d.lastSyncedAt.isoformat() if d.lastSyncedAt else None,
        "itemCount": len(items),
    }
    if with_items:
        dto["items"] = [_item_dto(i) for i in items]
    return dto


def _get_by_code(db: Session, code: str) -> Dictionary:
    d = db.exec(select(Dictionary).where(Dictionary.code == code)).first()
    if not d:
        raise HTTPException(404, f"Справочник '{code}' не найден")
    return d


# --- dictionary CRUD ----------------------------------------------------------
@router.get("")
def list_dictionaries(db: Session = Depends(get_session)):
    rows = db.exec(select(Dictionary)).all()
    return [_dict_dto(d, with_items=False) for d in sorted(rows, key=lambda d: d.title)]


@router.get("/{code}")
def get_dictionary(code: str, db: Session = Depends(get_session)):
    return _dict_dto(_get_by_code(db, code))


class DictionaryBody(BaseModel):
    code: str | None = None
    title: str | None = None
    description: str | None = None
    source: str | None = None
    systemId: str | None = None
    operation: str | None = None
    hierarchical: bool | None = None
    status: str | None = None


@router.post("", status_code=201)
def create_dictionary(body: DictionaryBody, db: Session = Depends(get_session)):
    if not body.code or not body.title:
        raise HTTPException(400, "code и title обязательны")
    if db.exec(select(Dictionary).where(Dictionary.code == body.code)).first():
        raise HTTPException(409, f"Справочник '{body.code}' уже существует")
    d = Dictionary(**body.model_dump(exclude_none=True))
    db.add(d)
    db.commit()
    db.refresh(d)
    return _dict_dto(d)


@router.patch("/{code}")
def update_dictionary(code: str, body: DictionaryBody, db: Session = Depends(get_session)):
    d = _get_by_code(db, code)
    for key, value in body.model_dump(exclude_none=True, exclude={"code"}).items():
        setattr(d, key, value)
    d.updatedAt = utcnow()
    db.add(d)
    db.commit()
    db.refresh(d)
    return _dict_dto(d)


@router.delete("/{code}", status_code=204)
def delete_dictionary(code: str, db: Session = Depends(get_session)):
    d = _get_by_code(db, code)
    db.delete(d)
    db.commit()


# --- item CRUD ----------------------------------------------------------------
class ItemBody(BaseModel):
    value: str | None = None
    label: str | None = None
    parentValue: str | None = None
    sortOrder: int | None = None
    isActive: bool | None = None


@router.post("/{code}/items", status_code=201)
def create_item(code: str, body: ItemBody, db: Session = Depends(get_session)):
    d = _get_by_code(db, code)
    if not body.value or not body.label:
        raise HTTPException(400, "value и label обязательны")
    order = body.sortOrder if body.sortOrder is not None else len(d.items)
    item = DictionaryItem(
        dictionaryId=d.id,
        value=body.value,
        label=body.label,
        parentValue=body.parentValue,
        sortOrder=order,
        isActive=body.isActive if body.isActive is not None else True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_dto(item)


@router.patch("/items/{item_id}")
def update_item(item_id: str, body: ItemBody, db: Session = Depends(get_session)):
    item = db.get(DictionaryItem, item_id)
    if not item:
        raise HTTPException(404, "Элемент не найден")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_dto(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, db: Session = Depends(get_session)):
    item = db.get(DictionaryItem, item_id)
    if not item:
        raise HTTPException(404, "Элемент не найден")
    db.delete(item)
    db.commit()


class BulkItem(BaseModel):
    value: str
    label: str
    parentValue: str | None = None


class BulkBody(BaseModel):
    items: list[BulkItem]
    replace: bool = False


@router.post("/{code}/items:bulk")
def bulk_items(code: str, body: BulkBody, db: Session = Depends(get_session)):
    """Upsert many items at once (paste from a spreadsheet). `replace=true`
    clears existing items first."""
    d = _get_by_code(db, code)
    _apply_items(db, d, [i.model_dump() for i in body.items], replace=body.replace)
    db.commit()
    db.refresh(d)
    return _dict_dto(d)


# --- external sync via the integration bus ------------------------------------
def _apply_items(db: Session, d: Dictionary, rows: list[dict], *, replace: bool) -> int:
    """Upsert `rows` (each {value,label,parentValue?}) into the dictionary by
    value. Returns the number of rows applied."""
    if replace:
        for existing in list(d.items):
            db.delete(existing)
        db.flush()
    by_value = {i.value: i for i in d.items}
    applied = 0
    for order, row in enumerate(rows):
        value = str(row.get("value", "")).strip()
        label = str(row.get("label", "")).strip() or value
        if not value:
            continue
        parent = row.get("parentValue")
        existing = by_value.get(value)
        if existing:
            existing.label = label
            existing.parentValue = parent
        else:
            item = DictionaryItem(
                dictionaryId=d.id,
                value=value,
                label=label,
                parentValue=parent,
                sortOrder=order,
            )
            db.add(item)
            by_value[value] = item
        applied += 1
    return applied


@router.post("/{code}/sync")
def sync_dictionary(code: str, db: Session = Depends(get_session)):
    """Pull items for an `external` dictionary from its registry through the
    integration bus, then upsert them. No code — the systemId/operation are
    stored on the dictionary and the mock/real adapter does the rest."""
    d = _get_by_code(db, code)
    if d.source != "external" or not d.systemId or not d.operation:
        raise HTTPException(
            400,
            "Синхронизация доступна только для внешних справочников с указанной системой и операцией.",
        )
    env = bus.call(db, d.systemId, d.operation, {"code": d.code})
    if not env["ok"]:
        raise HTTPException(502, env.get("error") or "Внешний реестр недоступен")
    rows = (env.get("data") or {}).get("items")
    if not isinstance(rows, list):
        raise HTTPException(502, "Ответ реестра не содержит список items")
    applied = _apply_items(db, d, rows, replace=True)
    d.lastSyncedAt = utcnow()
    db.add(d)
    db.commit()
    db.refresh(d)
    return {
        "dictionary": _dict_dto(d),
        "applied": applied,
        "source": (env.get("data") or {}).get("source"),
        "latencyMs": env.get("latencyMs"),
        "callId": env.get("callId"),
    }
