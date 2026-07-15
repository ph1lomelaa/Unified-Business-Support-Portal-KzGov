from __future__ import annotations

import json
from typing import Any

from sqlmodel import Session, select

from ..config import settings
from ..models import Calculator, FaqEntry, KnowledgeItem, Organization, Service
from .client import get_client, message_text
from .retrieval import keyword_score

MAX_HISTORY = 12


DEFAULT_SUGGESTIONS = [
    "Какая мера поддержки мне подходит?",
    "Какие документы нужны для заявки?",
    "Сравни субсидирование и кредитование",
]


def chat(db: Session, messages: list[dict[str, str]]) -> dict:
    clean_messages = _clean_messages(messages)
    query = _last_user_message(clean_messages)
    # Ретрив по нескольким последним репликам пользователя — чтобы уточняющие
    # вопросы («а какие документы?») не теряли контекст обсуждаемой меры.
    retrieval_query = _recent_user_text(clean_messages)
    ctx = _retrieve(db, retrieval_query)
    # Чат-эндпоинт: больший таймаут (разговорный ответ дольше, чем навигатор).
    client = get_client(timeout=25.0)

    if client and query:
        try:
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=800,
                system=_system_prompt(ctx),
                messages=clean_messages[-MAX_HISTORY:],
            )
            reply, control = _split_control_json(message_text(resp))
            cards = _resolve_cards(db, control.get("cards") or [])
            # Гарантируем кликабельные карточки: если модель не вернула управляющий
            # JSON с cards (gpt-4o-mini иногда его опускает), подставляем самые
            # релевантные услуги/материалы из ретрива — чтобы «AI подобрал → можно
            # кликнуть и перейти», а не только текст.
            if not cards:
                cards = _cards_from_ctx(ctx)
            suggestions = _suggestions(control.get("suggestions"))
            if reply.strip():
                return {
                    "reply": reply.strip(),
                    "cards": cards,
                    "source": "ai",
                    "suggestions": suggestions,
                }
        except Exception:
            pass

    return _fallback(ctx, query)


def _clean_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in messages[-MAX_HISTORY:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            out.append({"role": role, "content": content[:2000]})
    return out


def _last_user_message(messages: list[dict[str, str]]) -> str:
    for item in reversed(messages):
        if item.get("role") == "user":
            return item.get("content", "")
    return ""


def _recent_user_text(messages: list[dict[str, str]], limit: int = 3) -> str:
    """Склейка нескольких последних реплик пользователя для ретрива — контекст
    диалога сохраняется при уточняющих вопросах."""
    users = [m.get("content", "") for m in messages if m.get("role") == "user"]
    return "\n".join(users[-limit:])


def _retrieve(db: Session, query: str) -> dict[str, list[dict]]:
    services = _services(db, query)
    knowledge = _knowledge(db, query)
    faq = _faq(db, query)
    calculators = _calculators(db)
    return {
        "services": services[:6],
        "knowledge": knowledge[:4],
        "faq": faq[:4],
        "calculators": calculators,
    }


def _services(db: Session, query: str) -> list[dict]:
    rows = db.exec(
        select(Service, Organization)
        .join(Organization, Service.orgId == Organization.id, isouter=True)
        .where(Service.status == "published")
    ).all()
    scored: list[tuple[int, dict]] = []
    for service, org in rows:
        item = {
            "type": "service",
            "id": service.id,
            "slug": service.slug,
            "title": service.title,
            "org": org.shortName if org else "",
            "category": service.category,
            "summary": service.summary,
            "conditions": service.conditions or [],
            "documents": service.documents or [],
        }
        score = keyword_score(
            query,
            [
                service.title,
                service.summary,
                service.category,
                service.conditions,
                service.documents,
                service.tags,
            ],
            boosts=[service.slug, service.category],
            tags=service.tags or {},
        )
        if score > 0:
            scored.append((score, item))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in scored]


def _knowledge(db: Session, query: str) -> list[dict]:
    rows = db.exec(select(KnowledgeItem)).all()
    scored: list[tuple[int, dict]] = []
    for item in rows:
        card = {
            "type": "knowledge",
            "slug": item.slug,
            "kind": item.type,
            "title": item.title,
            "summary": item.summary,
            "body": _excerpt(item.body),
        }
        score = keyword_score(
            query,
            [item.title, item.type, item.summary, item.body, item.relatedServiceSlugs],
            boosts=[item.slug, item.type, *(item.relatedServiceSlugs or [])],
        )
        if score > 0:
            scored.append((score, card))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in scored]


def _faq(db: Session, query: str) -> list[dict]:
    rows = db.exec(select(FaqEntry).order_by(FaqEntry.order)).all()
    scored: list[tuple[int, dict]] = []
    for item in rows:
        card = {"question": item.question, "answer": item.answer}
        score = keyword_score(query, [item.question, item.answer])
        if score > 0:
            scored.append((score, card))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in scored]


def _calculators(db: Session) -> list[dict]:
    rows = db.exec(
        select(Calculator).where(Calculator.status == "published").order_by(Calculator.title)
    ).all()
    return [
        {
            "type": "calculator",
            "slug": item.slug,
            "title": item.title,
            "summary": item.summary,
        }
        for item in rows
    ]


def _excerpt(text: str, limit: int = 700) -> str:
    clean = " ".join((text or "").split())
    return clean[:limit]


def _system_prompt(ctx: dict[str, list[dict]]) -> str:
    return f"""Ты — консультант-навигатор Единого портала поддержки бизнеса холдинга «Байтерек».
Твоя задача — как живой менеджер поддержки: понять ситуацию предпринимателя и
подобрать конкретные меры поддержки, объяснить условия и провести по шагам подачи.

Контекст из базы портала (услуги, статьи базы знаний, калькуляторы, FAQ):
{json.dumps(ctx, ensure_ascii=False)}

Как вести диалог:
- отвечай на языке пользователя (русский или казахский), тепло и по делу, без канцелярита;
- помни весь диалог: учитывай, что человек уже рассказал (отрасль, размер бизнеса, цель, регион), и не переспрашивай это заново;
- если данных для точного подбора мало — задай ОДИН короткий уточняющий вопрос (например, о цели финансирования, отрасли или регионе), а не отказывай;
- когда меры понятны — назови 1–3 конкретные подходящие услуги из контекста, для каждой коротко: кому подходит, цель, сумма/срок/ставка (только если они есть в контексте) и почему подходит именно этому бизнесу;
- умей сравнивать меры (например, субсидирование ставки vs кредитование vs гарантия), объяснять документы и вести по шагам подачи заявки;
- предлагай калькулятор, если уместно оценить платёж или экономию.

Тон и формат (профессионально, как консультант банка развития, читается в узком чате):
- сразу по сути, без «воды» и вводных вроде «Конечно!», «Отличный вопрос»;
- НИКОГДА не пиши всё одним сплошным абзацем: дели ответ на короткие абзацы и разделяй их пустой строкой (переносом строки);
- каждую отдельную меру поддержки выноси отдельным пунктом списка (- или 1.), а не в одну строку через запятую;
- пиши компактно: короткие абзацы; при перечислении — маркированный или нумерованный список;
- выделяй ключевые слова **жирным** (названия услуг, «Сумма», «Срок», «Ставка», «Покрытие»);
- НЕ используй крупные заголовки (###, ##), markdown-таблицы и эмодзи — только абзацы, списки и **жирный**.

СТРОГО ЗАПРЕЩЕНЫ шаблонные ИИ-обороты (звучат непрофессионально):
- дежурные подписи в конце: «Если хотите узнать подробности — сообщите!», «дайте знать!», «обращайтесь!», «надеюсь, это поможет», «Также можете использовать калькуляторы»;
- фразы-заглушки «Рассмотрите программы, как:», «Вот несколько вариантов:», «В целом»;
- отправка «в AI-навигатор на главной» — ты и есть навигатор.
Вместо дежурной подписи заверши ответ конкретикой: следующий практический шаг
(например: «Дальше — подготовьте экспортный контракт и подайте заявку по кнопке в карточке услуги»)
или ОДИН точный уточняющий вопрос по делу. Не задавай уточняющий вопрос, если уже дал рекомендацию по всем известным данным.

Строгие правила:
- НЕ выдумывай условия, проценты, суммы, сроки и названия — бери только из контекста; если чего-то нет — честно скажи, что уточнить это нужно у оператора услуги;
- НЕ отправляй пользователя «в AI-навигатор на главной» и не отвечай общими фразами — ты и есть навигатор, помогай прямо здесь;
- НЕ вставляй markdown-ссылки и внешние URL — ссылки на услуги/статьи/калькуляторы показываются отдельными карточками (укажи их через slug ниже);
- если по запросу в базе действительно нет подходящего — честно скажи и предложи уточнить отрасль, цель, регион или размер бизнеса.

В самом конце ответа отдельной последней строкой верни JSON строго такого вида
(это не показывается пользователю, это управляющая строка):
{{"cards":[{{"type":"service|knowledge|calculator","slug":"..."}}], "suggestions":["короткий вопрос-подсказка","..."]}}
— в cards положи услуги/статьи/калькуляторы из контекста, о которых ты говоришь (по их slug);
— в suggestions предложи 2–3 логичных следующих вопроса пользователя по этой теме.
"""


def _split_control_json(text: str) -> tuple[str, dict[str, Any]]:
    raw = (text or "").strip()
    decoder = json.JSONDecoder()
    best: tuple[int, int, dict[str, Any]] | None = None
    for idx, char in enumerate(raw):
        if char != "{":
            continue
        try:
            data, end = decoder.raw_decode(raw[idx:])
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and ("cards" in data or "suggestions" in data):
            best = (idx, idx + end, data)
    if not best:
        return raw, {}
    start, end, data = best
    reply = (raw[:start] + raw[end:]).strip()
    return reply, data


def _resolve_cards(db: Session, raw_cards: list) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for item in raw_cards[:8]:
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        slug = item.get("slug")
        if kind not in {"service", "knowledge", "calculator"} or not slug:
            continue
        key = (kind, str(slug))
        if key in seen:
            continue
        card = _resolve_card(db, kind, str(slug))
        if card:
            seen.add(key)
            out.append(card)
    return out


def _resolve_card(db: Session, kind: str, slug: str) -> dict | None:
    if kind == "service":
        row = db.exec(
            select(Service, Organization)
            .join(Organization, Service.orgId == Organization.id, isouter=True)
            .where(Service.slug == slug, Service.status == "published")
        ).first()
        if not row:
            return None
        service, org = row
        return {
            "type": "service",
            "slug": service.slug,
            "title": service.title,
            "summary": service.summary,
            "org": org.shortName if org else "",
            "href": f"/services/{service.slug}",
        }
    if kind == "knowledge":
        item = db.exec(select(KnowledgeItem).where(KnowledgeItem.slug == slug)).first()
        if not item:
            return None
        return {
            "type": "knowledge",
            "slug": item.slug,
            "title": item.title,
            "summary": item.summary,
            "org": "База знаний",
            "href": f"/knowledge/{item.slug}",
        }
    item = db.exec(
        select(Calculator).where(Calculator.slug == slug, Calculator.status == "published")
    ).first()
    if not item:
        return None
    return {
        "type": "calculator",
        "slug": item.slug,
        "title": item.title,
        "summary": item.summary,
        "org": "Калькулятор",
        "href": "/calculators",
    }


def _suggestions(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return DEFAULT_SUGGESTIONS
    items = [str(item).strip()[:120] for item in raw if str(item).strip()]
    return items[:4] or DEFAULT_SUGGESTIONS


def _cards_from_ctx(ctx: dict[str, list[dict]]) -> list[dict]:
    """Кликабельные карточки из результатов ретрива (услуги, база знаний,
    калькулятор) — общий источник для fallback и для AI-ответа без control-JSON."""
    cards: list[dict] = []
    for item in ctx["services"][:3]:
        cards.append(
            {
                "type": "service",
                "slug": item["slug"],
                "title": item["title"],
                "summary": item["summary"],
                "org": item["org"],
                "href": f"/services/{item['slug']}",
            }
        )
    for item in ctx["knowledge"][:2]:
        cards.append(
            {
                "type": "knowledge",
                "slug": item["slug"],
                "title": item["title"],
                "summary": item["summary"],
                "org": "База знаний",
                "href": f"/knowledge/{item['slug']}",
            }
        )
    if ctx["calculators"]:
        calc = ctx["calculators"][0]
        cards.append({**calc, "org": "Калькулятор", "href": "/calculators"})
    return cards[:6]


def _fallback(ctx: dict[str, list[dict]], query: str) -> dict:
    cards = _cards_from_ctx(ctx)

    if cards:
        reply = (
            "Я нашёл подходящие материалы в базе портала. Ниже — услуги и разделы, "
            "которые лучше всего совпадают с вашим запросом."
        )
    elif query:
        reply = (
            "По этому запросу в базе портала не нашлось точного совпадения. "
            "Уточните отрасль, цель финансирования, регион и размер бизнеса."
        )
    else:
        reply = "Напишите, какая поддержка нужна бизнесу: финансирование, субсидия, гарантия, экспорт или документы."

    return {
        "reply": reply,
        "cards": cards[:6],
        "source": "fallback",
        "suggestions": DEFAULT_SUGGESTIONS,
    }
