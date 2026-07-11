"""Governance and audit demo feed for the admin cabinet."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


NOW = datetime.now(timezone.utc)

AUDIT_EVENTS = [
    {
        "id": "aud_000441",
        "createdAt": (NOW - timedelta(minutes=6)).isoformat(),
        "actor": "Айдана С., аналитик Даму",
        "role": "analyst",
        "action": "service.publish",
        "objectType": "service",
        "objectName": "Субсидирование ставки вознаграждения",
        "risk": "high",
        "channel": "admin",
        "evidence": "Опубликована форма v4; старая v3 сохранена для поданных заявок",
    },
    {
        "id": "aud_000440",
        "createdAt": (NOW - timedelta(minutes=18)).isoformat(),
        "actor": "AI Service Generator",
        "role": "system",
        "action": "ai.extract_rules",
        "objectType": "source_import",
        "objectName": "bgov.kz / agroanimal2",
        "risk": "medium",
        "channel": "ai",
        "evidence": "Извлечено 3 условия, confidence 88%, отправлено на проверку аналитика",
    },
    {
        "id": "aud_000439",
        "createdAt": (NOW - timedelta(minutes=24)).isoformat(),
        "actor": "System",
        "role": "system",
        "action": "integration.outbox_sent",
        "objectType": "application",
        "objectName": "EPPB-2026-000124",
        "risk": "medium",
        "channel": "integration",
        "evidence": "application.submit отправлен в ESB с idempotency-key app-EPPB-2026-000124-v1",
    },
    {
        "id": "aud_000438",
        "createdAt": (NOW - timedelta(hours=1, minutes=3)).isoformat(),
        "actor": "Ерлан М., АКК",
        "role": "operator",
        "action": "application.needs_changes",
        "objectType": "application",
        "objectName": "EPPB-2026-000119",
        "risk": "medium",
        "channel": "backoffice",
        "evidence": "Запрошен документ по обеспечению; комментарий виден предпринимателю",
    },
    {
        "id": "aud_000437",
        "createdAt": (NOW - timedelta(hours=2, minutes=11)).isoformat(),
        "actor": "Мария П., администратор",
        "role": "admin",
        "action": "dictionary.update",
        "objectType": "dictionary",
        "objectName": "regions",
        "risk": "low",
        "channel": "admin",
        "evidence": "Добавлен alias для области Ұлытау / Улытау",
    },
    {
        "id": "aud_000436",
        "createdAt": (NOW - timedelta(hours=3, minutes=45)).isoformat(),
        "actor": "Import Scheduler",
        "role": "system",
        "action": "source.diff_detected",
        "objectType": "source",
        "objectName": "bgov.kz",
        "risk": "low",
        "channel": "import",
        "evidence": "12 карточек изменились с прошлого hash snapshot",
    },
]

POLICIES = [
    {
        "id": "pol_publish",
        "title": "Публикация услуги",
        "description": "Любое изменение активной формы создаёт новую версию; старые заявки открываются по snapshot.",
        "status": "active",
        "owner": "Product governance",
    },
    {
        "id": "pol_ai",
        "title": "AI под контролем человека",
        "description": "AI может создать черновик и evidence, но публикация доступна только аналитику или администратору.",
        "status": "active",
        "owner": "AI governance",
    },
    {
        "id": "pol_integration",
        "title": "Интеграции идемпотентны",
        "description": "Передача в BPM идёт через outbox с idempotency-key и повтором без дублей.",
        "status": "active",
        "owner": "Integration team",
    },
    {
        "id": "pol_roles",
        "title": "Ролевая видимость",
        "description": "Оператор дочерней организации видит только свои услуги и заявки; администратор видит всё.",
        "status": "demo",
        "owner": "Security",
    },
]

