from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, func, select

from ..ai.generate import AiError, generate_service
from ..audit_log import record_audit
from ..db import get_session
from ..models import (
    FormSchema,
    ImportedService,
    NewsItem,
    OfficialImportRun,
    OfficialSource,
    Organization,
    Service,
)
from ..session import require_role
from ..slugify import slugify
from ..sources.pipeline import (
    PIPELINE_STAGES,
    ensure_official_sources,
    imported_service_to_public,
    run_source,
)
from ..sources.news_scrape import import_news

router = APIRouter(
    prefix="/api/v1/admin/imports",
    tags=["admin-imports"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


class PublishNewsBody(BaseModel):
    ids: list[str]


@router.get("")
def list_import_pipeline(
    sourceId: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_session),
):
    ensure_official_sources(db)
    sources = db.exec(select(OfficialSource).order_by(OfficialSource.name)).all()
    stmt = select(ImportedService)
    if sourceId:
        if not db.get(OfficialSource, sourceId):
            raise HTTPException(404, "Источник не найден")
        stmt = stmt.where(ImportedService.sourceId == sourceId)
    total = db.exec(select(func.count()).select_from(stmt.subquery())).one()
    imported = db.exec(stmt.order_by(ImportedService.updatedAt.desc()).offset(offset).limit(limit)).all()
    source_rows = [_source_to_public(db, source) for source in sources]
    services = [imported_service_to_public(db, item) for item in imported]
    return {
        "sources": source_rows,
        "services": services,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total,
            "hasMore": offset + len(services) < total,
        },
        "stages": PIPELINE_STAGES,
        "summary": {
            "sources": len(source_rows),
            "found": sum(s["found"] for s in source_rows),
            "updated": sum(s["updated"] for s in source_rows),
            "needsReview": sum(s["needsReview"] for s in source_rows),
            "published": sum(s["published"] for s in source_rows),
        },
    }


@router.get("/news")
def list_imported_news(
    status: str | None = None,
    db: Session = Depends(get_session),
):
    stmt = (
        select(NewsItem, Organization)
        .join(Organization, NewsItem.sourceOrgId == Organization.id, isouter=True)
        .order_by(NewsItem.importedAt.desc(), NewsItem.publishedAt.desc())
    )
    if status:
        stmt = stmt.where(NewsItem.status == status)
    rows = db.exec(stmt).all()
    last_imported = db.exec(select(func.max(NewsItem.importedAt))).one()
    return {
        "items": [_news_to_admin(item, org) for item, org in rows],
        "summary": {
            "total": len(rows),
            "draft": sum(1 for item, _ in rows if item.status == "draft"),
            "published": sum(1 for item, _ in rows if item.status == "published"),
            "lastImportedAt": last_imported,
        },
    }


@router.post("/news/run")
def run_news_import(db: Session = Depends(get_session)):
    return {"sources": import_news(db)}


@router.post("/news/publish")
def publish_news(body: PublishNewsBody, db: Session = Depends(get_session)):
    if not body.ids:
        raise HTTPException(400, "Выберите новости для публикации")
    rows = db.exec(select(NewsItem).where(NewsItem.id.in_(body.ids))).all()
    for item in rows:
        item.status = "published"
        db.add(item)
    db.commit()
    return {"published": len(rows)}


@router.post("/{source_id}/run")
def run_import(
    source_id: str,
    maxPages: int | None = Query(default=4, ge=1, le=20),
    db: Session = Depends(get_session),
):
    # Интерактивная кнопка «Обновить сейчас» ограничивает обход (по умолчанию
    # 4 страницы bgov — этого достаточно, чтобы захватить обе контрольные
    # услуги: «Агробизнес животноводство» и «вагоны в лизинг»), чтобы клик
    # отвечал за секунды. Полный обход выполняет плановый импорт.
    try:
        run = run_source(db, source_id, max_pages=maxPages)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "id": run.id,
        "sourceId": run.sourceId,
        "status": run.status,
        "found": run.found,
        "changed": run.changed,
        "skippedRobots": run.skippedRobots,
        "errors": run.errors,
        "startedAt": run.startedAt,
        "finishedAt": run.finishedAt,
    }


@router.post("/services/{imported_id}/draft", status_code=201)
def create_draft_service(
    imported_id: str,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_role("admin", "analyst")(request)
    item = db.get(ImportedService, imported_id)
    if not item:
        raise HTTPException(404, "Импортированная услуга не найдена")
    if item.serviceSlug:
        existing = db.exec(select(Service).where(Service.slug == item.serviceSlug)).first()
        if existing:
            return {"id": existing.id, "slug": existing.slug}
    if not item.orgId:
        raise HTTPException(400, "Организация не сопоставлена, сначала проверьте импорт")
    if user.role == "analyst" and user.orgId != item.orgId:
        raise HTTPException(403, "Аналитик может создавать черновики только своей организации")
    org = db.get(Organization, item.orgId)
    if not org:
        raise HTTPException(400, "Организация не найдена")
    payload = item.draftPayload or {}
    card = payload.get("card") if isinstance(payload.get("card"), dict) else {}
    form = payload.get("form") if isinstance(payload.get("form"), dict) else {"pages": []}
    # Ленивое AI-обогащение: обход источников намеренно детерминированный и
    # быстрый (без AI на каждую карточку), поэтому черновая форма — базовая.
    # Здесь, в момент осознанного действия аналитика «Создать черновик»,
    # один раз генерируем богатую многостраничную SurveyJS-схему из текста
    # программы. Карточку/документы/материалы оставляем из структурных данных
    # bgov (реальные), AI дополняет только форму. Ошибка AI — не блокирует.
    source_text = (payload.get("source") or {}).get("text") if isinstance(payload.get("source"), dict) else ""
    if source_text and _form_is_basic(form):
        try:
            generated = generate_service(source_text)
            if isinstance(generated.get("form"), dict) and generated["form"].get("pages"):
                form = generated["form"]
                payload["form"] = form
                item.draftPayload = payload
                db.add(item)
        except AiError:
            pass  # оставляем базовую форму — импорт всё равно создаёт услугу
    service = Service(
        slug=_unique_slug(db, f"{org.id}-{slugify(item.title)}"),
        orgId=org.id,
        title=card.get("title") or item.title,
        category=card.get("category") or "subsidy",
        summary=card.get("summary") or "",
        description=card.get("description") or _description_from_payload(payload),
        conditions=card.get("conditions") or [],
        documents=card.get("documents") or [],
        materials=card.get("materials") or [],
        status="draft",
        tags={},
        reviewDays=5,
    )
    db.add(service)
    db.flush()
    db.add(
        FormSchema(
            serviceId=service.id,
            version=1,
            schema=form,
            isActive=False,
            author="Official Source Import",
        )
    )
    item.serviceSlug = service.slug
    item.status = "draft_form"
    item.updatedAt = datetime.now(timezone.utc)
    db.add(item)
    record_audit(
        db,
        user=user,
        action="import.published",
        entity_type="imported_service",
        entity_id=item.id,
        meta={
            "importedServiceId": item.id,
            "serviceId": service.id,
            "serviceSlug": service.slug,
            "sourceId": item.sourceId,
            "title": service.title,
        },
    )
    db.commit()
    db.refresh(service)
    return {"id": service.id, "slug": service.slug}


def _form_is_basic(form: dict) -> bool:
    """Базовая заглушка формы из детерминированного обхода (страница «О компании»
    с bin + описание проекта). Признак — мало полей; тогда стоит обогатить AI."""
    if not isinstance(form, dict):
        return True
    pages = form.get("pages") if isinstance(form.get("pages"), list) else []
    total_fields = sum(
        len(page.get("elements", [])) for page in pages if isinstance(page, dict)
    )
    return total_fields <= 3


def _news_to_admin(item: NewsItem, org: Organization | None) -> dict:
    return {
        "id": item.id,
        "sourceOrgId": item.sourceOrgId,
        "sourceOrg": org.shortName if org else item.sourceOrgId,
        "title": item.title,
        "summary": item.summary,
        "publishedAt": item.publishedAt,
        "sourceUrl": item.sourceUrl,
        "imageUrl": item.imageUrl,
        "importedAt": item.importedAt,
        "status": item.status,
    }


def _source_to_public(db: Session, source: OfficialSource) -> dict:
    last_run = db.exec(
        select(OfficialImportRun)
        .where(OfficialImportRun.sourceId == source.id)
        .order_by(OfficialImportRun.startedAt.desc())
    ).first()
    found = last_run.found if last_run else 0
    updated = last_run.changed if last_run else 0
    needs_review = db.exec(
        select(func.count())
        .select_from(ImportedService)
        .where(
            ImportedService.sourceId == source.id,
            ImportedService.status.in_(["ai_extracted", "analyst_review", "draft_form"]),
        )
    ).one()
    ai_extracted = db.exec(
        select(func.count())
        .select_from(ImportedService)
        .where(
            ImportedService.sourceId == source.id,
            ImportedService.status.in_(["ai_extracted", "analyst_review", "draft_form", "published"]),
        )
    ).one()
    imported_with_slugs = db.exec(
        select(ImportedService.serviceSlug).where(
            ImportedService.sourceId == source.id,
            ImportedService.serviceSlug != None,  # noqa: E711
        )
    ).all()
    published = 0
    for slug in imported_with_slugs:
        service = db.exec(select(Service).where(Service.slug == slug)).first()
        if service and service.status == "published":
            published += 1
    return {
        "id": source.id,
        "name": source.name,
        "kind": source.kind,
        "url": _source_url(source),
        "status": source.status,
        "found": found,
        "updated": updated,
        "needsReview": needs_review,
        "aiExtracted": ai_extracted,
        "published": published,
        "lastRunAt": source.lastRunAt,
        "method": _method_label(source),
        "nextStep": _next_step(source, last_run),
    }


def _source_url(source: OfficialSource) -> str:
    if source.id == "bgov":
        return f"{source.baseUrl}/ru/services"
    return source.baseUrl


def _method_label(source: OfficialSource) -> str:
    labels = {
        "embedded_json": "Inertia data-page JSON, без браузера",
        "html_scrape": "HTML scrape с robots.txt gate",
        "rest_api": "REST API с ключом",
    }
    return labels.get(source.adapterType, source.adapterType)


def _next_step(source: OfficialSource, last_run: OfficialImportRun | None) -> str:
    if source.id != "bgov":
        return "Адаптер запланирован следующими фазами"
    if not last_run:
        return "Запустите ручной импорт"
    if last_run.status == "success":
        return "Проверить evidence и создать черновики услуг"
    return "Разобрать ошибки последнего запуска"


def _unique_slug(db: Session, base: str) -> str:
    slug = base
    i = 2
    while db.exec(select(Service).where(Service.slug == slug)).first():
        slug = f"{base}-{i}"
        i += 1
    return slug


def _description_from_payload(payload: dict) -> str:
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    raw = source.get("raw") if isinstance(source.get("raw"), dict) else {}
    description = raw.get("description") or raw.get("content") or ""
    if isinstance(description, dict):
        return ""
    return str(description or "")
