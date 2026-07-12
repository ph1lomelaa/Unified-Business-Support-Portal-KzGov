"""Admin integration control-center — now backed by the DB, not a fixture.

The whole registry (systems, operations, contracts) is editable here without
touching code, and `POST /test` runs a real call through the bus so an admin
can verify a wiring live. Every call is recorded to the IntegrationCall outbox
and streamed back as "Последние обмены".
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..integration import bus
from ..integration.adapters import adapter_types
from ..models import (
    IntegrationCall,
    IntegrationContract,
    IntegrationOperation,
    IntegrationSystem,
    utcnow,
)
from ..session import require_role

router = APIRouter(
    prefix="/api/v1/admin/integrations",
    tags=["admin-integrations"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)

ADAPTER_LABEL = {
    "mock": "Mock adapter (fixture/resolver)",
    "rest": "REST adapter",
    "esb": "ЕИШ: outbox + idempotency-key + status callback",
    "oidc": "OIDC/SAML авторизация",
    "eds": "NCALayer/NCANode подписание",
}


# --- DTOs ---------------------------------------------------------------------
def _op_dto(op: IntegrationOperation) -> dict:
    return {
        "id": op.id,
        "code": op.code,
        "title": op.title,
        "method": op.method,
        "path": op.path,
        "direction": op.direction,
        "latencyMs": op.latencyMs,
        "mockDataset": bus.redact_payload(op.mockDataset),
        "requestSchema": op.requestSchema,
        "responseSchema": op.responseSchema,
    }


def _system_dto(db: Session, s: IntegrationSystem) -> dict:
    ops = sorted(s.operations, key=lambda o: o.code)
    last = db.exec(
        select(IntegrationCall)
        .where(IntegrationCall.systemId == s.id)
        .order_by(IntegrationCall.createdAt.desc())  # type: ignore[attr-defined]
    ).first()
    return {
        "id": s.id,
        "name": s.name,
        "owner": s.owner,
        "purpose": s.purpose,
        "kind": s.kind,
        "adapterType": s.adapterType,
        "adapter": ADAPTER_LABEL.get(s.adapterType, s.adapterType),
        "baseUrl": s.baseUrl,
        "authType": s.authType,
        "timeoutMs": s.timeoutMs,
        "retryPolicy": s.retryPolicy,
        "status": s.status,
        "sla": s.sla,
        "latencyMs": s.latencyMs,
        "nextStep": s.nextStep,
        "operations": len(ops),
        "operationsList": [_op_dto(o) for o in ops],
        "lastEventAt": last.createdAt.isoformat() if last else None,
    }


def _call_dto(c: IntegrationCall) -> dict:
    return {
        "id": c.id,
        "createdAt": c.createdAt.isoformat(),
        "direction": c.direction,
        "systemId": c.systemId,
        "operation": c.operation,
        # UI vocabulary: error -> failed
        "status": "failed" if c.status == "error" else c.status,
        "application": c.application,
        "idempotencyKey": c.idempotencyKey or "—",
        "durationMs": c.latencyMs or 0,
        "attempts": c.attempts,
        "payload": bus.redact_payload(c.requestPayload),
        "response": bus.redact_payload(c.responsePayload),
    }


# --- read ---------------------------------------------------------------------
@router.get("")
def list_admin_integrations(db: Session = Depends(get_session)):
    systems = db.exec(select(IntegrationSystem)).all()
    calls = db.exec(
        select(IntegrationCall).order_by(IntegrationCall.createdAt.desc())  # type: ignore[attr-defined]
    ).all()
    contracts = db.exec(select(IntegrationContract)).all()

    healthy = sum(1 for s in systems if s.status in {"ready", "mocked"})
    total_ops = sum(len(s.operations) for s in systems)
    latencies = [s.latencyMs for s in systems if s.latencyMs is not None]
    return {
        "systems": [_system_dto(db, s) for s in systems],
        "exchanges": [_call_dto(c) for c in calls[:40]],
        "contracts": [
            {
                "operation": c.operation,
                "request": c.request,
                "response": c.response,
                "source": c.source,
                "owner": c.owner,
            }
            for c in contracts
        ],
        "adapterTypes": adapter_types(),
        "summary": {
            "systems": len(systems),
            "healthy": healthy,
            "planned": sum(1 for s in systems if s.status == "planned"),
            "retrying": sum(1 for c in calls if c.status in {"retrying", "error"}),
            "operations": total_ops,
            "avgLatencyMs": round(sum(latencies) / len(latencies)) if latencies else None,
        },
    }


# --- system CRUD --------------------------------------------------------------
class SystemBody(BaseModel):
    id: str | None = None
    name: str | None = None
    owner: str | None = None
    purpose: str | None = None
    kind: str | None = None
    adapterType: str | None = None
    baseUrl: str | None = None
    authType: str | None = None
    authSecret: str | None = None
    timeoutMs: int | None = None
    retryPolicy: dict | None = None
    status: str | None = None
    sla: str | None = None
    latencyMs: int | None = None
    nextStep: str | None = None


@router.post("/systems", status_code=201)
def create_system(body: SystemBody, db: Session = Depends(get_session)):
    if not body.id or not body.name:
        raise HTTPException(400, "id и name обязательны")
    if db.get(IntegrationSystem, body.id):
        raise HTTPException(409, f"Система '{body.id}' уже существует")
    data = body.model_dump(exclude_none=True)
    system = IntegrationSystem(**data)
    db.add(system)
    db.commit()
    db.refresh(system)
    return _system_dto(db, system)


@router.patch("/systems/{system_id}")
def update_system(system_id: str, body: SystemBody, db: Session = Depends(get_session)):
    system = db.get(IntegrationSystem, system_id)
    if not system:
        raise HTTPException(404, "Система не найдена")
    for key, value in body.model_dump(exclude_none=True, exclude={"id"}).items():
        setattr(system, key, value)
    system.updatedAt = utcnow()
    db.add(system)
    db.commit()
    db.refresh(system)
    return _system_dto(db, system)


@router.delete("/systems/{system_id}", status_code=204)
def delete_system(system_id: str, db: Session = Depends(get_session)):
    system = db.get(IntegrationSystem, system_id)
    if not system:
        raise HTTPException(404, "Система не найдена")
    db.delete(system)
    db.commit()


# --- operation CRUD -----------------------------------------------------------
class OperationBody(BaseModel):
    code: str | None = None
    title: str | None = None
    method: str | None = None
    path: str | None = None
    direction: str | None = None
    latencyMs: int | None = None
    mockDataset: dict | None = None
    requestSchema: dict | None = None
    responseSchema: dict | None = None


@router.post("/systems/{system_id}/operations", status_code=201)
def create_operation(system_id: str, body: OperationBody, db: Session = Depends(get_session)):
    if not db.get(IntegrationSystem, system_id):
        raise HTTPException(404, "Система не найдена")
    if not body.code:
        raise HTTPException(400, "code операции обязателен")
    op = IntegrationOperation(systemId=system_id, **body.model_dump(exclude_none=True))
    db.add(op)
    db.commit()
    db.refresh(op)
    return _op_dto(op)


@router.patch("/operations/{op_id}")
def update_operation(op_id: str, body: OperationBody, db: Session = Depends(get_session)):
    op = db.get(IntegrationOperation, op_id)
    if not op:
        raise HTTPException(404, "Операция не найдена")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(op, key, value)
    db.add(op)
    db.commit()
    db.refresh(op)
    return _op_dto(op)


@router.delete("/operations/{op_id}", status_code=204)
def delete_operation(op_id: str, db: Session = Depends(get_session)):
    op = db.get(IntegrationOperation, op_id)
    if not op:
        raise HTTPException(404, "Операция не найдена")
    db.delete(op)
    db.commit()


# --- live test call -----------------------------------------------------------
class TestBody(BaseModel):
    systemId: str
    operation: str
    payload: dict = {}
    idempotencyKey: str | None = None


@router.post("/test")
def test_call(body: TestBody, db: Session = Depends(get_session)):
    """Run a real call through the bus and return the envelope. This is the
    'докажи, что шина живая' button — the response, latency, retries and the
    resulting outbox row are all real."""
    return bus.call(
        db,
        body.systemId,
        body.operation,
        body.payload,
        idempotency_key=body.idempotencyKey,
    )
