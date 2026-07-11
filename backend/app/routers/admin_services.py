"""Constructor / admin service API (spec Части 3, 6.2, 6.3).

Flow:
- create        -> Service(status=draft) + FormSchema(version=1, isActive=False)
- PATCH card    -> update card fields
- PUT form      -> new FormSchema version = max+1, isActive=False (REQ-04)
- publish       -> chosen version isActive=True, others False, status=published
- duplicate     -> copy Service + latest FormSchema as status=draft (Часть 3.5)
- archive       -> status=archived

Submitted applications snapshot the schema at submit time, so publishing new
versions never breaks already-open applications.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, func, select

from ..audit_log import record_audit
from ..db import get_session
from ..models import Application, FormSchema, Organization, Service
from ..session import SessionUser, require_role
from ..slugify import slugify

router = APIRouter(
    prefix="/api/v1/admin/services",
    tags=["admin:services"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


# ---------- request bodies ----------
class CreateServiceBody(BaseModel):
    title: str
    orgId: str
    category: str = "subsidy"
    slug: str | None = None
    preset: str | None = None


class UpdateCardBody(BaseModel):
    title: str | None = None
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    conditions: list | None = None
    documents: list | None = None
    eligibility: dict | None = None
    faq: list | None = None
    tags: dict | None = None
    reviewDays: int | None = None
    docTemplate: str | None = None


class SaveFormBody(BaseModel):
    schema: dict
    author: str = "Аналитик"


class PublishBody(BaseModel):
    version: int | None = None


# ---------- helpers ----------
def _unique_slug(db: Session, base: str) -> str:
    slug = base
    i = 2
    while db.exec(select(Service).where(Service.slug == slug)).first():
        slug = f"{base}-{i}"
        i += 1
    return slug


def _touch(service: Service) -> None:
    service.updatedAt = datetime.now(timezone.utc)


def _active_version(db: Session, service_id: str) -> FormSchema | None:
    return db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()


def _latest_version(db: Session, service_id: str) -> FormSchema | None:
    return db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id)
        .order_by(FormSchema.version.desc())
    ).first()


def _load_form_preset(preset: str | None, title: str) -> tuple[str | None, dict]:
    if not preset:
        return None, {"title": title, "pages": []}
    safe = preset.replace("-", "_")
    if safe not in {"credit", "subsidy", "guarantee", "information"}:
        raise HTTPException(400, "Неизвестный пресет формы")
    path = Path(__file__).resolve().parents[1] / "form_presets" / f"{safe}.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise HTTPException(500, "Пресет формы не найден") from exc
    schema = payload.get("schema")
    if not isinstance(schema, dict):
        raise HTTPException(500, "Пресет формы повреждён")
    schema = dict(schema)
    schema["title"] = title
    return payload.get("category"), schema


def _registry_row(db: Session, s: Service, org: Organization | None) -> dict:
    latest = _latest_version(db, s.id)
    active = _active_version(db, s.id)
    app_count = db.exec(
        select(func.count()).select_from(Application).where(Application.serviceId == s.id)
    ).one()
    return {
        "id": s.id,
        "slug": s.slug,
        "title": s.title,
        "category": s.category,
        "status": s.status,
        "reviewDays": s.reviewDays,
        "formVersion": latest.version if latest else 0,
        "activeVersion": active.version if active else None,
        "applications": app_count,
        "updatedAt": s.updatedAt,
        "org": {"id": org.id, "shortName": org.shortName, "color": org.color, "name": org.name, "logo": org.logo or None}
        if org
        else None,
    }


# ---------- endpoints ----------
def _assert_service_access(user: SessionUser, service: Service) -> None:
    if user.role == "analyst" and user.orgId != service.orgId:
        raise HTTPException(403, "Недостаточно прав для услуги другой организации")


@router.get("")
def list_services(
    request: Request,
    db: Session = Depends(get_session),
    org: str | None = None,
):
    user = require_role("admin", "analyst")(request)
    stmt = select(Service, Organization).join(
        Organization, Service.orgId == Organization.id, isouter=True
    )
    if user.role == "analyst":
        if not user.orgId:
            return []
        stmt = stmt.where(Service.orgId == user.orgId)
    elif org:
        stmt = stmt.where(Service.orgId == org)
    rows = db.exec(stmt).all()
    result = [_registry_row(db, s, o) for (s, o) in rows]
    result.sort(key=lambda r: r["updatedAt"], reverse=True)
    return result


@router.post("", status_code=201)
def create_service(
    body: CreateServiceBody,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    if user.role == "analyst" and user.orgId != body.orgId:
        raise HTTPException(403, "Аналитик может создавать услуги только своей организации")
    org = db.get(Organization, body.orgId)
    if not org:
        raise HTTPException(404, "Организация не найдена")
    preset_category, preset_schema = _load_form_preset(body.preset, body.title)
    base = body.slug or f"{org.id}-{slugify(body.title)}"
    slug = _unique_slug(db, base)
    service = Service(
        slug=slug,
        orgId=body.orgId,
        title=body.title,
        category=preset_category or body.category,
        status="draft",
        summary="",
    )
    db.add(service)
    db.flush()
    form = FormSchema(
        serviceId=service.id,
        version=1,
        isActive=False,
        schema=preset_schema,
        author=f"Пресет: {body.preset}" if body.preset else "Аналитик",
    )
    db.add(form)
    db.commit()
    db.refresh(service)
    return {"id": service.id, "slug": service.slug}


@router.get("/{service_id}")
def get_service(
    service_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, service)
    org = db.get(Organization, service.orgId)
    versions = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id)
        .order_by(FormSchema.version.desc())
    ).all()
    active = next((v for v in versions if v.isActive), None)
    latest = versions[0] if versions else None
    editing = latest  # editor always loads the newest schema for further edits
    return {
        "id": service.id,
        "slug": service.slug,
        "orgId": service.orgId,
        "org": {"id": org.id, "shortName": org.shortName, "name": org.name, "color": org.color, "logo": org.logo or None}
        if org
        else None,
        "title": service.title,
        "category": service.category,
        "summary": service.summary,
        "description": service.description,
        "conditions": service.conditions,
        "documents": service.documents,
        "materials": service.materials,
        "eligibility": service.eligibility,
        "faq": service.faq,
        "tags": service.tags,
        "status": service.status,
        "reviewDays": service.reviewDays,
        "docTemplate": service.docTemplate,
        "schema": editing.schema if editing else {"pages": []},
        "activeVersion": active.version if active else None,
        "latestVersion": latest.version if latest else 0,
        "versions": [
            {
                "version": v.version,
                "author": v.author,
                "isActive": v.isActive,
                "createdAt": v.createdAt,
            }
            for v in versions
        ],
    }


@router.patch("/{service_id}")
def update_card(
    service_id: str,
    body: UpdateCardBody,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, service)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(service, k, v)
    _touch(service)
    db.add(service)
    if "docTemplate" in data:
        record_audit(
            db,
            user=user,
            action="doc_template.updated",
            entity_type="service",
            entity_id=service.id,
            meta={
                "serviceId": service.id,
                "title": service.title,
                "hasTemplate": bool(service.docTemplate.strip()),
            },
        )
    db.commit()
    return {"ok": True}


@router.put("/{service_id}/form")
def save_form(
    service_id: str,
    body: SaveFormBody,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, service)
    latest = _latest_version(db, service_id)
    next_version = (latest.version + 1) if latest else 1
    form = FormSchema(
        serviceId=service_id,
        version=next_version,
        schema=body.schema,
        isActive=False,
        author=body.author,
    )
    db.add(form)
    _touch(service)
    db.add(service)
    record_audit(
        db,
        user=user,
        action="form_schema.version_created",
        entity_type="service",
        entity_id=service.id,
        meta={
            "serviceId": service.id,
            "title": service.title,
            "version": next_version,
            "author": body.author,
            "pages": len(body.schema.get("pages", [])) if isinstance(body.schema, dict) else 0,
        },
    )
    db.commit()
    return {"version": next_version}


@router.post("/{service_id}/publish")
def publish(
    service_id: str,
    body: PublishBody,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, service)
    versions = db.exec(
        select(FormSchema).where(FormSchema.serviceId == service_id)
    ).all()
    if not versions:
        raise HTTPException(400, "Нет ни одной версии формы")
    target = body.version or max(v.version for v in versions)
    found = False
    for v in versions:
        active = v.version == target
        v.isActive = active
        db.add(v)
        found = found or active
    if not found:
        raise HTTPException(404, f"Версия {target} не найдена")
    service.status = "published"
    _touch(service)
    db.add(service)
    record_audit(
        db,
        user=user,
        action="service.published",
        entity_type="service",
        entity_id=service.id,
        meta={"serviceId": service.id, "title": service.title, "activeVersion": target},
    )
    db.commit()
    return {"status": "published", "activeVersion": target}


@router.post("/{service_id}/duplicate", status_code=201)
def duplicate(
    service_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    src = db.get(Service, service_id)
    if not src:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, src)
    new_slug = _unique_slug(db, f"{src.slug}-copy")
    clone = Service(
        slug=new_slug,
        orgId=src.orgId,
        title=f"{src.title} (копия)",
        category=src.category,
        summary=src.summary,
        description=src.description,
        conditions=src.conditions,
        documents=src.documents,
        materials=src.materials,
        eligibility=src.eligibility,
        faq=src.faq,
        tags=src.tags,
        status="draft",
        reviewDays=src.reviewDays,
        docTemplate=src.docTemplate,
    )
    db.add(clone)
    db.flush()
    latest = _latest_version(db, service_id)
    db.add(
        FormSchema(
            serviceId=clone.id,
            version=1,
            schema=latest.schema if latest else {"pages": []},
            isActive=False,
        )
    )
    db.commit()
    return {"id": clone.id, "slug": clone.slug}


@router.post("/{service_id}/archive")
def archive(
    service_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    _assert_service_access(user, service)
    service.status = "archived"
    _touch(service)
    db.add(service)
    db.commit()
    return {"status": "archived"}
