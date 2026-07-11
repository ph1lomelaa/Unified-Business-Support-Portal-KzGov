"""Periodic execution of official-source imports.

Runs each ready adapter on its own `OfficialSource.scheduleCron` in a
background thread, so a slow/blocked external site never stalls the API's
asyncio event loop. `POST /admin/imports/{id}/run` remains available for an
immediate out-of-schedule run from the admin UI.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import Session, select

from ..db import engine
from ..models import OfficialSource
from .pipeline import ensure_official_sources, run_source

logger = logging.getLogger("eppb.scheduler")

_scheduler: BackgroundScheduler | None = None

# Only sources with a real adapter — scheduling a "planned" source would just
# fail on every tick (run_source() rejects anything but bgov today).
SCHEDULABLE_ADAPTERS = {"embedded_json"}


def _run_job(source_id: str) -> None:
    with Session(engine) as db:
        try:
            run = run_source(db, source_id)
            logger.info(
                "scheduled import %s: status=%s found=%s changed=%s",
                source_id,
                run.status,
                run.found,
                run.changed,
            )
        except Exception:
            logger.exception("scheduled import %s failed", source_id)


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    with Session(engine) as db:
        ensure_official_sources(db)
        sources = db.exec(select(OfficialSource)).all()

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduled = 0
    for source in sources:
        if source.adapterType not in SCHEDULABLE_ADAPTERS:
            continue
        scheduler.add_job(
            _run_job,
            CronTrigger.from_crontab(source.scheduleCron),
            args=[source.id],
            id=f"import-{source.id}",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scheduled += 1
    scheduler.start()
    _scheduler = scheduler
    logger.info("import scheduler started with %d job(s)", scheduled)
    return scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
