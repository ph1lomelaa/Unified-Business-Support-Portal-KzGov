"""Applications: draft, autosave, submit (-> PDF + event + notification),
detail, list, PDF preview/serve (spec Части 4.4, 5).

Wizard flow: create draft -> PATCH answers (autosave) -> submit. On submit we
snapshot the active form schema, generate the PDF, move to `submitted`, and
create an ApplicationEvent + Notification.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import Response as FastResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..integration import bus
from ..calc_eval import FormulaError, compute_schema_expressions

from ..db import get_session
from ..models import (
    Application,
    ApplicationEvent,
    Company,
    FormSchema,
    Notification,
    Organization,
    Service,
)
from ..pdf.generator import render_application_pdf
from ..schema_stages import has_stage2, split_schema_by_stage
from ..session import require_owner_or_admin, require_user
from ..status import status_label

router = APIRouter(prefix="/api/v1/applications", tags=["applications"])

YEAR = 2026
NUMBER_RE = re.compile(r"EPPB-\d{4}-(\d+)")


def _next_number(db: Session) -> str:
    rows = db.exec(select(Application.number)).all()
    max_seq = 123
    for n in rows:
        m = NUMBER_RE.match(n or "")
        if m:
            max_seq = max(max_seq, int(m.group(1)))
    return f"EPPB-{YEAR}-{max_seq + 1:06d}"


def _active_schema(db: Session, service_id: str) -> dict:
    fs = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()
    return fs.schema if fs else {"pages": []}




def _company_dict(c: Company | None) -> dict:
    if not c:
        return {}
    return {
        "name": c.name, "bin": c.bin, "director": c.director,
        "address": c.address, "region": c.region, "form": c.form,
    }


# ---------- bodies ----------
class CreateBody(BaseModel):
    serviceId: str
    companyBin: str
    answers: dict = {}


class AutosaveBody(BaseModel):
    answers: dict | None = None
    calc: dict | None = None


class SubmitBody(BaseModel):
    answers: dict = {}
    calc: dict = {}
    consents: list[bool] = []
    signedBy: str | None = None


# ---------- endpoints ----------
@router.post("", status_code=201)
def create_draft(
    body: CreateBody,
    request: Request,
    db: Session = Depends(get_session),
):
    user = require_user(request)
    if user.role == "entrepreneur" and body.companyBin != user.bin:
        raise HTTPException(403, "Нельзя создать заявку для другого БИН")
    service = db.get(Service, body.serviceId)
    if not service:
        raise HTTPException(404, "Услуга не найдена")
    if user.role == "analyst" and user.orgId != service.orgId:
        raise HTTPException(403, "Аналитик может создавать заявки только по своей организации")
    app = Application(
        number=_next_number(db),
        serviceId=body.serviceId,
        companyBin=body.companyBin,
        status="draft",
        answers=body.answers or {},
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return {"id": app.id, "number": app.number, "status": app.status}


@router.patch("/{app_id}")
def autosave(
    app_id: str,
    body: AutosaveBody,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    if app.status not in ("draft", "needs_changes"):
        # keep autosave read-only once submitted
        return {"savedAt": app.updatedAt}
    if body.answers is not None:
        app.answers = body.answers
    if body.calc is not None:
        app.calc = body.calc
    app.updatedAt = datetime.now(timezone.utc)
    db.add(app)
    db.commit()
    return {"savedAt": app.updatedAt}


@router.post("/{app_id}/submit")
def submit(
    app_id: str,
    body: SubmitBody,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    if app.status not in ("draft", "needs_changes"):
        raise HTTPException(409, "Заявка уже подана")
    if len(body.consents) < 2 or not all(body.consents):
        raise HTTPException(400, "Необходимо принять все согласия")

    service = db.get(Service, app.serviceId)
    org = db.get(Organization, service.orgId) if service else None
    company = db.get(Company, app.companyBin)

    app.answers = body.answers or app.answers
    app.schemaSnapshot = _active_schema(db, app.serviceId)
    try:
        app.calc = compute_schema_expressions(app.schemaSnapshot, app.answers)
    except FormulaError as exc:
        raise HTTPException(422, f"Ошибка автоматического расчёта: {exc}") from exc

    pdf = render_application_pdf(
        app_number=app.number,
        app_date=datetime.now().strftime("%d.%m.%Y"),
        service_title=service.title if service else "",
        org_name=org.name if org else "",
        company=_company_dict(company),
        answers=app.answers,
        calc=app.calc,
        doc_template=service.docTemplate if service else "",
        signed_by=body.signedBy or (company.director if company else None),
    )
    from ..config import settings

    pdf_path = settings.upload_dir / f"{app.number}.pdf"
    pdf_path.write_bytes(pdf)
    app.pdfUrl = f"/storage/{app.number}.pdf"

    app.status = "submitted"
    app.updatedAt = datetime.now(timezone.utc)
    db.add(app)
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus="draft", toStatus="submitted",
            actor="client", comment=None,
        )
    )

    multistage = has_stage2(app.schemaSnapshot)
    if multistage:
        # Услуга многоэтапная: первичная заявка принята, но нужны расширенные
        # данные/документы (этап 2), прежде чем уйти на рассмотрение.
        db.add(
            ApplicationEvent(
                appId=app.id, fromStatus="submitted",
                toStatus="stage2_required", actor="system",
            )
        )
        app.status = "stage2_required"
        notif_title = f"Заявка {app.number}: нужны дополнительные сведения"
        notif_body = (
            f"Первичная заявка «{service.title if service else ''}» принята. "
            "Для продолжения предоставьте расширенные сведения и документы."
        )
    else:
        # move to in_review immediately (queue) — realistic + gives SLA start
        db.add(
            ApplicationEvent(
                appId=app.id, fromStatus="submitted", toStatus="in_review",
                actor="system",
            )
        )
        app.status = "in_review"
        notif_title = f"Заявка {app.number} подана"
        notif_body = (
            f"«{service.title if service else ''}» принята на рассмотрение. "
            f"Решение до {_due_hint(service)}."
        )
    if company:
        db.add(
            Notification(
                userBin=company.bin, title=notif_title, body=notif_body,
                appId=app.id, kind="status",
            )
        )
    db.commit()
    db.refresh(app)

    # Route the accepted application into the dochka BPM through the ЕИШ bus.
    # Idempotency-key guarantees a resubmit never double-routes; the exchange
    # is recorded in the integration outbox (admin console → Последние обмены).
    bus.call(
        db,
        "holding-esb",
        "application.submit",
        {
            "applicationNumber": app.number,
            "service": service.slug if service else None,
            "org": service.orgId if service else None,
            "stage": "stage2_required" if multistage else "initial",
        },
        idempotency_key=f"app-{app.number}-v1",
        application=app.number,
    )

    return {
        "id": app.id,
        "number": app.number,
        "status": app.status,
        "statusLabel": status_label(app.status),
        "multistage": multistage,
        "pdfUrl": app.pdfUrl,
        "reviewDays": service.reviewDays if service else 5,
    }


def _due_hint(service: Service | None) -> str:
    from ..status import add_working_days

    days = service.reviewDays if service else 5
    return add_working_days(datetime.now().date(), days).strftime("%d.%m.%Y")


@router.get("/documents")
def list_documents(request: Request, db: Session = Depends(get_session)):
    user = require_user(request)
    if not user or not user.bin:
        raise HTTPException(401, "Требуется вход предпринимателя")
    stmt = select(Application, Service, Organization).join(
        Service, Application.serviceId == Service.id, isouter=True
    ).join(Organization, Service.orgId == Organization.id, isouter=True)
    stmt = stmt.where(Application.companyBin == user.bin)
    rows = db.exec(stmt.order_by(Application.updatedAt.desc())).all()

    docs = []
    for app, service, org in rows:
        base = {
            "appId": app.id,
            "appNumber": app.number,
            "appStatus": app.status,
            "serviceTitle": service.title if service else "Заявка",
            "orgName": org.shortName if org else "",
        }
        if app.pdfUrl:
            docs.append({
                **base,
                "id": f"{app.id}:pdf",
                "name": f"Заявление {app.number}.pdf",
                "type": "Заявление",
                "uploadedAt": app.updatedAt,
                "url": f"/api/v1/applications/{app.id}/pdf",
                "source": "system",
            })
        for i, file in enumerate(app.files or []):
            docs.append({
                **base,
                "id": f"{app.id}:file:{i}",
                "name": file.get("name") or "Файл",
                "type": "Загруженный файл",
                "uploadedAt": file.get("uploadedAt") or app.updatedAt,
                "url": file.get("url") or "",
                "source": "client",
            })
    return docs


@router.get("/history")
def list_history(request: Request, db: Session = Depends(get_session)):
    user = require_user(request)
    if not user or not user.bin:
        raise HTTPException(401, "Требуется вход предпринимателя")
    stmt = select(ApplicationEvent, Application, Service).join(
        Application, ApplicationEvent.appId == Application.id
    ).join(Service, Application.serviceId == Service.id, isouter=True)
    stmt = stmt.where(Application.companyBin == user.bin)
    rows = db.exec(stmt.order_by(ApplicationEvent.createdAt.desc())).all()
    return [
        {
            "id": event.id,
            "appId": app.id,
            "appNumber": app.number,
            "serviceTitle": service.title if service else "Заявка",
            "fromStatus": event.fromStatus,
            "toStatus": event.toStatus,
            "toLabel": status_label(event.toStatus),
            "actor": event.actor,
            "comment": event.comment,
            "createdAt": event.createdAt,
        }
        for event, app, service in rows
    ]


@router.get("/{app_id}")
def get_application(
    app_id: str,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    service = db.get(Service, app.serviceId)
    org = db.get(Organization, service.orgId) if service else None
    company = db.get(Company, app.companyBin)
    events = db.exec(
        select(ApplicationEvent)
        .where(ApplicationEvent.appId == app.id)
        .order_by(ApplicationEvent.createdAt)
    ).all()
    sla = None
    from datetime import timezone as _tz

    from ..status import STATUS, sla_progress

    sla_days = STATUS.get(app.status).sla if STATUS.get(app.status) else None
    sub = next((e for e in events if e.toStatus == "submitted"), None)
    if sla_days and sub:
        ts = sub.createdAt
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=_tz.utc)
        sla = sla_progress(ts, sla_days)
    schema = app.schemaSnapshot or _active_schema(db, app.serviceId)
    _stage1, stage2_pages = split_schema_by_stage(schema)
    stage2 = {
        "pages": stage2_pages,
        "pending": app.status == "stage2_required",
    } if stage2_pages else None
    return {
        "id": app.id,
        "number": app.number,
        "status": app.status,
        "statusLabel": status_label(app.status),
        "sla": sla,
        "stage2": stage2,
        "answers": app.answers,
        "calc": app.calc,
        "pdfUrl": app.pdfUrl,
        "files": app.files,
        "createdAt": app.createdAt,
        "updatedAt": app.updatedAt,
        "schema": schema,
        "service": {
            "id": service.id, "slug": service.slug, "title": service.title,
            "reviewDays": service.reviewDays, "category": service.category,
        } if service else None,
        "org": {"id": org.id, "shortName": org.shortName, "name": org.name, "color": org.color, "logo": org.logo or None}
        if org else None,
        "company": _company_dict(company),
        "events": [
            {
                "id": e.id, "fromStatus": e.fromStatus, "toStatus": e.toStatus,
                "toLabel": status_label(e.toStatus), "comment": e.comment,
                "actor": e.actor, "createdAt": e.createdAt,
            }
            for e in events
        ],
    }


@router.get("")
def list_applications(request: Request, db: Session = Depends(get_session)):
    user = require_user(request)
    stmt = select(Application, Service, Organization).join(
        Service, Application.serviceId == Service.id, isouter=True
    ).join(Organization, Service.orgId == Organization.id, isouter=True)
    if user.role == "entrepreneur" and user.bin:
        stmt = stmt.where(Application.companyBin == user.bin)
    elif user.role == "analyst" and user.orgId:
        stmt = stmt.where(Service.orgId == user.orgId)
    elif user.role == "analyst":
        return []
    rows = db.exec(stmt.order_by(Application.updatedAt.desc())).all()
    return [
        {
            "id": a.id, "number": a.number, "status": a.status,
            "statusLabel": status_label(a.status),
            "createdAt": a.createdAt, "updatedAt": a.updatedAt,
            "service": {"title": s.title, "slug": s.slug, "reviewDays": s.reviewDays}
            if s else None,
            "org": {"shortName": o.shortName, "name": o.name, "color": o.color, "logo": o.logo or None}
            if o else None,
        }
        for (a, s, o) in rows
    ]


@router.get("/{app_id}/pdf")
def serve_pdf(
    app_id: str,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app or not app.pdfUrl:
        raise HTTPException(404, "PDF не найден")
    from ..config import settings

    path = settings.upload_dir / f"{app.number}.pdf"
    if not path.exists():
        raise HTTPException(404, "PDF не найден")
    return FastResponse(
        path.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{app.number}.pdf"'},
    )


class ResubmitBody(BaseModel):
    answers: dict | None = None
    comment: str | None = None


@router.post("/{app_id}/resubmit")
def resubmit(
    app_id: str,
    body: ResubmitBody,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    if app.status != "needs_changes":
        raise HTTPException(409, "Повторная отправка доступна только на доработке")
    if body.answers is not None:
        app.answers = body.answers
    app.updatedAt = datetime.now(timezone.utc)
    app.status = "resubmitted"
    db.add(app)
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus="needs_changes", toStatus="resubmitted",
            actor="client", comment=body.comment,
        )
    )
    # back into the review queue
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus="resubmitted", toStatus="in_review", actor="system"
        )
    )
    app.status = "in_review"
    db.commit()
    db.refresh(app)
    return {"status": app.status, "statusLabel": status_label(app.status)}


class Stage2Body(BaseModel):
    answers: dict = {}
    calc: dict | None = None
    signedBy: str | None = None


@router.post("/{app_id}/stage2")
def submit_stage2(
    app_id: str,
    body: Stage2Body,
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    """II этап: заявитель дозаполняет расширенные данные/документы после первичной
    подачи. Ответы мёржатся в заявку, PDF перегенерируется целиком, и заявка
    уходит на рассмотрение (spec разд. 5, критерий 9.1)."""
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    if app.status != "stage2_required":
        raise HTTPException(409, "Дополнительные сведения сейчас не требуются")

    service = db.get(Service, app.serviceId)
    org = db.get(Organization, service.orgId) if service else None
    company = db.get(Company, app.companyBin)

    app.answers = {**(app.answers or {}), **(body.answers or {})}
    try:
        app.calc = compute_schema_expressions(app.schemaSnapshot, app.answers)
    except FormulaError as exc:
        raise HTTPException(422, f"Ошибка автоматического расчёта: {exc}") from exc

    # Перегенерируем PDF — теперь он содержит полную заявку (этап 1 + этап 2).
    pdf = render_application_pdf(
        app_number=app.number,
        app_date=datetime.now().strftime("%d.%m.%Y"),
        service_title=service.title if service else "",
        org_name=org.name if org else "",
        company=_company_dict(company),
        answers=app.answers,
        calc=app.calc,
        doc_template=service.docTemplate if service else "",
        signed_by=body.signedBy or (company.director if company else None),
    )
    from ..config import settings

    (settings.upload_dir / f"{app.number}.pdf").write_bytes(pdf)
    app.pdfUrl = f"/storage/{app.number}.pdf"

    app.updatedAt = datetime.now(timezone.utc)
    app.status = "stage2_submitted"
    db.add(app)
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus="stage2_required",
            toStatus="stage2_submitted", actor="client",
        )
    )
    db.add(
        ApplicationEvent(
            appId=app.id, fromStatus="stage2_submitted", toStatus="in_review",
            actor="system",
        )
    )
    app.status = "in_review"
    if company:
        db.add(
            Notification(
                userBin=company.bin,
                title=f"Заявка {app.number}: дополнительные сведения получены",
                body=(
                    f"Расширенные сведения по «{service.title if service else ''}» "
                    f"получены. Заявка на рассмотрении, решение до {_due_hint(service)}."
                ),
                appId=app.id,
                kind="status",
            )
        )
    db.commit()
    db.refresh(app)
    return {
        "id": app.id,
        "number": app.number,
        "status": app.status,
        "statusLabel": status_label(app.status),
        "pdfUrl": app.pdfUrl,
    }


@router.post("/{app_id}/files")
async def upload_file(
    app_id: str,
    file: UploadFile = File(...),
    _user=Depends(require_owner_or_admin),
    db: Session = Depends(get_session),
):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    from ..config import settings

    safe = re.sub(r"[^\w.\-]+", "_", file.filename or "file")
    dest_name = f"{app.number}_{len(app.files or [])}_{safe}"
    (settings.upload_dir / dest_name).write_bytes(await file.read())
    entry = {
        "name": file.filename,
        "url": f"/storage/{dest_name}",
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
    }
    app.files = [*(app.files or []), entry]
    app.updatedAt = datetime.now(timezone.utc)
    db.add(app)
    db.add(
        ApplicationEvent(
            appId=app.id,
            fromStatus=app.status,
            toStatus=app.status,
            actor="client",
            comment=f"Загружен файл: {file.filename}",
        )
    )
    db.commit()
    return entry
