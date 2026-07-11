"""Foundational seed: organizations, companies, demo users (spec Часть 11).

Services + form schemas are seeded THROUGH the constructor API in M1 (REQ-24),
so this module only creates the reference data they depend on. Idempotent:
upserts by primary key. Run: `python -m app.seed`.
"""

from __future__ import annotations

from sqlmodel import Session, func, select

from .db import engine, init_db
from .models import Company, ImportedService, Organization, Service, User

# Дочерние компании холдинга «Байтерек» (baiterek.gov.kz, раздел
# «Дочерние компании холдинга»). Показываем строго официальный состав.
# `name` — полное название АО (материнский холдинг «Байтерек», QazTech
# Ventures, Baiterek Venture Fund, КазАгроФинанс и ФРП сюда НЕ входят).
ORGANIZATIONS: list[dict] = [
    {"id": "damu", "name": "АО «Фонд развития предпринимательства „Даму“»", "shortName": "Даму", "color": "#0f6e56", "logo": "/brand/orgs/damu.png"},
    {"id": "brk", "name": "АО «Банк Развития Казахстана»", "shortName": "БРК", "color": "#8a5a0b", "logo": "/brand/orgs/brk.png"},
    {"id": "akk", "name": "АО «Аграрная кредитная корпорация»", "shortName": "АКК", "color": "#4a5053", "logo": "/brand/orgs/akk.svg"},
    {"id": "kzhk", "name": "АО «Казахстанская жилищная компания»", "shortName": "КЖК", "color": "#7a3fa0", "logo": "/brand/orgs/kzhk.png"},
    {"id": "kazakhexport", "name": "АО «Экспортно-кредитное агентство „KazakhExport“»", "shortName": "KazakhExport", "color": "#121517", "logo": "/brand/orgs/kazakhexport.png"},
    {"id": "otbasy", "name": "АО «Отбасы банк»", "shortName": "Отбасы банк", "color": "#7a3fa0", "logo": "/brand/orgs/otbasy.svg"},
    {"id": "qic", "name": "АО «Qazaqstan Investment Corporation»", "shortName": "QIC", "color": "#137a6e", "logo": "/brand/orgs/qic.svg"},
]

# Орг-записи, которые больше не показываем как институты развития. Материнский
# холдинг + сущности вне официального блока дочерних (у всех 0 услуг — удаление
# не затрагивает каталог). Хранится для идемпотентной чистки БД при пересеве.
REMOVED_ORG_IDS: list[str] = ["baiterek", "qtv", "bvf", "kaf", "frp"]

COMPANIES: list[dict] = [
    {
        "bin": "123456789012",
        "name": "ТОО «AgroDala»",
        "form": "TOO",
        "oked": "01.42",
        "okedName": "Разведение прочих пород крупного рогатого скота",
        "address": "Костанайская область, г. Костанай, ул. Байтурсынова, 45",
        "region": "Костанайская область",
        "director": "Асхат Нурланов",
        "category": "small",
    },
    {
        "bin": "987654321098",
        "name": "ИП «Айсұлу»",
        "form": "IP",
        "oked": "14.13",
        "okedName": "Производство прочей верхней одежды",
        "address": "г. Алматы, ул. Абая, 150",
        "region": "г. Алматы",
        "director": "Айсұлу Жумабекова",
        "category": "micro",
    },
    {
        "bin": "555444333222",
        "name": "ТОО «SteelPro»",
        "form": "TOO",
        "oked": "25.62",
        "okedName": "Механическая обработка металлических изделий",
        "address": "Карагандинская область, г. Караганда, пр. Бухар-Жырау, 30",
        "region": "Карагандинская область",
        "director": "Виктор Петров",
        "category": "medium",
    },
]

USERS: list[dict] = [
    {"id": "ent-agrodala", "role": "entrepreneur", "name": "Асхат Нурланов", "bin": "123456789012", "orgId": None},
    {"id": "ent-aisulu", "role": "entrepreneur", "name": "Айсұлу Жумабекова", "bin": "987654321098", "orgId": None},
    {"id": "analyst-damu", "role": "analyst", "name": "Аналитик Фонда «Даму»", "bin": None, "orgId": "damu"},
    {"id": "analyst-akk", "role": "analyst", "name": "Аналитик АКК", "bin": None, "orgId": "akk"},
    {"id": "admin-portal", "role": "admin", "name": "Администратор портала", "bin": None, "orgId": None},
]


def _upsert(db: Session, model, pk_field: str, rows: list[dict]) -> None:
    for row in rows:
        existing = db.get(model, row[pk_field])
        if existing:
            for k, v in row.items():
                setattr(existing, k, v)
            db.add(existing)
        else:
            db.add(model(**row))


def _prune_removed_orgs(db: Session) -> int:
    """Drop orgs no longer part of the official development-institute set.
    Safe because every removed org carries zero published services (verified
    in seed review); a defensive guard skips deletion if a Service still
    references one, so we never orphan catalog data. Imported-pipeline drafts
    (ImportedService.orgId, nullable) are detached rather than deleted — they
    stay in the admin queue as unmatched candidates instead of vanishing."""
    removed = 0
    for oid in REMOVED_ORG_IDS:
        org = db.get(Organization, oid)
        if not org:
            continue
        has_services = db.exec(
            select(func.count()).select_from(Service).where(Service.orgId == oid)
        ).one()
        if has_services:
            print(f"  ! keep {oid}: still has {has_services} published service(s)")
            continue
        orphans = db.exec(
            select(ImportedService).where(ImportedService.orgId == oid)
        ).all()
        for imp in orphans:
            imp.orgId = None
            db.add(imp)
        db.flush()
        db.delete(org)
        removed += 1
    return removed


def seed_reference_data() -> None:
    init_db()
    with Session(engine) as db:
        _upsert(db, Organization, "id", ORGANIZATIONS)
        _upsert(db, Company, "bin", COMPANIES)
        _upsert(db, User, "id", USERS)
        pruned = _prune_removed_orgs(db)
        db.commit()
    print(
        f"Seeded {len(ORGANIZATIONS)} organizations "
        f"(pruned {pruned} legacy), "
        f"{len(COMPANIES)} companies, {len(USERS)} users."
    )


if __name__ == "__main__":
    seed_reference_data()
