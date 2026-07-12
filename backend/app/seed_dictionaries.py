"""Seed the core reference dictionaries (справочники, Фаза 2).

Every dictionary here is fully editable in the admin console — this seed only
gives a fresh stand a sensible starting set. The `oked` dictionary is declared
`source="external"` and seeded *empty*: it is filled by pulling from the НСИ
registry through the integration bus (admin → «Синхронизировать»), which proves
external справочники are wired end-to-end without code.

Idempotent: dictionaries upsert by code; manual items are (re)placed only when
the dictionary has none, so admin edits are never clobbered on restart.

Run: `python -m app.seed_dictionaries`.
"""

from __future__ import annotations

from sqlmodel import Session, select

from .db import engine, init_db
from .map_data import REGIONS
from .models import Dictionary, DictionaryItem

# Meta for each dictionary. `items` may be a callable (regions) or a literal list.
DICTIONARIES: list[dict] = [
    {
        "code": "regions",
        "title": "Регионы Казахстана",
        "description": "Области и города республиканского значения. Совпадает со справочником карты проектов.",
        "source": "manual",
        "items": [{"value": r["id"], "label": r["name"]} for r in REGIONS],
    },
    {
        "code": "support-categories",
        "title": "Категории мер поддержки",
        "description": "Тип инструмента поддержки бизнеса.",
        "source": "manual",
        "items": [
            {"value": "credit", "label": "Кредитование"},
            {"value": "subsidy", "label": "Субсидирование"},
            {"value": "guarantee", "label": "Гарантирование"},
            {"value": "leasing", "label": "Лизинг"},
            {"value": "insurance", "label": "Страхование"},
            {"value": "investment", "label": "Инвестиции"},
            {"value": "grant", "label": "Гранты"},
        ],
    },
    {
        "code": "business-size",
        "title": "Размер бизнеса",
        "description": "Категория субъекта предпринимательства по численности и доходу.",
        "source": "manual",
        "items": [
            {"value": "micro", "label": "Микробизнес"},
            {"value": "small", "label": "Малый бизнес"},
            {"value": "medium", "label": "Средний бизнес"},
            {"value": "large", "label": "Крупный бизнес"},
        ],
    },
    {
        "code": "doc-types",
        "title": "Типы документов",
        "description": "Виды документов, запрашиваемых в заявках.",
        "source": "manual",
        "items": [
            {"value": "id-card", "label": "Удостоверение личности"},
            {"value": "charter", "label": "Устав организации"},
            {"value": "financial-report", "label": "Финансовая отчётность"},
            {"value": "business-plan", "label": "Бизнес-план"},
            {"value": "collateral", "label": "Документы на залоговое имущество"},
            {"value": "bank-statement", "label": "Выписка с банковского счёта"},
            {"value": "tax-certificate", "label": "Справка об отсутствии налоговой задолженности"},
        ],
    },
    {
        "code": "industries",
        "title": "Отрасли",
        "description": "Укрупнённые отрасли экономики для маршрутизации и подбора мер.",
        "source": "manual",
        "items": [
            {"value": "agro", "label": "Агропромышленный комплекс"},
            {"value": "manufacturing", "label": "Обрабатывающая промышленность"},
            {"value": "trade", "label": "Торговля"},
            {"value": "services", "label": "Услуги"},
            {"value": "it", "label": "ИТ и связь"},
            {"value": "construction", "label": "Строительство"},
            {"value": "transport", "label": "Транспорт и логистика"},
            {"value": "tourism", "label": "Туризм"},
        ],
    },
    {
        "code": "oked",
        "title": "ОКЭД (виды деятельности)",
        "description": "Общий классификатор видов экономической деятельности. Загружается из внешнего реестра НСИ через интеграционную шину.",
        "source": "external",
        "systemId": "nsi-registry",
        "operation": "dictionary.fetch",
        # Seeded empty on purpose — filled by the bus sync to prove the flow.
        "items": [],
    },
]


def _upsert_dictionary(db: Session, meta: dict) -> None:
    items = meta.pop("items", [])
    existing = db.exec(
        select(Dictionary).where(Dictionary.code == meta["code"])
    ).first()
    if existing:
        for key, value in meta.items():
            setattr(existing, key, value)
        db.add(existing)
        dictionary = existing
        db.commit()
        db.refresh(dictionary)
    else:
        dictionary = Dictionary(**meta)
        db.add(dictionary)
        db.commit()
        db.refresh(dictionary)

    # Only seed items when the dictionary has none — never clobber admin edits.
    has_items = db.exec(
        select(DictionaryItem).where(DictionaryItem.dictionaryId == dictionary.id)
    ).first()
    if has_items is None:
        for order, item in enumerate(items):
            db.add(
                DictionaryItem(
                    dictionaryId=dictionary.id,
                    value=item["value"],
                    label=item["label"],
                    parentValue=item.get("parentValue"),
                    sortOrder=item.get("sortOrder", order),
                )
            )
        db.commit()


def run() -> None:
    init_db()
    with Session(engine) as db:
        for meta in DICTIONARIES:
            _upsert_dictionary(db, dict(meta))
    print("[seed] reference dictionaries ready")


def seed_if_empty() -> None:
    """Called on startup — populate on any DB that lacks the dictionaries."""
    with Session(engine) as db:
        if db.exec(select(Dictionary)).first() is not None:
            return
    run()


if __name__ == "__main__":
    run()
