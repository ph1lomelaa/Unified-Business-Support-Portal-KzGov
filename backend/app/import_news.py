from __future__ import annotations

from sqlmodel import Session

from .db import engine, init_db
from .sources.news_scrape import import_news


def main() -> None:
    init_db()
    with Session(engine) as db:
        stats = import_news(db)
    for source_id, row in stats.items():
        errors = "; ".join(row["errors"]) if row["errors"] else "ok"
        print(
            f"{source_id}: found={row['found']} changed={row['changed']} "
            f"skippedRobots={row['skippedRobots']} status={errors}"
        )


if __name__ == "__main__":
    main()
