"""Admin console for external official sources (Фаза 1.5).

Register/configure/enable внешние источники (bgov, сайты дочек, open-data) без
кода: name, baseUrl, тип, расписание, статус. `POST /{id}/test` делает реальную
проверку доступности + robots.txt, `POST /{id}/run` запускает импорт для
источников с активным адаптером. Пайплайн-разбор остаётся в /admin/imports —
здесь именно управление реестром источников.
"""

from __future__ import annotations

import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import OfficialSource, gen_id
from ..session import require_role
from ..sources.pipeline import ensure_official_sources, run_source
from ..sources.robots import USER_AGENT, RobotsGate
from ..sources.scheduler import SCHEDULABLE_ADAPTERS

router = APIRouter(
    prefix="/api/v1/admin/sources",
    tags=["admin-sources"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)

# Which adapter types the pipeline can actually crawl today. Others can be
# registered, configured and connectivity-tested, but not run yet — the UI
# marks them honestly as «адаптер в разработке».
RUNNABLE_SOURCE_IDS = {"bgov", "damu", "kaf"}

ADAPTER_TYPES = ["embedded_json", "html_scrape", "rest_api"]
KINDS = ["service_registry", "subsidiary_site", "open_data"]


def _dto(s: OfficialSource) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "baseUrl": s.baseUrl,
        "kind": s.kind,
        "adapterType": s.adapterType,
        "status": s.status,
        "scheduleCron": s.scheduleCron,
        "lastRunAt": s.lastRunAt.isoformat() if s.lastRunAt else None,
        "lastSuccessAt": s.lastSuccessAt.isoformat() if s.lastSuccessAt else None,
        "consecutiveFailures": s.consecutiveFailures,
        "runnable": s.id in RUNNABLE_SOURCE_IDS,
        "scheduled": s.adapterType in SCHEDULABLE_ADAPTERS,
    }


@router.get("")
def list_sources(db: Session = Depends(get_session)):
    ensure_official_sources(db)
    rows = db.exec(select(OfficialSource).order_by(OfficialSource.name)).all()
    return {
        "sources": [_dto(s) for s in rows],
        "adapterTypes": ADAPTER_TYPES,
        "kinds": KINDS,
    }


class SourceBody(BaseModel):
    id: str | None = None
    name: str | None = None
    baseUrl: str | None = None
    kind: str | None = None
    adapterType: str | None = None
    status: str | None = None
    scheduleCron: str | None = None


@router.post("", status_code=201)
def create_source(body: SourceBody, db: Session = Depends(get_session)):
    if not body.name or not body.baseUrl:
        raise HTTPException(400, "name и baseUrl обязательны")
    source_id = body.id or gen_id("src_")
    if db.get(OfficialSource, source_id):
        raise HTTPException(409, f"Источник '{source_id}' уже существует")
    source = OfficialSource(
        id=source_id,
        name=body.name,
        baseUrl=body.baseUrl,
        kind=body.kind or "subsidiary_site",
        adapterType=body.adapterType or "html_scrape",
        status=body.status or "planned",
        scheduleCron=body.scheduleCron or "0 */6 * * *",
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return _dto(source)


@router.patch("/{source_id}")
def update_source(source_id: str, body: SourceBody, db: Session = Depends(get_session)):
    source = db.get(OfficialSource, source_id)
    if not source:
        raise HTTPException(404, "Источник не найден")
    for key, value in body.model_dump(exclude_none=True, exclude={"id"}).items():
        setattr(source, key, value)
    db.add(source)
    db.commit()
    db.refresh(source)
    return _dto(source)


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: str, db: Session = Depends(get_session)):
    source = db.get(OfficialSource, source_id)
    if not source:
        raise HTTPException(404, "Источник не найден")
    db.delete(source)
    db.commit()


@router.post("/{source_id}/test")
def test_source(source_id: str, db: Session = Depends(get_session)):
    """Реальная проверка доступности источника + robots.txt. Ничего не
    импортирует — только подтверждает, что источник достижим и краулинг разрешён."""
    source = db.get(OfficialSource, source_id)
    if not source:
        raise HTTPException(404, "Источник не найден")

    started = time.perf_counter()
    result: dict = {
        "reachable": False,
        "statusCode": None,
        "latencyMs": None,
        "contentType": None,
        "robotsAllowed": None,
        "crawlDelay": None,
        "error": None,
    }
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            resp = client.get(source.baseUrl, headers={"User-Agent": USER_AGENT})
            result["statusCode"] = resp.status_code
            result["reachable"] = resp.status_code < 500
            result["contentType"] = resp.headers.get("content-type", "").split(";")[0] or None
            try:
                robots = RobotsGate(client).check(source.baseUrl, source.baseUrl)
                result["robotsAllowed"] = robots.allowed
                result["crawlDelay"] = robots.crawl_delay
            except Exception:  # noqa: BLE001 — robots is best-effort
                result["robotsAllowed"] = None
    except Exception as exc:  # noqa: BLE001 — normalise transport errors for the UI
        result["error"] = str(exc)
    result["latencyMs"] = round((time.perf_counter() - started) * 1000)
    return result


@router.post("/{source_id}/run")
def run_source_now(source_id: str, db: Session = Depends(get_session)):
    """Запустить импорт вне расписания. Доступно для источников с активным
    адаптером; остальные честно возвращают 400 «адаптер в разработке»."""
    source = db.get(OfficialSource, source_id)
    if not source:
        raise HTTPException(404, "Источник не найден")
    try:
        run = run_source(db, source_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "runId": run.id,
        "status": run.status,
        "found": run.found,
        "changed": run.changed,
        "finishedAt": run.finishedAt.isoformat() if run.finishedAt else None,
    }
