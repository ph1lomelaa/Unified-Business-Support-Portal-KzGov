"""Seed the no-code content entities (Фаза 4): reports, projects, calculators,
statuses. Migrates the former *_data.py / status.py fixtures into the DB so each
becomes admin-editable. Idempotent and per-entity: seeds only what's empty.

Run: `python -m app.seed_content`.
"""

from __future__ import annotations

from sqlmodel import Session, select

from .db import engine, init_db
from .map_data import build_projects
from .models import (
    Calculator,
    Project,
    Report,
    StatusModel,
    StatusTransition,
)
from .reports_data import REPORTS
from .status import STATUS, TERMINAL

# ------------------------------------------------------------------- reports
def _seed_reports(db: Session) -> None:
    if db.exec(select(Report)).first() is not None:
        return
    for order, r in enumerate(REPORTS):
        db.add(
            Report(
                id=r["id"],
                orgId=r["org"],
                type=r["type"],
                title=r["title"],
                description=r.get("description", ""),
                source=r.get("source", ""),
                period=r.get("period", ""),
                updated=r.get("updated", ""),
                url=r.get("url", ""),
                sortOrder=order,
            )
        )
    db.commit()


# ------------------------------------------------------------------ projects
def _seed_projects(db: Session) -> None:
    if db.exec(select(Project)).first() is not None:
        return
    for p in build_projects():
        db.add(
            Project(
                id=p["id"],
                title=p["title"],
                orgId=p["orgId"],
                regionId=p["regionId"],
                industry=p["industry"],
                status=p["status"],
                year=p["year"],
                amount=p["amount"],
                jobs=p["jobs"],
                lat=p["lat"],
                lon=p["lon"],
                city=p.get("city", ""),
                description=p.get("description", ""),
                url=p.get("url", "/services"),
            )
        )
    db.commit()


# --------------------------------------------------------------- calculators
CALCULATORS: list[dict] = [
    {
        "slug": "leasing",
        "title": "Калькулятор лизинга",
        "summary": "Оцените ежемесячный платёж и удорожание по лизингу оборудования или транспорта.",
        "inputs": [
            {"name": "cost", "label": "Стоимость предмета лизинга", "type": "number", "default": 30000000, "min": 0, "suffix": "₸"},
            {"name": "advance", "label": "Аванс", "type": "percent", "default": 20, "min": 0, "max": 90, "suffix": "%"},
            {"name": "term", "label": "Срок", "type": "number", "default": 36, "min": 6, "max": 120, "suffix": "мес"},
            {"name": "rate", "label": "Ставка удорожания", "type": "percent", "default": 14, "min": 0, "max": 40, "suffix": "% годовых"},
        ],
        "formula": "(cost * (1 - advance / 100)) * (1 + rate / 100 * term / 12) / term",
        "resultLabel": "Ежемесячный платёж",
        "resultSuffix": "₸/мес",
        "note": "Предварительный расчёт. Точные условия определяет финансовый оператор.",
    },
    {
        "slug": "subsidy",
        "title": "Экономия от субсидирования ставки",
        "summary": "Сравните платёж по ставке банка и по итоговой ставке программы и оцените экономию за срок кредита.",
        "inputs": [
            {"name": "loan", "label": "Сумма кредита", "type": "number", "default": 80000000, "min": 0, "suffix": "₸"},
            {"name": "bank_rate", "label": "Ставка банка", "type": "percent", "default": 19, "min": 0, "max": 40, "suffix": "%"},
            {"name": "program_rate", "label": "Итоговая ставка программы", "type": "percent", "default": 7, "min": 0, "max": 25, "suffix": "%"},
            {"name": "term", "label": "Срок", "type": "number", "default": 60, "min": 6, "max": 84, "suffix": "мес"},
        ],
        # Экономия = (аннуитет по ставке банка − аннуитет по ставке программы) * срок
        "formula": "term * (loan * (bank_rate/1200) / (1 - pow(1 + bank_rate/1200, 0 - term)) - loan * (program_rate/1200) / (1 - pow(1 + program_rate/1200, 0 - term)))",
        "resultLabel": "Экономия за срок",
        "resultSuffix": "₸",
        "note": "Оценка выгоды по модели аннуитета. Итоговый размер субсидии зависит от условий программы.",
    },
    {
        "slug": "credit",
        "title": "Кредитный калькулятор (аннуитет)",
        "summary": "Ежемесячный аннуитетный платёж по кредиту.",
        "inputs": [
            {"name": "amount", "label": "Сумма кредита", "type": "number", "default": 20000000, "min": 0, "suffix": "₸"},
            {"name": "rate", "label": "Ставка", "type": "percent", "default": 18, "min": 0, "max": 60, "suffix": "% годовых"},
            {"name": "term", "label": "Срок", "type": "number", "default": 24, "min": 1, "max": 120, "suffix": "мес"},
        ],
        # аннуитет: A = P*i / (1 - (1+i)^-n), i = rate/1200
        "formula": "amount * (rate / 1200) / (1 - pow(1 + rate / 1200, 0 - term))",
        "resultLabel": "Ежемесячный платёж",
        "resultSuffix": "₸/мес",
        "note": "Модель аннуитета. Реальный график платежей уточняйте у кредитора.",
    },
]


def _seed_calculators(db: Session) -> None:
    """Сеем встроенные калькуляторы и приводим их к каноническому виду.

    insert-missing по slug + обновление презентационных полей встроенных демо-
    калькуляторов (форма входов, формула, подписи), чтобы витрина совпадала с
    актуальной моделью (плитки/график субсидии). Калькуляторы с другими slug,
    созданные аналитиком в конструкторе, не трогаем.
    """
    for c in CALCULATORS:
        row = db.exec(select(Calculator).where(Calculator.slug == c["slug"])).first()
        if row is None:
            db.add(Calculator(**c))
            continue
        row.title = c["title"]
        row.summary = c["summary"]
        row.inputs = c["inputs"]
        row.formula = c["formula"]
        row.resultLabel = c["resultLabel"]
        row.resultSuffix = c["resultSuffix"]
        row.note = c["note"]
        db.add(row)
    db.commit()


# ----------------------------------------------------------------- statuses
def _seed_statuses(db: Session) -> None:
    if db.exec(select(StatusModel)).first() is None:
        for order, (key, s) in enumerate(STATUS.items()):
            db.add(
                StatusModel(
                    key=key,
                    label=s.label,
                    color=s.color,
                    who=s.who,
                    sla=s.sla,
                    commentRequired=s.comment_required,
                    terminal=key in TERMINAL,
                    sortOrder=order,
                )
            )
        db.commit()
    if db.exec(select(StatusTransition)).first() is None:
        order = 0
        for key, s in STATUS.items():
            for nxt in s.next:
                db.add(StatusTransition(flow="default", fromKey=key, toKey=nxt, sortOrder=order))
                order += 1
        db.commit()


def run() -> None:
    init_db()
    with Session(engine) as db:
        _seed_reports(db)
        _seed_projects(db)
        _seed_calculators(db)
        _seed_statuses(db)
    print("[seed] content entities ready (reports, projects, calculators, statuses)")


def seed_if_empty() -> None:
    """Startup hook — each entity self-guards, so this is safe to call always."""
    run()


if __name__ == "__main__":
    run()
