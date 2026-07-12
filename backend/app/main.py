import subprocess
import sys
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlmodel import Session, select

from .config import BASE_DIR, settings
from .db import engine, init_db
from .sources.scheduler import start_scheduler, stop_scheduler
from .routers import (
    admin_applications,
    admin_calculators,
    admin_dictionaries,
    admin_integrations,
    admin_knowledge,
    admin_projects,
    admin_reports,
    admin_services,
    admin_sources,
    admin_statuses,
    analytics,
    audit,
    ai,
    applications,
    auth,
    calculators,
    dictionaries,
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
    # Reference dictionaries (справочники) — no-code entity for constructor
    # dropdowns; seeds on any DB that predates it (Фаза 2).
    from .seed_dictionaries import seed_if_empty as seed_dictionaries

    seed_dictionaries()
    # No-code content entities: reports, projects, calculators, statuses (Фаза 4).
    from .seed_content import seed_if_empty as seed_content

    seed_content()
    # Load the (now-seeded) status config into the in-memory cache so the
    # application workflow is driven by the editable registry.
    from .status import load_status_config

    with Session(engine) as _db:
        load_status_config(_db)
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


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:  # noqa: BLE001 — never expose internal tracebacks to API clients
        response = JSONResponse(
            status_code=500,
            content={
                "detail": "Внутренняя ошибка сервиса",
                "error": {
                    "code": "internal_error",
                    "message": "Внутренняя ошибка сервиса",
                    "requestId": request_id,
                },
            },
        )
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    request_id = getattr(request.state, "request_id", "")
    message = exc.detail
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "detail": message,
            "error": {
                "code": f"http_{exc.status_code}",
                "message": message if isinstance(message, str) else "Ошибка запроса",
                "requestId": request_id,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "")
    details = exc.errors()
    return JSONResponse(
        status_code=422,
        content={
            "detail": details,
            "error": {
                "code": "validation_error",
                "message": "Проверьте заполнение полей",
                "requestId": request_id,
                "details": details,
            },
        },
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
app.include_router(admin_knowledge.router)
app.include_router(admin_dictionaries.router)
app.include_router(admin_sources.router)
app.include_router(admin_reports.router)
app.include_router(admin_projects.router)
app.include_router(admin_calculators.router)
app.include_router(admin_statuses.router)
app.include_router(dictionaries.router)
app.include_router(calculators.router)
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
