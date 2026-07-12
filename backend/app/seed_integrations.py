"""Seed the integration bus registry (Фаза 1).

Migrates the former hardcoded control-center dataset (integrations_admin_data)
into the DB so every integration becomes admin-editable and callable through
the bus. Idempotent: systems upsert by id, operations by (systemId, code).

Run: `python -m app.seed_integrations`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from .db import engine, init_db
from .models import (
    IntegrationCall,
    IntegrationContract,
    IntegrationOperation,
    IntegrationSystem,
)

NOW = datetime.now(timezone.utc)

SYSTEMS: list[dict] = [
    {
        "id": "egov-idp", "name": "eGov IDP", "owner": "Госорган",
        "purpose": "Единая авторизация предпринимателя", "kind": "external",
        "adapterType": "oidc", "authType": "oidc", "status": "ready",
        "sla": "99.5%", "latencyMs": 420,
        "nextStep": "Подключить продуктивный client_id после аккредитации стенда",
    },
    {
        "id": "gbd-ul", "name": "ГБД ЮЛ", "owner": "Госорган",
        "purpose": "Предзаполнение БИН, наименования, ОКЭД и адреса", "kind": "external",
        "adapterType": "mock", "status": "mocked", "sla": "98.0%", "latencyMs": 730,
        "nextStep": "Заменить demo fixture на ESB endpoint, сохранить тот же контракт",
    },
    {
        "id": "nca-eds", "name": "НУЦ / ЭЦП", "owner": "Госорган",
        "purpose": "Подписание заявления и документов", "kind": "external",
        "adapterType": "eds", "status": "mocked", "sla": "98.5%", "latencyMs": 1280,
        "nextStep": "Подключить проверку CMS-подписи и timestamp",
    },
    {
        "id": "holding-esb", "name": "Единая интеграционная шина Холдинга", "owner": "Байтерек",
        "purpose": "Маршрутизация заявок в BPM дочерних организаций", "kind": "bus",
        "adapterType": "esb", "status": "ready", "sla": "99.0%", "latencyMs": 510,
        "retryPolicy": {"maxAttempts": 3, "backoffMs": 200},
        "nextStep": "Согласовать справочник кодов услуг и статусов BPM",
    },
    {
        "id": "bpm-damu", "name": "BPM Даму", "owner": "Даму",
        "purpose": "Передача заявки на субсидирование и получение статусов", "kind": "external",
        "adapterType": "esb", "status": "ready", "sla": "99.0%", "latencyMs": 640,
        "retryPolicy": {"maxAttempts": 3, "backoffMs": 200},
        "nextStep": "Добавить вложения PDF через document exchange adapter",
    },
    {
        "id": "bpm-akk", "name": "BPM АКК", "owner": "Аграрная кредитная корпорация",
        "purpose": "Передача заявок по агробизнесу и второй этап документов", "kind": "external",
        "adapterType": "esb", "status": "degraded", "sla": "97.0%", "latencyMs": 2140,
        "retryPolicy": {"maxAttempts": 3, "backoffMs": 200},
        "nextStep": "Разобрать ошибки справочника регионов в callback",
    },
    {
        "id": "notifications", "name": "Email/SMS/WhatsApp gateway", "owner": "Байтерек",
        "purpose": "Уведомления о статусах и доработках", "kind": "internal",
        "adapterType": "mock", "status": "planned", "sla": "98.0%",
        "nextStep": "Подключить провайдера и таблицу delivery receipts",
    },
    {
        "id": "bi-analytics", "name": "BI / Аналитический центр", "owner": "Байтерек",
        "purpose": "Embedding дашбордов и выгрузка проектов для карты", "kind": "internal",
        "adapterType": "mock", "status": "planned", "sla": "99.0%",
        "nextStep": "Согласовать embed URLs и наборы открытых показателей",
    },
    {
        "id": "nsi-registry", "name": "НСИ / Реестр справочников", "owner": "Госорган",
        "purpose": "Единые справочники (ОКЭД, регионы) для конструктора форм", "kind": "external",
        "adapterType": "mock", "status": "mocked", "sla": "99.0%", "latencyMs": 480,
        "nextStep": "Подключить продуктивный реестр НСИ вместо demo fixture",
    },
]

# Operations = the callable surface of each system (what bus.call(...) targets).
OPERATIONS: list[dict] = [
    {
        "systemId": "gbd-ul", "code": "company.prefill",
        "title": "Профиль компании по БИН", "method": "POST", "path": "/company/{bin}",
        "direction": "outbound", "latencyMs": 730,
        "requestSchema": {"bin": "string(12)"},
        "responseSchema": {"name": "string", "oked": "string", "address": "string", "director": "string"},
        "mockDataset": {"resolver": "gbd.company"},
    },
    {
        "systemId": "egov-idp", "code": "auth.callback",
        "title": "OIDC callback авторизации", "method": "POST", "path": "/oidc/callback",
        "direction": "inbound", "latencyMs": 420,
        "requestSchema": {"code": "string", "iin": "string"},
        "responseSchema": {"authenticated": "bool", "subject": "string"},
    },
    {
        "systemId": "nca-eds", "code": "document.sign",
        "title": "Подписание заявления ЭЦП", "method": "POST", "path": "/sign",
        "direction": "outbound", "latencyMs": 1280,
        "requestSchema": {"document": "string", "signedBy": "string"},
        "responseSchema": {"signed": "bool", "signature": "string"},
    },
    {
        "systemId": "holding-esb", "code": "application.submit",
        "title": "Передача заявки в BPM через ЕИШ", "method": "POST", "path": "/applications",
        "direction": "outbound", "latencyMs": 510,
        "requestSchema": {"application": "snapshot", "files": "array", "idempotencyKey": "string"},
        "responseSchema": {"externalId": "string", "acceptedAt": "datetime"},
        "mockDataset": {"route": "applications.holding.default"},
    },
    {
        "systemId": "bpm-akk", "code": "status.callback",
        "title": "Статус-callback из BPM", "method": "POST", "path": "/status",
        "direction": "inbound", "latencyMs": 2140,
        "requestSchema": {"status": "string", "reason": "string"},
        "responseSchema": {"ack": "bool"},
        "mockDataset": {"ack": True, "status": "in_review"},
    },
    {
        "systemId": "nsi-registry", "code": "dictionary.fetch",
        "title": "Загрузка справочника по коду", "method": "POST", "path": "/dictionaries/{code}",
        "direction": "outbound", "latencyMs": 480,
        "requestSchema": {"code": "string"},
        "responseSchema": {"items": "array<{value,label}>"},
        "mockDataset": {"resolver": "nsi.dictionary"},
    },
]

CONTRACTS: list[dict] = [
    {
        "systemId": "gbd-ul", "operation": "company.prefill",
        "request": "BIN -> company profile",
        "response": "name, legal form, OKED, address, director, category",
        "source": "ГБД ЮЛ", "owner": "Integration team",
    },
    {
        "systemId": "holding-esb", "operation": "application.submit",
        "request": "Application snapshot + files + idempotency key",
        "response": "external BPM id + accepted timestamp",
        "source": "Единая интеграционная шина", "owner": "Service owner",
    },
    {
        "systemId": "bpm-akk", "operation": "status.callback",
        "request": "BPM status + comment + required documents",
        "response": "ack + notification event id",
        "source": "BPM дочерней организации", "owner": "Back-office lead",
    },
]

# A few historical exchange rows so the live log isn't empty on first load.
EXCHANGES: list[dict] = [
    {
        "systemId": "holding-esb", "operation": "application.submit", "direction": "outbound",
        "status": "success", "attempts": 1, "latencyMs": 502,
        "idempotencyKey": "app-EPPB-2026-000124-v1", "application": "EPPB-2026-000124",
        "requestPayload": {"service": "damu-subsidy", "stage": "initial"},
        "responsePayload": {"externalId": "bpm_demo124", "acceptedAt": NOW.isoformat()},
        "createdAt": NOW - timedelta(minutes=4),
    },
    {
        "systemId": "egov-idp", "operation": "auth.callback", "direction": "inbound",
        "status": "success", "attempts": 1, "latencyMs": 418,
        "idempotencyKey": "auth-session-demo", "application": None,
        "requestPayload": {"role": "entrepreneur", "bin": "123456789012"},
        "responsePayload": {"authenticated": True, "subject": "123456789012"},
        "createdAt": NOW - timedelta(minutes=7),
    },
    {
        "systemId": "gbd-ul", "operation": "company.prefill", "direction": "outbound",
        "status": "success", "attempts": 1, "latencyMs": 731,
        "idempotencyKey": "prefill-123456789012", "application": "draft",
        "requestPayload": {"bin": "123456789012"},
        "responsePayload": {"name": "ТОО «AgroDala»", "oked": "01.42"},
        "createdAt": NOW - timedelta(minutes=19),
    },
    {
        "systemId": "bpm-akk", "operation": "status.callback", "direction": "inbound",
        "status": "retrying", "attempts": 2, "latencyMs": 2140,
        "idempotencyKey": "callback-akk-000119-2", "application": "EPPB-2026-000119",
        "requestPayload": {"status": "needs_changes", "reason": "region code mismatch"},
        "responsePayload": {"error": "region code mismatch"},
        "createdAt": NOW - timedelta(hours=2, minutes=22),
    },
]


def _upsert_system(db: Session, data: dict) -> None:
    existing = db.get(IntegrationSystem, data["id"])
    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
        existing.updatedAt = datetime.now(timezone.utc)
        db.add(existing)
    else:
        db.add(IntegrationSystem(**data))


def _upsert_operation(db: Session, data: dict) -> None:
    found = db.exec(
        select(IntegrationOperation).where(
            IntegrationOperation.systemId == data["systemId"],
            IntegrationOperation.code == data["code"],
        )
    ).first()
    if found:
        for key, value in data.items():
            setattr(found, key, value)
        db.add(found)
    else:
        db.add(IntegrationOperation(**data))


def run() -> None:
    init_db()
    with Session(engine) as db:
        for system in SYSTEMS:
            _upsert_system(db, system)
        db.commit()
        for op in OPERATIONS:
            _upsert_operation(db, op)
        db.commit()
        if not db.exec(select(IntegrationContract)).first():
            for contract in CONTRACTS:
                db.add(IntegrationContract(**contract))
            db.commit()
        if not db.exec(select(IntegrationCall)).first():
            for exchange in EXCHANGES:
                db.add(IntegrationCall(**exchange))
            db.commit()
    print("[seed] integration bus registry ready")


def seed_if_empty() -> None:
    """Called from app startup — populate the registry on any DB that lacks it
    (fresh volume *or* an existing DB seeded before the bus existed)."""
    with Session(engine) as db:
        if db.exec(select(IntegrationSystem)).first() is not None:
            return
    run()


if __name__ == "__main__":
    run()
