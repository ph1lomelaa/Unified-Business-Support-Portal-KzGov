from __future__ import annotations

import json
import re
from collections.abc import Iterable

_WORD = re.compile(r"[а-яёa-zА-ЯЁA-Z0-9]{3,}", re.UNICODE)

# hint words -> tags/categories, shared by the one-shot navigator and chat RAG.
HINTS: dict[str, list[str]] = {
    "скот": ["agro"],
    "коров": ["agro"],
    "живот": ["agro"],
    "ферм": ["agro"],
    "агро": ["agro"],
    "поле": ["agro"],
    "село": ["agro"],
    "экспорт": ["kazakhexport-insurance"],
    "контракт": ["kazakhexport-insurance"],
    "субсид": ["subsidy"],
    "ставк": ["subsidy"],
    "процент": ["subsidy"],
    "кредит": ["credit"],
    "заём": ["credit"],
    "заем": ["credit"],
    "гаранти": ["guarantee"],
    "залог": ["guarantee"],
    "завод": ["manufacturing"],
    "цех": ["manufacturing"],
    "производ": ["manufacturing"],
    "ипотек": ["kzhk-mortgage-subsidy"],
    "недвиж": ["kzhk-mortgage-subsidy"],
    "документ": ["documents"],
    "справк": ["documents"],
    "70": ["subsidy"],
    "85": ["guarantee"],
}


def query_terms(query: str) -> tuple[set[str], set[str], str]:
    q = (query or "").lower()
    words = set(_WORD.findall(q))
    boosts: set[str] = set()
    for stem, targets in HINTS.items():
        if stem in q:
            boosts.update(targets)
    return words, boosts, q


def keyword_score(
    query: str,
    fields: Iterable[object],
    *,
    boosts: Iterable[str] = (),
    tags: dict | None = None,
) -> int:
    words, query_boosts, _ = query_terms(query)
    hay = " ".join(_stringify(field) for field in fields).lower()
    score = sum(1 for word in words if word in hay)
    item_boosts = {str(item).lower() for item in boosts if item}
    if item_boosts & query_boosts:
        score += 3
    for ind in (tags or {}).get("industries", []):
        if str(ind).lower() in query_boosts:
            score += 3
    return score


def _stringify(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)
