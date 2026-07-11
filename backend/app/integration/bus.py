"""Integration bus — the single entry point for every external exchange.

    envelope = bus.call(db, system_id, operation_code, payload,
                        idempotency_key=..., application=...)

Responsibilities:
  * look up the system + operation config from the DB (admin-editable);
  * dispatch to the adapter selected by `adapterType`;
  * apply the retry policy;
  * replay on a repeated idempotency-key (never double-submit to a BPM);
  * write an IntegrationCall row — the outbox / live exchange log.

Callers get a uniform envelope and never depend on a specific system's shape.
"""

from __future__ import annotations

import json
import time
from typing import Any

from sqlmodel import Session, select

from ..models import IntegrationCall, IntegrationOperation, IntegrationSystem
from .adapters import AdapterError, get_adapter

Envelope = dict[str, Any]


def _envelope(
    ok: bool,
    data: Any = None,
    *,
    status: str,
    source: str,
    latency_ms: int | None,
    attempts: int,
    call_id: str | None,
    error: str | None = None,
) -> Envelope:
    return {
        "ok": ok,
        "data": data if data is not None else {},
        "status": status,
        "source": source,
        "latencyMs": latency_ms,
        "attempts": attempts,
        "callId": call_id,
        "error": error,
    }


def _json_safe(obj: Any) -> Any:
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return {"repr": str(obj)}


def get_operation(db: Session, system_id: str, code: str) -> IntegrationOperation | None:
    return db.exec(
        select(IntegrationOperation).where(
            IntegrationOperation.systemId == system_id,
            IntegrationOperation.code == code,
        )
    ).first()


def call(
    db: Session,
    system_id: str,
    operation_code: str,
    payload: dict | None = None,
    *,
    idempotency_key: str | None = None,
    application: str | None = None,
    direction: str | None = None,
) -> Envelope:
    payload = payload or {}
    system = db.get(IntegrationSystem, system_id)
    if not system:
        return _envelope(
            False,
            status="error",
            source=system_id,
            latency_ms=0,
            attempts=0,
            call_id=None,
            error=f"Интеграция '{system_id}' не настроена",
        )

    op = get_operation(db, system_id, operation_code)
    direction = direction or (op.direction if op else "outbound")

    # Idempotency replay — a prior success with the same key returns its
    # response without re-invoking the downstream system.
    if idempotency_key:
        prior = db.exec(
            select(IntegrationCall).where(
                IntegrationCall.idempotencyKey == idempotency_key,
                IntegrationCall.status == "success",
            )
        ).first()
        if prior:
            return _envelope(
                True,
                prior.responsePayload,
                status="replayed",
                source=system.name,
                latency_ms=prior.latencyMs,
                attempts=prior.attempts,
                call_id=prior.id,
            )

    adapter = get_adapter(system.adapterType)
    retry = system.retryPolicy or {}
    max_attempts = max(1, int(retry.get("maxAttempts", 1)))
    backoff_ms = int(retry.get("backoffMs", 0))

    attempts = 0
    last_error: str | None = None
    start = time.perf_counter()

    while attempts < max_attempts:
        attempts += 1
        try:
            data = adapter.execute(system, op, payload, db)
        except AdapterError as exc:
            last_error = str(exc)
            if attempts < max_attempts and backoff_ms:
                time.sleep(min(backoff_ms, 300) / 1000)  # cap demo backoff
            continue
        except Exception as exc:  # noqa: BLE001 — never bubble to the caller
            last_error = str(exc)
            break

        # success — prefer configured (simulated) latency, else measured.
        latency = op.latencyMs if (op and op.latencyMs) else system.latencyMs
        if latency is None:
            latency = int((time.perf_counter() - start) * 1000)
        row = IntegrationCall(
            systemId=system_id,
            operation=operation_code,
            direction=direction,
            idempotencyKey=idempotency_key,
            status="success",
            attempts=attempts,
            latencyMs=latency,
            requestPayload=_json_safe(payload),
            responsePayload=_json_safe(data),
            application=application,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _envelope(
            True,
            data,
            status="success",
            source=system.name,
            latency_ms=latency,
            attempts=attempts,
            call_id=row.id,
        )

    # exhausted retries — log the failure to the outbox
    latency = int((time.perf_counter() - start) * 1000)
    row = IntegrationCall(
        systemId=system_id,
        operation=operation_code,
        direction=direction,
        idempotencyKey=idempotency_key,
        status="error",
        attempts=attempts,
        latencyMs=latency,
        requestPayload=_json_safe(payload),
        responsePayload={"error": last_error},
        application=application,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _envelope(
        False,
        {"error": last_error},
        status="error",
        source=system.name,
        latency_ms=latency,
        attempts=attempts,
        call_id=row.id,
        error=last_error,
    )
