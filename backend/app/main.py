import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .config import BASE_DIR, settings
from .db import engine, init_db
from .sources.scheduler import start_scheduler, stop_scheduler
from .routers import (
    admin_applications,
    admin_integrations,
    admin_services,
    analytics,
    audit,
    ai,
    applications,
    auth,
    integrations,
    imports,
    knowledge,
    map,
    news,
    notifications,
    orgs,
    pdf_preview,
    profile,
    reports,
    services,
    stats,
)


def _seed_if_empty() -> None:
    """First boot on a fresh DB (empty volume): run the same seed scripts
    `make seed` / `make docker-seed` use, so a plain `docker compose up` is
    never left with an empty catalog/map/cabinet. No-op once any Service
    row exists — re-seeding an already-populated stand is `make seed`'s job
    (seed_services.py skips services whose slug already exists)."""
    from .models import Service

    with Session(engine) as db:
        if db.exec(select(Service)).first() is not None:
            return
    print("[startup] empty database — running seed scripts...")
    for module in ("app.seed", "app.seed_services", "app.seed_apps", "app.seed_knowledge"):
        subprocess.run([sys.executable, "-m", module], check=True, cwd=str(BASE_DIR))
    print("[startup] seed complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_if_empty()
    # Integration bus registry — seeds on any DB that predates the bus, so
    # existing stands get it without a full re-seed (Фаза 1).
    from .seed_integrations import seed_if_empty as seed_integrations

    seed_integrations()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="ЕППБ API",
    description=(
        "Единый портал поддержки бизнеса (Холдинг «Байтерек»). "
        "Публичный REST API каталога услуг, заявок и интеграций (REQ-15)."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api-docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.frontend_origin.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/storage",
    StaticFiles(directory=str(settings.upload_dir)),
    name="storage",
)

app.include_router(services.router)
app.include_router(admin_services.router)
app.include_router(analytics.router)
app.include_router(audit.router)
app.include_router(orgs.router)
app.include_router(applications.router)
app.include_router(admin_applications.router)
app.include_router(admin_integrations.router)
app.include_router(pdf_preview.router)
app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(integrations.router)
app.include_router(imports.router)
app.include_router(map.router)
app.include_router(knowledge.router)
app.include_router(news.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(profile.router)
app.include_router(stats.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "eppb-api"}
