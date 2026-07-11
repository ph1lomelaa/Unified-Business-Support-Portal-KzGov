"""Seed KnowledgeItem from content/*.md and the shared FaqEntry table.

Content lives as plain files (not hand-typed dicts in Python) so the base
grows by adding a file, not editing code — same "услуга — это данные"
principle as the constructor. Idempotent: upserts by slug/question.

Run: `python -m app.seed_knowledge` (after `python -m app.seed`).
"""

from __future__ import annotations

from pathlib import Path

from sqlmodel import Session

from .config import BASE_DIR
from .db import engine, init_db
from .models import FaqEntry, KnowledgeItem

CONTENT_DIR = BASE_DIR / "content"

# Moved out of the frontend homepage — now the single source both the
# homepage and /knowledge read from instead of two hardcoded lists.
FAQ: list[dict] = [
    {"question": "Чем субсидирование отличается от гарантирования?", "answer": "Субсидирование снижает ставку по кредиту, а гарантирование покрывает часть залога, если его не хватает банку.", "order": 1},
    {"question": "Какие документы получаются автоматически по БИН?", "answer": "В MVP имитируется получение регистрационных данных, ОКЭД, адреса и базового профиля компании через mock ГБД ЮЛ.", "order": 2},
    {"question": "Что делать, если заявку вернули на доработку?", "answer": "В личном кабинете появится комментарий оператора и зона загрузки документа. После загрузки заявка отправляется повторно.", "order": 3},
    {"question": "Кто может получить гарантию до 85%?", "answer": "Предварительно — МСБ, которому банк одобряет кредит, но не хватает залогового обеспечения. Итоговое решение принимает оператор программы.", "order": 4},
    {"question": "Как работает правило 70% в программе животноводства?", "answer": "В заявке АКК не менее 70% суммы займа должно быть направлено на приобретение скота; правило проверяется формулой в конструкторе.", "order": 5},
    {"question": "Можно ли подать заявку без ЭЦП?", "answer": "Черновик можно заполнить без подписи, но отправка заявления требует имитации ЭЦП в MVP и реального NCALayer в промышленном контуре.", "order": 6},
    {"question": "Сколько рассматривается заявка?", "answer": "Срок зависит от услуги. В карточке и кабинете показывается SLA, например 5 рабочих дней для контрольных мер.", "order": 7},
    {"question": "Что такое портфельное субсидирование?", "answer": "Это механизм массового сопровождения кредитов по программе, где часть операционных действий выполняется через банк и интеграционные контуры.", "order": 8},
]


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        return value[1:-1]
    return value


def parse_content_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError(f"{path}: missing frontmatter")
    _, frontmatter, body = text.split("---", 2)
    meta: dict = {}
    for line in frontmatter.strip().splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = _unquote(value.strip())
    related = meta.get("relatedServiceSlugs", "")
    return {
        "slug": meta["slug"],
        "type": meta["type"],
        "title": meta["title"],
        "summary": meta.get("summary", ""),
        "body": body.strip(),
        "readMinutes": int(meta.get("readMinutes", 5)),
        "relatedServiceSlugs": [s.strip() for s in related.split(",") if s.strip()],
        "downloadRef": meta.get("downloadRef") or None,
    }


def seed_knowledge() -> None:
    init_db()
    with Session(engine) as db:
        for path in sorted(CONTENT_DIR.glob("*.md")):
            data = parse_content_file(path)
            existing = db.exec(
                KnowledgeItem.__table__.select().where(KnowledgeItem.slug == data["slug"])
            ).first()
            if existing:
                item = db.get(KnowledgeItem, existing.id)
                for k, v in data.items():
                    setattr(item, k, v)
                db.add(item)
            else:
                db.add(KnowledgeItem(**data))

        for row in FAQ:
            existing = db.exec(
                FaqEntry.__table__.select().where(FaqEntry.question == row["question"])
            ).first()
            if existing:
                entry = db.get(FaqEntry, existing.id)
                entry.answer = row["answer"]
                entry.order = row["order"]
                db.add(entry)
            else:
                db.add(FaqEntry(**row))
        db.commit()
    print(f"Seeded knowledge items from {CONTENT_DIR} and {len(FAQ)} FAQ entries.")


if __name__ == "__main__":
    seed_knowledge()
