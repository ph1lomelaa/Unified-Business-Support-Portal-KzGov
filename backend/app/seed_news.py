"""Демо-новости институтов развития для главной страницы.

Новости на портале появляются двумя путями: (1) живой HTML-импорт с сайтов
дочерних организаций (`app.import_news`), который может быть недоступен на демо-
стенде (внешние сайты, robots, сеть); (2) этот сид — гарантирует, что блок
«Новости» на главной не пустует. Идемпотентен и НЕ трогает уже импортированные
новости: сеет демо-подборку только если таблица новостей пуста.

Run: `python -m app.seed_news`  (после `python -m app.seed`).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from .db import engine
from .models import NewsItem, Organization

NOW = datetime.now(timezone.utc)


def _d(days_ago: int) -> datetime:
    return NOW - timedelta(days=days_ago)


# (sourceOrgId, title, summary, days_ago, sourceUrl)
DEMO_NEWS: list[tuple[str, str, str, int, str]] = [
    (
        "akk",
        "АКК расширяет программу «Агробизнес животноводство»",
        "Аграрная кредитная корпорация продолжает приём заявок на льготное "
        "кредитование откормочных площадок по ставке 5% годовых. Не менее 70% "
        "суммы направляется на приобретение скота (КРС/МРС).",
        2,
        "https://agrocredit.kz/ru/news/agrobiznes-zhivotnovodstvo-2026",
    ),
    (
        "damu",
        "«Даму» увеличил лимиты гарантирования для малого бизнеса",
        "Фонд развития предпринимательства «Даму» пересмотрел условия "
        "гарантирования по кредитам МСБ — гарантия покрывает до 85% суммы займа "
        "при недостатке залогового обеспечения.",
        4,
        "https://damu.kz/ru/news/garantirovanie-msb-2026",
    ),
    (
        "brk",
        "Банк Развития Казахстана профинансировал промышленный проект",
        "БРК одобрил финансирование модернизации производственного комплекса — "
        "проект создаст новые рабочие места и увеличит долю казахстанского "
        "содержания в отрасли.",
        6,
        "https://kdb.kz/ru/news/promyshlennyy-proekt-2026",
    ),
    (
        "kazakhexport",
        "KazakhExport застраховал экспортные контракты на новых рынках",
        "Экспортно-кредитное агентство расширило страховое покрытие экспортных "
        "поставок казахстанских товаров, снизив риски отсрочки платежа для "
        "предпринимателей.",
        9,
        "https://kazakhexport.kz/ru/news/strahovanie-eksporta-2026",
    ),
    (
        "kzhk",
        "Казахстанская жилищная компания обновила условия гарантий",
        "КЖК уточнила порядок предоставления гарантий по проектам жилищного "
        "строительства — сокращены сроки рассмотрения и упрощён пакет документов.",
        12,
        "https://homeportal.kz/ru/news/garantii-2026",
    ),
    (
        "qic",
        "QIC представил новые инструменты для инвестиционных проектов",
        "Qazaqstan Investment Corporation анонсировал линейку решений для "
        "софинансирования частных инвестиционных проектов совместно с "
        "институтами группы «Байтерек».",
        15,
        "https://qic.kz/ru/news/investicionnye-instrumenty-2026",
    ),
]


def seed_news() -> int:
    with Session(engine) as db:
        existing = db.exec(select(NewsItem)).first()
        if existing is not None:
            print("[seed_news] новости уже есть — пропускаю демо-подборку.")
            return 0
        orgs = {o.id for o in db.exec(select(Organization)).all()}
        created = 0
        for org_id, title, summary, days_ago, url in DEMO_NEWS:
            if org_id not in orgs:
                continue
            db.add(
                NewsItem(
                    sourceOrgId=org_id,
                    title=title,
                    summary=summary,
                    publishedAt=_d(days_ago),
                    importedAt=NOW,
                    sourceUrl=url,
                    imageUrl=None,
                    status="published",
                )
            )
            created += 1
        db.commit()
        print(f"[seed_news] добавлено демо-новостей: {created}")
        return created


def seed_if_empty() -> int:
    """Хук для lifespan: сеет демо-новости только на пустой таблице."""
    return seed_news()


if __name__ == "__main__":
    seed_news()
