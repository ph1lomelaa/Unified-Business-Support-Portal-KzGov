"""AI navigator (spec Часть 8): free-text business need -> up to 3 services.

Claude when a key is configured; a deterministic keyword match otherwise or on
any error/timeout. Either way the response shape is identical, so the frontend
does not care which path ran.
"""

from __future__ import annotations

import json
import re
import time

from sqlmodel import Session, select

from ..config import settings
from ..models import Organization, Service
from .client import extract_json, get_client, message_text
from .retrieval import keyword_score

SYSTEM_PROMPT = """Ты — навигатор портала поддержки бизнеса Казахстана (холдинг «Байтерек»).
Вот каталог услуг (JSON): {catalog}
Пользователь описывает бизнес и потребность. Верни строго JSON:
{{"recommendations":[{{"serviceId":"...","reason":"1-2 предложения, почему подходит, с цифрами условий"}}],
 "clarify": "уточняющий вопрос или null"}}
Правила: максимум 3 рекомендации; только id из каталога; не выдумывай условий;
если запрос не про бизнес-поддержку — пустой массив и вежливое clarify.
Отвечай на языке запроса (русский/казахский). Только JSON, без пояснений."""

_CACHE_TTL = 60 * 15
_NAV_CACHE: dict[str, tuple[float, dict]] = {}

WARMUP_QUERIES = [
    "Нужны деньги на закуп КРС в Костанайской области",
    "Хочу застраховать экспортный контракт",
    "Кредит на расширение производственного цеха",
]


def _catalog(db: Session) -> list[dict]:
    rows = db.exec(
        select(Service, Organization)
        .join(Organization, Service.orgId == Organization.id, isouter=True)
        .where(Service.status == "published")
    ).all()
    out = []
    for s, o in rows:
        out.append(
            {
                "id": s.id,
                "slug": s.slug,
                "title": s.title,
                "org": o.shortName if o else "",
                "category": s.category,
                "summary": s.summary,
                "tags": s.tags,
                "conditions": s.conditions,
            }
        )
    return out


def _resolve(db: Session, service_id: str) -> dict | None:
    s = db.get(Service, service_id)
    if not s or s.status != "published":
        return None
    o = db.get(Organization, s.orgId)
    return {
        "id": s.id,
        "slug": s.slug,
        "title": s.title,
        "category": s.category,
        "summary": s.summary,
        "conditions": s.conditions,
        "status": s.status,
        "org": {"shortName": o.shortName, "name": o.name, "color": o.color, "logo": o.logo or None}
        if o else None,
    }


def navigate(db: Session, query: str) -> dict:
    cache_key = re.sub(r"\s+", " ", (query or "").strip().lower())
    now = time.time()
    cached = _NAV_CACHE.get(cache_key)
    if cached and cached[0] > now:
        return {**cached[1], "cached": True}

    catalog = _catalog(db)
    client = get_client()

    if client and query.strip():
        try:
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=700,
                system=SYSTEM_PROMPT.format(catalog=json.dumps(catalog, ensure_ascii=False)),
                messages=[{"role": "user", "content": query}],
            )
            data = extract_json(message_text(resp))
            recs = []
            for r in (data.get("recommendations") or [])[:3]:
                svc = _resolve(db, r.get("serviceId", ""))
                if svc:
                    recs.append({
                        "service": svc,
                        "reason": r.get("reason", ""),
                        "evidence": (svc.get("conditions") or [])[:3],
                    })
            if recs or data.get("clarify"):
                result = {
                    "recommendations": recs,
                    "clarify": data.get("clarify"),
                    "source": "ai",
                    "cached": False,
                }
                _NAV_CACHE[cache_key] = (now + _CACHE_TTL, result)
                return result
        except Exception:
            pass  # fall through to keyword match

    result = _keyword_fallback(db, query, catalog)
    result["cached"] = False
    _NAV_CACHE[cache_key] = (now + _CACHE_TTL, result)
    return result


def warmup_navigation(db: Session) -> dict:
    warmed = []
    for q in WARMUP_QUERIES:
        result = navigate(db, q)
        warmed.append(
            {
                "query": q,
                "source": result.get("source"),
                "recommendations": len(result.get("recommendations") or []),
            }
        )
    return {"warmed": warmed, "cacheSize": len(_NAV_CACHE)}


def _keyword_fallback(db: Session, query: str, catalog: list[dict]) -> dict:
    scored: list[tuple[int, dict]] = []
    for c in catalog:
        score = keyword_score(
            query,
            [c["title"], c["summary"], c.get("tags"), c["category"]],
            boosts=[c["slug"], c["category"]],
            tags=c.get("tags") or {},
        )
        if score > 0:
            scored.append((score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]
    recs = []
    for _, c in top:
        svc = _resolve(db, c["id"])
        if svc:
            cond = svc["conditions"][0] if svc["conditions"] else None
            reason = c["summary"] or (
                f"{cond['label']}: {cond['value']}" if cond else ""
            )
            recs.append({
                "service": svc,
                "reason": reason,
                "evidence": (svc.get("conditions") or [])[:3],
            })

    clarify = None
    if not recs:
        clarify = (
            "Опишите подробнее: отрасль, размер бизнеса и на что нужны средства "
            "(оборот, инвестиции, экспорт)."
        )
    return {"recommendations": recs, "clarify": clarify, "source": "fallback"}
