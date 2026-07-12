from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from time import sleep

import httpx
from sqlalchemy import case
from sqlmodel import Session, select

from ..ai.generate import AiError, generate_application_example, generate_service
from ..config import settings
from ..models import (
    ExtractedEvidence,
    ImportedService,
    OfficialImportRun,
    OfficialSource,
    Organization,
    RawDocument,
    Service,
)
from ..slugify import slugify
from .bgov import cards_from_page, draft_payload, parse_data_page, parse_materials, services_url
from .html_scrape import HtmlScrapeAdapter, HtmlServiceCandidate, KafSubsidyAdapter
from .robots import USER_AGENT, RobotsGate

SOURCE_SEEDS = [
    {
        "id": "bgov",
        "name": "bgov.kz",
        "baseUrl": "https://bgov.kz",
        "kind": "service_registry",
        "adapterType": "embedded_json",
        "status": "ready",
        "scheduleCron": "0 */6 * * *",
    },
    {
        "id": "damu",
        "name": "Даму: программы поддержки",
        "baseUrl": "https://damu.kz",
        "kind": "subsidiary_site",
        "adapterType": "html_scrape",
        "status": "ready",
        "scheduleCron": "0 */12 * * *",
    },
    {
        "id": "kaf",
        "name": "КазАгроФинанс: субсидии",
        "baseUrl": "https://kaf.kz",
        "kind": "subsidiary_site",
        "adapterType": "html_scrape",
        "status": "ready",
        "scheduleCron": "0 */12 * * *",
    },
    {
        "id": "data-egov",
        "name": "data.egov.kz",
        "baseUrl": "https://data.egov.kz",
        "kind": "open_data",
        "adapterType": "rest_api",
        "status": "planned",
        "scheduleCron": "0 4 * * *",
    },
]

ORG_CODE_MAP = {
    "damu": "damu",
    "brk": "brk",
    "kazakhexport": "kazakhexport",
    "kaf": "kaf",
    "qic": "qic",
    "otbasy": "otbasy",
    "idfrk": "frp",
    "frp": "frp",
    "akk": "akk",
    "agrocredit": "akk",
    "baiterek": "baiterek",
}

ORG_NAME_MAP = {
    "даму": "damu",
    "банк развития казахстана": "brk",
    "экспортно-кредитное агентство": "kazakhexport",
    "kazakhexport": "kazakhexport",
    "фонд развития промышленности": "frp",
    "аграрная кредитная корпорация": "akk",
    "казагрофинанс": "kaf",
    "отбасы": "otbasy",
    "qazaqstan investment corporation": "qic",
    "байтерек": "baiterek",
    "казахстанская жилищная компания": "kzhk",
}

PIPELINE_STAGES = [
    {"id": "imported", "label": "Импортировано", "description": "Карточка и источник получены"},
    {"id": "normalized", "label": "Нормализовано", "description": "Организация, категория, язык и ссылки сопоставлены"},
    {"id": "ai_extracted", "label": "AI-извлечение", "description": "Условия, документы и правила извлечены из текста"},
    {"id": "analyst_review", "label": "Проверка аналитика", "description": "Ответственный сотрудник сверяет evidence"},
    {"id": "draft_form", "label": "Черновик формы", "description": "Схема формы готова в конструкторе"},
    {"id": "published", "label": "Опубликовано", "description": "Услуга доступна предпринимателю"},
]


def ensure_official_sources(db: Session) -> None:
    # Seed missing sources only — never overwrite existing rows, so admin edits
    # in the «Источники» console (baseUrl, schedule, status, ...) persist and are
    # not reverted to the code seed on the next call (Фаза 1.5, no-code).
    changed = False
    for row in SOURCE_SEEDS:
        if db.get(OfficialSource, row["id"]) is None:
            db.add(OfficialSource(**row))
            changed = True
    if changed:
        db.commit()


def run_source(db: Session, source_id: str) -> OfficialImportRun:
    ensure_official_sources(db)
    source = db.get(OfficialSource, source_id)
    if not source:
        raise ValueError("Источник не найден")
    if source.id == "bgov":
        return run_bgov(db, source)
    if source.id == "damu":
        adapter = HtmlScrapeAdapter(
            source_id="damu",
            organization="Даму",
            listing_url=(
                "https://damu.kz/bitrix/templates/Corp_Damu_copy/ajax/"
                "load_programs.php?TAB=all&REGION=&OKED=&SUM=&lang=kz"
            ),
            block_class="program-card",
            title_tags={"h5"},
        )
        return run_html_source(db, source, adapter)
    if source.id == "kaf":
        return run_html_source(db, source, KafSubsidyAdapter())
    raise ValueError("Для источника пока нет активного адаптера")


def run_bgov(db: Session, source: OfficialSource) -> OfficialImportRun:
    run = OfficialImportRun(sourceId=source.id, startedAt=utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    found = 0
    changed = 0
    skipped = 0
    errors: list[str] = []

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        gate = RobotsGate(client)
        try:
            first_html, first_url, robots = fetch_allowed(client, gate, source.baseUrl, services_url(source.baseUrl))
            source.robotsSnapshot = {
                "url": robots.robots_url,
                "raw": robots.raw,
                "crawlDelay": robots.crawl_delay,
                "checkedAt": utcnow().isoformat(),
            }
            cards, last_page = cards_from_page(parse_data_page(first_html), source.baseUrl)
            found += len(cards)
            changed += persist_cards(db, client, gate, source, cards)
            sleep(robots.crawl_delay)
            for page in range(2, last_page + 1):
                url = services_url(source.baseUrl, page)
                try:
                    html_text, _, robots = fetch_allowed(client, gate, source.baseUrl, url)
                except PermissionError:
                    skipped += 1
                    continue
                cards, _ = cards_from_page(parse_data_page(html_text), source.baseUrl)
                found += len(cards)
                changed += persist_cards(db, client, gate, source, cards)
                sleep(robots.crawl_delay)
        except Exception as exc:
            errors.append(str(exc))

    run.finishedAt = utcnow()
    run.found = found
    run.changed = changed
    run.skippedRobots = skipped
    run.errors = errors
    run.status = "failed" if errors and found == 0 else "partial" if errors or skipped else "success"
    source.lastRunAt = run.startedAt
    if run.status in {"success", "partial"} and found:
        source.lastSuccessAt = run.finishedAt
        source.consecutiveFailures = 0
        source.status = "ready"
    else:
        source.consecutiveFailures += 1
        source.status = "degraded"
    db.add(run)
    db.add(source)
    db.commit()
    db.refresh(run)
    return run


def run_html_source(
    db: Session, source: OfficialSource, adapter: HtmlScrapeAdapter
) -> OfficialImportRun:
    run = OfficialImportRun(sourceId=source.id, startedAt=utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    found = changed = skipped = 0
    errors: list[str] = []
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        gate = RobotsGate(client)
        try:
            html, _, robots = fetch_allowed(client, gate, source.baseUrl, adapter.listing_url)
            source.robotsSnapshot = {
                "url": robots.robots_url,
                "raw": robots.raw,
                "crawlDelay": robots.crawl_delay,
                "checkedAt": utcnow().isoformat(),
            }
            candidates = adapter.extract(html)
            found = len(candidates)
            changed = persist_html_candidates(db, source, candidates)
        except PermissionError:
            skipped = 1
        except Exception as exc:
            errors.append(str(exc))

    run.finishedAt = utcnow()
    run.found = found
    run.changed = changed
    run.skippedRobots = skipped
    run.errors = errors
    run.status = "failed" if errors and found == 0 else "partial" if errors or skipped else "success"
    source.lastRunAt = run.startedAt
    if run.status in {"success", "partial"} and found:
        source.lastSuccessAt = run.finishedAt
        source.consecutiveFailures = 0
        source.status = "ready"
    else:
        source.consecutiveFailures += 1
        source.status = "degraded"
    db.add(run)
    db.add(source)
    db.commit()
    db.refresh(run)
    return run


def fetch_allowed(
    client: httpx.Client, gate: RobotsGate, base_url: str, url: str
) -> tuple[str, str, object]:
    robots = gate.check(base_url, url)
    if not robots.allowed:
        raise PermissionError(f"robots.txt запрещает {url}")
    response = client.get(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    response.raise_for_status()
    return response.text, str(response.url), robots


def persist_cards(db: Session, client: httpx.Client, gate: RobotsGate, source: OfficialSource, cards) -> int:
    changed = 0
    orgs = {org.id: org for org in db.exec(select(Organization)).all()}
    for card in cards:
        org_id = map_org_id(card, orgs)
        if org_id is None:
            # Not one of our institutions (bgov.kz also lists third-party
            # operators like "MITWORK") — only import real Baiterek-group data.
            continue

        raw_text = card.text.strip()
        content_hash = sha256(raw_text)
        latest = db.exec(
            select(RawDocument)
            .where(RawDocument.sourceId == source.id, RawDocument.url == card.url)
            .order_by(RawDocument.fetchedAt.desc())
        ).first()
        existing_import = db.exec(
            select(ImportedService)
            .where(ImportedService.sourceId == source.id, ImportedService.sourceUrl == card.url)
            .order_by(ImportedService.updatedAt.desc())
        ).first()
        if latest and latest.contentHash == content_hash:
            if existing_import and existing_import.orgId != org_id:
                existing_import.orgId = org_id
                existing_import.updatedAt = utcnow()
                db.add(existing_import)
            if existing_import and not (existing_import.draftPayload or {}).get("applicationExample"):
                payload = existing_import.draftPayload or {}
                _attach_application_example(payload)
                existing_import.draftPayload = payload
                existing_import.updatedAt = utcnow()
                db.add(existing_import)
            continue

        # Only the detail page has the real file attachments — fetch it just
        # for new/changed cards, not on every unchanged re-run.
        try:
            detail_html, _, detail_robots = fetch_allowed(client, gate, source.baseUrl, card.url)
            card.materials = parse_materials(parse_data_page(detail_html))
            sleep(detail_robots.crawl_delay)
        except (PermissionError, httpx.HTTPError, ValueError):
            card.materials = []

        raw_ref = write_raw_text(source.id, card.url, raw_text, content_hash)
        raw = RawDocument(
            sourceId=source.id,
            url=card.url,
            fetchedAt=utcnow(),
            contentHash=content_hash,
            rawTextRef=raw_ref,
        )
        db.add(raw)
        db.flush()

        payload, status, confidence = extract_payload(card)
        imported = ImportedService(
            sourceId=source.id,
            docId=raw.id,
            orgId=org_id,
            serviceSlug=existing_import.serviceSlug if existing_import else None,
            title=card.title,
            sourceUrl=card.url,
            status=status,
            confidence=confidence,
            draftPayload=payload,
            supersedesId=existing_import.id if existing_import and existing_import.serviceSlug else None,
            updatedAt=utcnow(),
        )
        db.add(imported)
        db.flush()
        for item in card.evidence or payload_evidence(payload):
            db.add(
                ExtractedEvidence(
                    importedServiceId=imported.id,
                    kind=item.get("kind") or "rule",
                    label=item.get("label") or item.get("rule") or "Правило",
                    value=item.get("value") or item.get("rule") or "",
                    sourceQuote=item.get("sourceQuote") or item.get("source_quote") or "",
                    mappedTo=item.get("mappedTo") or "draftPayload.extracted_rules",
                    confidence=float(item.get("confidence") or confidence),
                )
            )
        changed += 1
    db.commit()
    return changed


def persist_html_candidates(
    db: Session, source: OfficialSource, candidates: list[HtmlServiceCandidate]
) -> int:
    orgs = {org.id: org for org in db.exec(select(Organization)).all()}
    changed = 0
    for candidate in candidates:
        content_hash = sha256(candidate.text)
        latest = db.exec(
            select(RawDocument)
            .where(RawDocument.sourceId == source.id, RawDocument.url == candidate.url)
            .order_by(RawDocument.fetchedAt.desc())
        ).first()
        existing = db.exec(
            select(ImportedService)
            .where(ImportedService.sourceId == source.id, ImportedService.sourceUrl == candidate.url)
            .order_by(ImportedService.updatedAt.desc())
        ).first()
        if latest and latest.contentHash == content_hash:
            continue

        raw = RawDocument(
            sourceId=source.id,
            url=candidate.url,
            fetchedAt=utcnow(),
            contentHash=content_hash,
            rawTextRef=write_raw_text(source.id, candidate.url, candidate.text, content_hash),
        )
        db.add(raw)
        db.flush()
        payload, status, confidence = extract_html_payload(candidate)
        imported = ImportedService(
            sourceId=source.id,
            docId=raw.id,
            orgId=ORG_NAME_MAP.get(candidate.organization.lower()) if candidate.organization.lower() in ORG_NAME_MAP else ("damu" if source.id == "damu" and "damu" in orgs else None),
            serviceSlug=existing.serviceSlug if existing else None,
            title=candidate.title,
            sourceUrl=candidate.url,
            status=status,
            confidence=confidence,
            draftPayload=payload,
            supersedesId=existing.id if existing and existing.serviceSlug else None,
            updatedAt=utcnow(),
        )
        db.add(imported)
        db.flush()
        for item in payload_evidence(payload):
            db.add(
                ExtractedEvidence(
                    importedServiceId=imported.id,
                    kind=item["kind"],
                    label=item["label"],
                    value=item["value"],
                    sourceQuote=item["sourceQuote"],
                    mappedTo=item["mappedTo"],
                    confidence=float(item["confidence"]),
                )
            )
        changed += 1
    db.commit()
    return changed


def map_org_id(card, orgs: dict[str, Organization]) -> str | None:
    org_id = ORG_CODE_MAP.get((card.org_code or "").lower())
    if org_id in orgs:
        return org_id
    name = (card.org_name or "").lower()
    for needle, mapped in ORG_NAME_MAP.items():
        if needle in name and mapped in orgs:
            return mapped
    return None


def extract_payload(card) -> tuple[dict, str, float]:
    # card.conditions/description/materials come straight from bgov's own
    # structured data (not a guess) — always ground the payload in that, and
    # only use the AI generator to fill in a richer form schema on top.
    base = draft_payload(card)
    try:
        generated = generate_service(card.text)
        base["form"] = generated.get("form", base["form"])
        base["extracted_rules"] = generated.get("extracted_rules", base["extracted_rules"])
        confidence = 0.9
    except AiError:
        confidence = 0.85
    base["source"] = {"url": card.url, "organization": card.org_name, "raw": card.raw}
    _attach_application_example(base)
    return base, "ai_extracted", confidence


def extract_html_payload(candidate: HtmlServiceCandidate) -> tuple[dict, str, float]:
    try:
        payload = generate_service(candidate.text)
        confidence = 0.76
        status = "ai_extracted"
    except AiError:
        payload = {
            "card": {
                "title": candidate.title,
                "summary": candidate.text[:420],
                "category": "subsidy",
                "conditions": [],
                "documents": [],
            },
            "form": {"pages": []},
            "extracted_rules": [],
        }
        confidence = 0.5
        status = "imported"
    payload["source"] = {
        "url": candidate.url,
        "organization": candidate.organization,
        "raw": {"content": candidate.text},
    }
    _attach_application_example(payload)
    return payload, status, confidence


def _attach_application_example(payload: dict) -> None:
    form = payload.get("form") if isinstance(payload.get("form"), dict) else {}
    try:
        payload["applicationExample"] = generate_application_example(form)
    except AiError:
        payload["applicationExample"] = _fallback_application_example(form)


def _fallback_application_example(form: dict) -> dict:
    answers: list[dict] = []
    for page in form.get("pages", []):
        for field in page.get("elements", []) if isinstance(page, dict) else []:
            if not isinstance(field, dict) or not field.get("name"):
                continue
            field_type = field.get("type")
            value = "Пример документа.pdf" if field_type == "file" else "Тестовое значение"
            if field_type == "boolean":
                value = "Да"
            answers.append({"name": field["name"], "label": field.get("title") or field["name"], "value": value})
    return {"summary": "Шаблон примера: AI-генерация недоступна", "answers": answers}


def payload_evidence(payload: dict) -> list[dict]:
    return [
        {
            "kind": "rule",
            "label": item.get("rule", "Правило"),
            "value": item.get("rule", ""),
            "sourceQuote": item.get("source_quote", ""),
            "mappedTo": "draftPayload.extracted_rules",
            "confidence": 0.68,
        }
        for item in payload.get("extracted_rules", [])
        if isinstance(item, dict)
    ]


def write_raw_text(source_id: str, url: str, text: str, content_hash: str) -> str:
    directory = Path(settings.upload_dir) / "imports" / source_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{content_hash}.json"
    path.write_text(
        json.dumps({"url": url, "fetchedAt": utcnow().isoformat(), "text": text}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return str(path.relative_to(settings.upload_dir))


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def imported_service_to_public(db: Session, item: ImportedService) -> dict:
    org = db.get(Organization, item.orgId) if item.orgId else None
    service = (
        db.exec(select(Service).where(Service.slug == item.serviceSlug)).first()
        if item.serviceSlug
        else None
    )
    # Документы показываем первым блоком (сверху), затем остальные доказательства.
    evidence = db.exec(
        select(ExtractedEvidence)
        .where(ExtractedEvidence.importedServiceId == item.id)
        .order_by(case((ExtractedEvidence.kind == "document", 0), else_=1))
    ).all()
    payload = item.draftPayload or {}
    coverage = {
        "card": bool(payload.get("card")),
        "conditions": bool((payload.get("card") or {}).get("conditions")),
        "documents": bool((payload.get("card") or {}).get("documents")),
        "materials": bool((payload.get("card") or {}).get("materials")),
        "formDraft": bool(item.serviceSlug or payload.get("form")),
        "published": bool(service and service.status == "published"),
    }
    return {
        "id": item.id,
        "sourceId": item.sourceId,
        "serviceId": service.id if service else "",
        "serviceSlug": item.serviceSlug or "",
        "title": item.title,
        "organization": org.shortName if org else (payload.get("source") or {}).get("organization") or "Не сопоставлено",
        "sourceUrl": item.sourceUrl,
        "status": item.status,
        "confidence": item.confidence,
        "updatedAt": item.updatedAt,
        "coverage": coverage,
        "form": payload.get("form") if isinstance(payload.get("form"), dict) else {"pages": []},
        "applicationExample": payload.get("applicationExample") if isinstance(payload.get("applicationExample"), dict) else {"summary": "Пример пока не сформирован", "answers": []},
        "evidence": [
            {
                "kind": ev.kind,
                "label": ev.label,
                "value": ev.value,
                "sourceQuote": ev.sourceQuote,
                "mappedTo": ev.mappedTo,
                "confidence": ev.confidence,
            }
            for ev in evidence
        ],
    }
