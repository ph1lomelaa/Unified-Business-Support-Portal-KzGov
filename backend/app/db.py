from collections.abc import Iterator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from .config import settings

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=connect_args,
)


def init_db() -> None:
    # Import models so SQLModel metadata is populated before create_all.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _run_lightweight_migrations()


def _run_lightweight_migrations() -> None:
    """Small compatibility fixes for existing demo Postgres volumes.

    SQLModel.create_all creates new tables but does not alter old ones. Project
    financing amounts exceed PostgreSQL INTEGER, so older volumes need a one-off
    widening to BIGINT before seed_content inserts map projects.
    """
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as conn:
        data_type = conn.execute(
            text(
                """
                SELECT data_type
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'project'
                  AND column_name = 'amount'
                """
            )
        ).scalar_one_or_none()
        if data_type == "integer":
            conn.execute(text('ALTER TABLE "project" ALTER COLUMN amount TYPE BIGINT'))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
