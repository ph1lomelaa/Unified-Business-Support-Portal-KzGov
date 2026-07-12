"""Public read API for reference dictionaries (справочники, Фаза 2).

Consumed by the SurveyJS form constructor (`choicesByUrl`) and the runtime
wizard, so these endpoints are intentionally public and cache-friendly. The
`/items` shape is SurveyJS-ready ([{value, text}]) and supports a `parent`
filter for dependent (cascading) dropdowns, e.g. регион -> район via a url like
`/api/v1/dictionaries/districts/items?parent={region}`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..models import Dictionary, DictionaryItem

router = APIRouter(prefix="/api/v1/dictionaries", tags=["dictionaries"])


def _sorted_items(items: list[DictionaryItem]) -> list[DictionaryItem]:
    return sorted(items, key=lambda i: (i.sortOrder, i.label))


@router.get("")
def list_dictionaries(db: Session = Depends(get_session)):
    dictionaries = db.exec(
        select(Dictionary).where(Dictionary.status == "active")
    ).all()
    return [
        {
            "code": d.code,
            "title": d.title,
            "description": d.description,
            "source": d.source,
            "hierarchical": d.hierarchical,
            "count": sum(1 for i in d.items if i.isActive),
        }
        for d in sorted(dictionaries, key=lambda d: d.title)
    ]


@router.get("/{code}")
def get_dictionary(code: str, db: Session = Depends(get_session)):
    dictionary = db.exec(select(Dictionary).where(Dictionary.code == code)).first()
    if not dictionary:
        raise HTTPException(404, f"Справочник '{code}' не найден")
    return {
        "code": dictionary.code,
        "title": dictionary.title,
        "description": dictionary.description,
        "source": dictionary.source,
        "hierarchical": dictionary.hierarchical,
        "items": [
            {"value": i.value, "text": i.label, "parentValue": i.parentValue}
            for i in _sorted_items([i for i in dictionary.items if i.isActive])
        ],
    }


@router.get("/{code}/items")
def get_dictionary_items(
    code: str,
    parent: str | None = Query(default=None),
    db: Session = Depends(get_session),
):
    """SurveyJS-shaped choices. `?parent=` filters children for cascading
    dropdowns; an empty/unmatched parent returns an empty list rather than 404
    so a form with an unselected parent renders cleanly."""
    dictionary = db.exec(select(Dictionary).where(Dictionary.code == code)).first()
    if not dictionary:
        raise HTTPException(404, f"Справочник '{code}' не найден")
    items = [i for i in dictionary.items if i.isActive]
    if parent is not None:
        items = [i for i in items if (i.parentValue or "") == parent]
    return [{"value": i.value, "text": i.label} for i in _sorted_items(items)]
