"""Demo project map dataset (REQ-19).

The values are deterministic and intentionally stored as data-like structures:
in production this module is replaced by an Analytics Center / BI integration.
"""

from __future__ import annotations

from hashlib import sha256

REGIONS = [
    {"id": "astana", "name": "г. Астана", "center": [51.1605, 71.4704], "geoIso": "KZ-AST"},
    {"id": "almaty", "name": "г. Алматы", "center": [43.2389, 76.8897], "geoIso": "KZ-ALA"},
    {"id": "shymkent", "name": "г. Шымкент", "center": [42.3417, 69.5901], "geoIso": None},
    {"id": "akmola", "name": "Акмолинская область", "center": [53.2833, 69.3833], "geoIso": "KZ-AKM"},
    {"id": "aktobe", "name": "Актюбинская область", "center": [50.2839, 57.167], "geoIso": "KZ-AKT"},
    {"id": "almaty_region", "name": "Алматинская область", "center": [45.0, 78.0], "geoIso": "KZ-ALM"},
    {"id": "atyrau", "name": "Атырауская область", "center": [47.0945, 51.9238], "geoIso": "KZ-ATY"},
    {"id": "east", "name": "Восточно-Казахстанская область", "center": [49.9483, 82.6275], "geoIso": "KZ-VOS"},
    {"id": "zhambyl", "name": "Жамбылская область", "center": [42.9, 71.3667], "geoIso": "KZ-ZHA"},
    {"id": "west", "name": "Западно-Казахстанская область", "center": [51.2333, 51.3667], "geoIso": "KZ-ZAP"},
    {"id": "karaganda", "name": "Карагандинская область", "center": [49.8047, 73.1094], "geoIso": "KZ-KAR"},
    {"id": "kostanay", "name": "Костанайская область", "center": [53.2144, 63.6246], "geoIso": "KZ-KUS"},
    {"id": "kyzylorda", "name": "Кызылординская область", "center": [44.8488, 65.4823], "geoIso": "KZ-KZY"},
    {"id": "mangystau", "name": "Мангистауская область", "center": [43.65, 51.2], "geoIso": "KZ-MAN"},
    {"id": "north", "name": "Северо-Казахстанская область", "center": [54.8732, 69.1505], "geoIso": "KZ-SEV"},
    {"id": "pavlodar", "name": "Павлодарская область", "center": [52.2873, 76.9674], "geoIso": "KZ-PAV"},
    {"id": "turkestan", "name": "Туркестанская область", "center": [43.2973, 68.2518], "geoIso": "KZ-YUZ"},
]

ORGS = [
    ("damu", "Даму"),
    ("akk", "АКК"),
    ("kazakhexport", "KazakhExport"),
    ("brk", "БРК"),
    ("kzhk", "КЖК"),
    ("otbasy", "Отбасы банк"),
    ("qic", "QIC"),
]

INDUSTRIES = ["Агро", "Промышленность", "Экспорт", "Инфраструктура", "Жильё", "Сервисы"]
STATUSES = ["Финансируется", "Завершён", "На мониторинге", "Договор подписан"]

PROJECT_TITLES = {
    "Агро": [
        "Молочная ферма на 200 голов",
        "Тепличный комплекс закрытого грунта",
        "Откормочная площадка КРС",
        "Линия переработки масличных культур",
    ],
    "Промышленность": [
        "Модернизация цеха металлоконструкций",
        "Линия глубокой переработки сырья",
        "Производство строительных материалов",
        "Обновление промышленного оборудования",
    ],
    "Экспорт": [
        "Экспортная партия пищевой продукции",
        "Страхование контракта на поставку оборудования",
        "Расширение экспортной логистики",
        "Сертификация продукции для внешних рынков",
    ],
    "Инфраструктура": [
        "Модернизация зернового терминала",
        "Строительство логистического хаба",
        "Обновление инженерной инфраструктуры",
        "Расширение промышленной площадки",
    ],
    "Жильё": [
        "Жилой комплекс доступного класса",
        "Ипотечный пул первичного жилья",
        "Инженерные сети жилого квартала",
        "Модернизация жилищной инфраструктуры",
    ],
    "Сервисы": [
        "Цифровизация сервисного центра",
        "Развитие сети бытовых услуг",
        "Обновление оборудования медицинского сервиса",
        "Платформа клиентской поддержки МСБ",
    ],
}

ORG_AMOUNT_RANGES = {
    "akk": (60_000_000, 1_500_000_000),
    "damu": (15_000_000, 750_000_000),
    "kazakhexport": (120_000_000, 3_500_000_000),
    "brk": (7_000_000_000, 45_000_000_000),
    "kzhk": (18_000_000, 420_000_000),
    "otbasy": (30_000_000, 900_000_000),
    "qic": (500_000_000, 12_000_000_000),
}

MSB_CONTEXT = {
    "shymkent": {
        "value": 19,
        "label": "зарегистрированных субъектов МСБ в открытом наборе",
        "source": "data.egov.kz / Акимат города Шымкент",
        "sourceName": "Перечень предприятий-товаропроизводителей",
        "sourceUrl": "https://data.egov.kz/datasets/view?index=shymkent_k__tauarondirushiler",
        "datasetIndex": "shymkent_k__tauarondirushiler",
        "version": "v13",
        "updatedAt": "27.01.2026",
    }
}


def _h(*parts: object) -> int:
    raw = "|".join(str(p) for p in parts).encode()
    return int(sha256(raw).hexdigest(), 16)


def _amount(org_id: str, region_id: str, i: int) -> int:
    low, high = ORG_AMOUNT_RANGES[org_id]
    step = 1_000_000
    slots = max(1, (high - low) // step)
    return low + (_h(region_id, i, org_id, "amount") % slots) * step


def _title(industry: str, region_id: str, i: int) -> str:
    titles = PROJECT_TITLES[industry]
    return titles[_h(region_id, i, "title") % len(titles)]


def build_projects() -> list[dict]:
    projects: list[dict] = []
    idx = 1
    for region in REGIONS:
        count = 8 + _h(region["id"], "count") % 8
        for i in range(count):
            org_id, org = ORGS[_h(region["id"], i, "org") % len(ORGS)]
            if region["id"] in {"kostanay", "turkestan", "zhambyl"} and i % 2 == 0:
                org_id, org = "akk", "АКК"
            industry = INDUSTRIES[_h(region["id"], i, "industry") % len(INDUSTRIES)]
            if org_id == "akk":
                industry = "Агро"
            elif org_id in {"otbasy", "kzhk"}:
                industry = "Жильё"
            elif org_id == "kazakhexport":
                industry = "Экспорт"
            amount = _amount(org_id, region["id"], i)
            lat, lon = region["center"]
            lat += ((_h(region["id"], i, "lat") % 100) - 50) / 1000
            lon += ((_h(region["id"], i, "lon") % 100) - 50) / 1000
            projects.append(
                {
                    "id": f"prj-{idx:03d}",
                    "title": _title(industry, region["id"], i),
                    "orgId": org_id,
                    "org": org,
                    "region": region["name"],
                    "regionId": region["id"],
                    "city": "областной центр",
                    "industry": industry,
                    "status": STATUSES[_h(region["id"], i, "status") % len(STATUSES)],
                    "year": 2024 + (_h(region["id"], i, "year") % 3),
                    "amount": amount,
                    "jobs": 12 + _h(region["id"], i, "jobs") % 240,
                    "lat": round(lat, 5),
                    "lon": round(lon, 5),
                    "description": (
                        "Демо-запись для карты профинансированных проектов. "
                        "В боевом контуре карточка приходит из ИС Аналитического центра."
                    ),
                    "url": "/services",
                }
            )
            idx += 1
    return projects


def map_payload(org: str | None = None, region: str | None = None, industry: str | None = None, year: int | None = None) -> dict:
    projects = build_projects()
    if org:
        projects = [p for p in projects if p["orgId"] == org]
    if region:
        projects = [p for p in projects if p["regionId"] == region]
    if industry:
        projects = [p for p in projects if p["industry"] == industry]
    if year:
        projects = [p for p in projects if p["year"] == year]

    summary = []
    for reg in REGIONS:
        items = [p for p in projects if p["regionId"] == reg["id"]]
        amount = sum(p["amount"] for p in items)
        jobs = sum(p["jobs"] for p in items)
        top: dict[str, int] = {}
        for p in items:
            top[p["industry"]] = top.get(p["industry"], 0) + 1
        summary.append(
            {
                **reg,
                "count": len(items),
                "amount": amount,
                "jobs": jobs,
                "topIndustries": sorted(top.items(), key=lambda x: x[1], reverse=True)[:3],
                "msb": MSB_CONTEXT.get(reg["id"]),
            }
        )
    return {
        "regions": summary,
        "projects": projects,
        "filters": {
            "orgs": [{"id": oid, "name": name} for oid, name in ORGS],
            "industries": INDUSTRIES,
            "years": [2024, 2025, 2026],
        },
    }
