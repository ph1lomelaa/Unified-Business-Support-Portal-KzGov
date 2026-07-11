"""Разбиение схемы формы на этапы (I этап / II этап) — чистое доменное ядро.

Услуга становится многоэтапной пометкой страниц `stage: 2` в конструкторе, без
изменений кода (spec разд. 5, критерий 9.1). Первичная подача проходит по
страницам этапа 1; страницы этапа 2 (расширенные данные/документы) собираются
позже из личного кабинета.
"""

from __future__ import annotations


def split_schema_by_stage(schema: dict) -> tuple[list[dict], list[dict]]:
    """Return (stage1_pages, stage2_pages). A page is stage 2 when its `stage`
    == 2; anything else (unmarked, stage 1) belongs to первичная подача."""
    pages = (schema or {}).get("pages", []) or []
    stage1 = [p for p in pages if p.get("stage") != 2]
    stage2 = [p for p in pages if p.get("stage") == 2]
    return stage1, stage2


def has_stage2(schema: dict) -> bool:
    """True if the schema declares any second-stage pages."""
    return bool(split_schema_by_stage(schema)[1])
