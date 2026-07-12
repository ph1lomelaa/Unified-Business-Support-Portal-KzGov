"""Admin-managed knowledge materials and business-development tools."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import KnowledgeItem, utcnow
from ..session import require_role
from ..slugify import slugify

router = APIRouter(
    prefix="/api/v1/admin/knowledge",
    tags=["admin-knowledge"],
    dependencies=[Depends(require_role("admin"))],
)


def _dto(item: KnowledgeItem) -> dict:
    return {
        "id": item.id,
        "slug": item.slug,
        "type": item.type,
        "title": item.title,
        "summary": item.summary,
        "body": item.body,
        "readMinutes": item.readMinutes,
        "relatedServiceSlugs": item.relatedServiceSlugs,
        "downloadRef": item.downloadRef,
        "updatedAt": item.updatedAt,
    }


class KnowledgeBody(BaseModel):
    slug: str | None = None
    type: str | None = None
    title: str | None = None
    summary: str | None = None
    body: str | None = None
    readMinutes: int | None = None
    relatedServiceSlugs: list[str] | None = None
    downloadRef: str | None = None


@router.get("")
def list_items(db: Session = Depends(get_session)):
    rows = db.exec(select(KnowledgeItem).order_by(KnowledgeItem.title)).all()
    return {"items": [_dto(item) for item in rows]}


@router.post("", status_code=201)
def create_item(body: KnowledgeBody, db: Session = Depends(get_session)):
    if not body.title or not body.type:
        raise HTTPException(400, "title и type обязательны")
    slug = slugify(body.slug or body.title)
    if db.exec(select(KnowledgeItem).where(KnowledgeItem.slug == slug)).first():
        raise HTTPException(409, f"Материал '{slug}' уже существует")
    data = body.model_dump(exclude_none=True)
    data["slug"] = slug
    item = KnowledgeItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _dto(item)


@router.patch("/{item_id}")
def update_item(item_id: str, body: KnowledgeBody, db: Session = Depends(get_session)):
    item = db.get(KnowledgeItem, item_id)
    if not item:
        raise HTTPException(404, "Материал не найден")
    data = body.model_dump(exclude_none=True)
    if "slug" in data:
        candidate = slugify(data["slug"])
        duplicate = db.exec(
            select(KnowledgeItem).where(
                KnowledgeItem.slug == candidate, KnowledgeItem.id != item_id
            )
        ).first()
        if duplicate:
            raise HTTPException(409, f"Материал '{candidate}' уже существует")
        data["slug"] = candidate
    for key, value in data.items():
        setattr(item, key, value)
    item.updatedAt = utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return _dto(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, db: Session = Depends(get_session)):
    item = db.get(KnowledgeItem, item_id)
    if not item:
        raise HTTPException(404, "Материал не найден")
    db.delete(item)
    db.commit()
