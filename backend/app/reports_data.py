"""Public catalog of verified analytics materials (specification 6.7).

The catalog contains links to official resources of Baiterek Holding and its
seven subsidiaries. External pages are deliberately never embedded: their
frame policies can change and most of them explicitly deny third-party frames.
"""

from __future__ import annotations

ORG_META: dict[str, tuple[str, str, str, str]] = {
    "baiterek": ("АО «Национальный инвестиционный холдинг «Байтерек»", "Байтерек", "#121517", "/brand/orgs/baiterek.png"),
    "damu": ("АО «Фонд развития предпринимательства «Даму»", "Даму", "#0F6E56", "/brand/orgs/damu.png"),
    "brk": ("АО «Банк Развития Казахстана»", "БРК", "#BA7517", "/brand/orgs/brk.png"),
    "akk": ("АО «Аграрная кредитная корпорация»", "АКК", "#1D9E75", "/brand/orgs/akk.svg"),
    "kazakhexport": ("АО «Экспортно-кредитное агентство Казахстана»", "ЭКА", "#4A5053", "/brand/orgs/kazakhexport.png"),
    "kzhk": ("АО «Казахстанская Жилищная Компания»", "КЖК", "#7A3FA0", "/brand/orgs/kzhk.png"),
    "otbasy": ("АО «Отбасы банк»", "Отбасы банк", "#0D7E72", "/brand/orgs/otbasy.svg"),
    "qic": ("АО «Qazaqstan Investment Corporation»", "QIC", "#2764A5", "/brand/orgs/qic.svg"),
}

TYPE_LABELS: dict[str, str] = {
    "portal": "Портал",
    "dashboard": "Дашборд",
    "financial": "Финотчёт",
    "research": "Исследование",
    "review": "Обзор",
}

REPORTS: list[dict] = [
    {
        "id": "baiterek-annual-reports",
        "org": "baiterek",
        "type": "review",
        "title": "Годовые отчёты Холдинга «Байтерек»",
        "description": "Официальный архив годовых отчётов Холдинга с консолидированными результатами группы. Материалы раскрывают финансовые показатели, результаты деятельности, корпоративное управление и устойчивое развитие.",
        "source": "АО «Национальный инвестиционный холдинг «Байтерек»",
        "period": "2024 год",
        "updated": "2025-07-31",
        "url": "https://baiterek.gov.kz/ru/o-kholdinge/otchetnost-kholdinga/godovye-otchety/",
    },
    {
        "id": "damu-analytics",
        "org": "damu",
        "type": "research",
        "title": "Аналитические материалы по развитию предпринимательства",
        "description": "Раздел содержит исследования сектора малого и среднего бизнеса, отраслевые обзоры и региональную аналитику. Публикации помогают оценить структуру предпринимательства и факторы развития отдельных отраслей Казахстана.",
        "source": "АО «Фонд развития предпринимательства «Даму»",
        "period": "2026 год",
        "updated": "2026-05-15",
        "url": "https://damu.kz/poleznaya-informatsiya/damu_analytics/",
    },
    {
        "id": "damu-sme-reports",
        "org": "damu",
        "type": "review",
        "title": "Обзоры состояния малого и среднего бизнеса",
        "description": "Подборка материалов о динамике и структуре МСБ в Казахстане. В разделе представлены аналитика по инструментам поддержки, исследования и тематические обзоры Фонда.",
        "source": "АО «Фонд развития предпринимательства «Даму»",
        "period": "2025–2026 годы",
        "updated": "2026-05-15",
        "url": "https://damu.kz/poleznaya-informatsiya/damu_analytics/",
    },
    {
        "id": "kazakhexport-analytics",
        "org": "kazakhexport",
        "type": "research",
        "title": "Аналитика экспортных рынков",
        "description": "Официальный аналитический раздел экспортно-кредитного агентства. Материалы посвящены внешним рынкам, экспортным направлениям и условиям работы казахстанских экспортёров.",
        "source": "АО «Экспортно-кредитное агентство Казахстана»",
        "period": "Актуальные публикации",
        "updated": "2026-07-11",
        "url": "https://kazakhexport.kz/ru/analytics",
    },
    {
        "id": "brk-analytics-portal",
        "org": "brk",
        "type": "portal",
        "title": "Аналитический портал Банка Развития Казахстана",
        "description": "Публичный портал с аналитическими материалами Банка о развитии экономики и финансируемых направлениях. Раздел объединяет обзоры, исследования и отраслевую информацию для инвесторов и предпринимателей.",
        "source": "АО «Банк Развития Казахстана»",
        "period": "Актуальные публикации",
        "updated": "2026-07-11",
        "url": "https://www.kdb.kz/analytics/research-and-publications/",
    },
    {
        "id": "brk-financial-reports",
        "org": "brk",
        "type": "financial",
        "title": "Финансовая и годовая отчётность Банка Развития Казахстана",
        "description": "Официальный архив консолидированной и отдельной финансовой отчётности Банка. В разделе доступны квартальные документы по бухгалтерскому балансу, прибылям и убыткам, а также годовые отчёты.",
        "source": "АО «Банк Развития Казахстана»",
        "period": "2026, I квартал",
        "updated": "2026-07-11",
        "url": "https://www.kdb.kz/investors/financial-and-annual-reporting/",
    },
    {
        "id": "otbasy-reports",
        "org": "otbasy",
        "type": "financial",
        "title": "Отчётность Отбасы банка",
        "description": "Официальный раздел корпоративной отчётности банка. Здесь публикуются финансовые документы и материалы, раскрывающие результаты деятельности и положение банка за отчётные периоды.",
        "source": "АО «Отбасы банк»",
        "period": "Актуальная отчётность",
        "updated": "2026-07-11",
        "url": "https://hcsbk.kz/ru/about-the-bank/reporting/",
    },
    {
        "id": "kzhk-homeportal",
        "org": "kzhk",
        "type": "portal",
        "title": "Жилищный портал Казахстанской Жилищной Компании",
        "description": "Официальный портал с информацией о жилищных программах, объектах и направлениях поддержки. Материалы помогают пользователю изучить доступные механизмы и перейти к профильным сервисам компании.",
        "source": "АО «Казахстанская Жилищная Компания»",
        "period": "Актуальная информация",
        "updated": "2026-07-11",
        "url": "https://homeportal.kz/ru/",
    },
    {
        "id": "qic-public-materials",
        "org": "qic",
        "type": "portal",
        "title": "Инвестиционные материалы Qazaqstan Investment Corporation",
        "description": "Официальный корпоративный ресурс инвестиционной компании. На сайте представлены сведения об инвестиционных направлениях, фондах, проектах и публичные корпоративные материалы QIC.",
        "source": "АО «Qazaqstan Investment Corporation»",
        "period": "Актуальная информация",
        "updated": "2026-07-11",
        "url": "https://qic.kz/ru/",
    },
    {
        "id": "akk-public-materials",
        "org": "akk",
        "type": "portal",
        "title": "Публичные материалы Аграрной кредитной корпорации",
        "description": "Официальный ресурс финансового оператора программ развития агропромышленного комплекса. На сайте публикуются сведения о программах кредитования, корпоративные документы, новости и отчётные материалы.",
        "source": "АО «Аграрная кредитная корпорация»",
        "period": "Актуальная информация",
        "updated": "2026-07-11",
        "url": "https://agrocredit.kz/ru/",
    },
]


def _decorate(item: dict) -> dict:
    full, short, color, logo = ORG_META[item["org"]]
    return {
        **item,
        "orgName": full,
        "orgShort": short,
        "orgColor": color,
        "orgLogo": logo,
        "typeLabel": TYPE_LABELS[item["type"]],
    }


def reports_payload(org: str | None = None, type: str | None = None) -> dict:
    """Return the catalog and complete facets; query filters remain API-compatible."""
    selected_orgs = {part for part in (org or "").split(",") if part}
    selected_types = {part for part in (type or "").split(",") if part}
    items = [
        _decorate(item)
        for item in REPORTS
        if (not selected_orgs or item["org"] in selected_orgs)
        and (not selected_types or item["type"] in selected_types)
    ]
    return {
        "items": items,
        "orgs": [
            {"id": key, "shortName": meta[1], "name": meta[0], "logo": meta[3], "color": meta[2]}
            for key, meta in ORG_META.items()
        ],
        "types": [{"id": key, "label": label} for key, label in TYPE_LABELS.items()],
        "total": len(REPORTS),
    }
