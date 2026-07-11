"""Official-source import pipeline demo data.

The live harvesters are intentionally separated from the web runtime: a judged
demo must not depend on bgov/adilet availability. This module models the same
pipeline a real scheduled importer will populate.
"""

from __future__ import annotations

from datetime import datetime, timezone


NOW = datetime.now(timezone.utc).isoformat()

SOURCES = [
    {
        "id": "bgov",
        "name": "bgov.kz",
        "kind": "service_registry",
        "url": "https://bgov.kz/ru/services",
        "status": "ready",
        "found": 118,
        "updated": 12,
        "needsReview": 47,
        "published": 8,
        "lastRunAt": NOW,
        "method": "Inertia JSON: /ru/services + /kk/services + detail pages",
        "nextStep": "Scheduled harvester with source hash and diff tracking",
    },
    {
        "id": "adilet",
        "name": "Adilet",
        "kind": "normative_rules",
        "url": "https://adilet.zan.kz",
        "status": "planned",
        "found": 24,
        "updated": 3,
        "needsReview": 9,
        "published": 2,
        "lastRunAt": None,
        "method": "Normative text extraction: conditions, limits, documents",
        "nextStep": "Evidence table: source quote -> rule -> form field",
    },
    {
        "id": "subsidiary-sites",
        "name": "Сайты дочерних организаций",
        "kind": "subsidiary_content",
        "url": "damu.kz, idfrk.kz, kdb.kz, agrocredit.kz, kaf.kz, kazakhexport.kz, qic.kz",
        "status": "planned",
        "found": 63,
        "updated": 7,
        "needsReview": 18,
        "published": 6,
        "lastRunAt": None,
        "method": "Source connectors per organization; manual approval before publish",
        "nextStep": "Add per-source owner and review SLA",
    },
    {
        "id": "data-egov",
        "name": "data.egov.kz",
        "kind": "open_data",
        "url": "https://data.egov.kz",
        "status": "planned",
        "found": 14,
        "updated": 2,
        "needsReview": 5,
        "published": 0,
        "lastRunAt": None,
        "method": "Open datasets for regions, map layers, public statistics",
        "nextStep": "Replace generated map seed with dataset-backed adapter",
    },
]

IMPORTED_SERVICES = [
    {
        "id": "imp_akk_animal",
        "sourceId": "bgov",
        "serviceSlug": "akk-animal",
        "title": "Агробизнес: животноводство",
        "organization": "АКК",
        "sourceUrl": "https://bgov.kz/ru/services/agroanimal2",
        "status": "analyst_review",
        "confidence": 0.88,
        "updatedAt": NOW,
        "coverage": {
            "card": True,
            "conditions": True,
            "documents": True,
            "formDraft": True,
            "published": True,
        },
        "evidence": [
            {
                "kind": "rate",
                "label": "Ставка",
                "value": "5%",
                "sourceQuote": "льготное финансирование по ставке до 5% годовых",
                "mappedTo": "condition.rate + calculator.programRate",
                "confidence": 0.91,
            },
            {
                "kind": "rule",
                "label": "Правило 70%",
                "value": "не менее 70% на приобретение скота",
                "sourceQuote": "основная часть займа направляется на покупку сельхозживотных",
                "mappedTo": "validation: cattle_amount >= loan_amount * 0.7",
                "confidence": 0.82,
            },
            {
                "kind": "document",
                "label": "Документы",
                "value": "справка о ЛПХ/КХ, документы по обеспечению",
                "sourceQuote": "заявитель предоставляет подтверждающие документы по хозяйству и обеспечению",
                "mappedTo": "form.documents + visibleIf by applicant type",
                "confidence": 0.86,
            },
        ],
    },
    {
        "id": "imp_wagons",
        "sourceId": "bgov",
        "serviceSlug": "wagons-leasing",
        "title": "Приобретение вагонов в лизинг",
        "organization": "ФРП",
        "sourceUrl": "https://bgov.kz/ru/services/wagons_ind",
        "status": "draft_form",
        "confidence": 0.84,
        "updatedAt": NOW,
        "coverage": {
            "card": True,
            "conditions": True,
            "documents": True,
            "formDraft": True,
            "published": True,
        },
        "evidence": [
            {
                "kind": "stage",
                "label": "Многоэтапность",
                "value": "первичная заявка + расширенные документы после решения",
                "sourceQuote": "I этап подачи заявки предусматривает первичные сведения",
                "mappedTo": "stage.initial + stage.after_review",
                "confidence": 0.89,
            },
            {
                "kind": "calc",
                "label": "Аванс",
                "value": "от 15%",
                "sourceQuote": "авансовый платеж составляет не менее 15%",
                "mappedTo": "formula: total_cost * 0.15",
                "confidence": 0.9,
            },
        ],
    },
    {
        "id": "imp_damu_subsidy",
        "sourceId": "adilet",
        "serviceSlug": "damu-subsidy",
        "title": "Субсидирование ставки вознаграждения",
        "organization": "Даму",
        "sourceUrl": "https://adilet.zan.kz",
        "status": "ai_extracted",
        "confidence": 0.79,
        "updatedAt": NOW,
        "coverage": {
            "card": True,
            "conditions": True,
            "documents": False,
            "formDraft": True,
            "published": True,
        },
        "evidence": [
            {
                "kind": "rate",
                "label": "Итоговая ставка",
                "value": "7%",
                "sourceQuote": "часть ставки субсидируется, итоговая ставка для заемщика фиксируется правилами программы",
                "mappedTo": "SubsidyCalculator.programRate",
                "confidence": 0.74,
            }
        ],
    },
]

PIPELINE_STAGES = [
    {"id": "imported", "label": "Импортировано", "description": "Карточка и источник получены"},
    {"id": "normalized", "label": "Нормализовано", "description": "Организация, категория, язык и ссылки сопоставлены"},
    {"id": "ai_extracted", "label": "AI-извлечение", "description": "Условия, документы и правила извлечены из текста"},
    {"id": "analyst_review", "label": "Проверка аналитика", "description": "Ответственный сотрудник сверяет evidence"},
    {"id": "draft_form", "label": "Черновик формы", "description": "Схема формы готова в конструкторе"},
    {"id": "published", "label": "Опубликовано", "description": "Услуга доступна предпринимателю"},
]

