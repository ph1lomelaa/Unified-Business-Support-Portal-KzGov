"""Точечная AI-помощь ВНУТРИ конструктора услуги (не генерация целиком).

Дополняет generate_service (текст → черновик целиком): здесь аналитик собирает
форму руками, а AI лишь ПРЕДЛАГАЕТ — типовой набор полей по категории и вероятные
правила ветвления (visibleIf). Всё применяется только с явного подтверждения на
фронте (Принять/Отклонить). Стратегия та же: Claude при ключе, детерминированный
шаблон/эвристика иначе; форма ответа одинакова.
"""

from __future__ import annotations

import json

from sqlmodel import Session, select

from ..config import settings
from ..models import FormSchema, Service
from .client import extract_json, get_client, message_text

# ------------------------------------------------------- типовые шаблоны полей

_COMPANY_PAGE = {
    "name": "company",
    "title": "О компании",
    "elements": [
        {"type": "text", "name": "bin", "title": "БИН/ИИН", "isRequired": True,
         "validators": [{"type": "regex", "regex": "^[0-9]{12}$", "text": "12 цифр"}]},
        {"type": "text", "name": "company_name", "title": "Наименование компании", "isRequired": True},
        {"type": "text", "name": "director", "title": "Первый руководитель", "isRequired": True},
    ],
}


def _num(name, title, **kw):
    return {"type": "number", "name": name, "title": title, **kw}


# набор «полей проекта» по категории (spec-примеры: кредит → сумма/срок/ставка/цель,
# субсидия → плюс расчётные поля)
def _credit_pages() -> list[dict]:
    return [
        {"name": "project", "title": "О проекте", "elements": [
            {"type": "radiogroup", "name": "project_goal", "title": "Цель финансирования", "isRequired": True,
             "choices": [{"value": "working", "text": "Пополнение оборотных средств"},
                         {"value": "investment", "text": "Инвестиции в основные средства"}]},
            _num("loan_amount", "Сумма займа, ₸", isRequired=True, min=1000000),
            _num("loan_term", "Срок займа, мес", isRequired=True, min=1, max=120),
            _num("interest_rate", "Ставка, % годовых", min=0, max=30),
        ]},
    ]


def _subsidy_pages() -> list[dict]:
    return [
        {"name": "loan", "title": "Параметры кредита", "elements": [
            _num("loan_amount", "Сумма кредита, ₸", isRequired=True, min=1000000),
            _num("loan_term", "Срок субсидирования, мес", isRequired=True, min=1, max=84),
            _num("base_rate", "Ставка банка, % годовых", isRequired=True, min=0, max=40),
            _num("subsidy_rate", "Субсидируемая ставка, %", min=0, max=40),
        ]},
        {"name": "calc", "title": "Расчёт", "elements": [
            {"type": "expression", "name": "subsidy_saving", "title": "Экономия за срок субсидирования",
             "expression": "{loan_amount} * {subsidy_rate} / 100 * {loan_term} / 12",
             "displayStyle": "currency", "currency": "KZT"},
        ]},
    ]


def _guarantee_pages() -> list[dict]:
    return [
        {"name": "loan", "title": "Кредит и обеспечение", "elements": [
            _num("loan_amount", "Сумма кредита, ₸", isRequired=True, min=1000000),
            _num("guarantee_share", "Требуемая доля гарантии, %", isRequired=True, min=1, max=85),
            _num("collateral_value", "Стоимость собственного залога, ₸", min=0),
        ]},
    ]


def _leasing_pages() -> list[dict]:
    return [
        {"name": "asset", "title": "Предмет лизинга", "elements": [
            {"type": "dropdown", "name": "asset_type", "title": "Тип предмета лизинга", "isRequired": True,
             "choices": [{"value": "equipment", "text": "Оборудование"}, {"value": "transport", "text": "Транспорт"},
                         {"value": "special", "text": "Спецтехника"}]},
            _num("asset_cost", "Стоимость предмета, ₸", isRequired=True, min=1000000),
            _num("advance_share", "Авансовый платёж, %", isRequired=True, min=0, max=100),
            _num("lease_term", "Срок лизинга, мес", isRequired=True, min=12, max=120),
        ]},
    ]


def _insurance_pages() -> list[dict]:
    return [
        {"name": "contract", "title": "Экспортный контракт", "elements": [
            {"type": "text", "name": "buyer_country", "title": "Страна покупателя", "isRequired": True},
            _num("contract_amount", "Сумма контракта, ₸", isRequired=True, min=0),
            _num("coverage_share", "Требуемое покрытие, %", isRequired=True, min=1, max=90),
        ]},
    ]


def _investment_pages() -> list[dict]:
    return [
        {"name": "project", "title": "Инвестпроект", "elements": [
            _num("project_cost", "Стоимость проекта, ₸", isRequired=True, min=0),
            _num("own_share", "Собственное участие, %", isRequired=True, min=0, max=100),
            _num("jobs_created", "Создаётся рабочих мест", min=0),
        ]},
    ]


_TEMPLATES = {
    "credit": _credit_pages,
    "subsidy": _subsidy_pages,
    "guarantee": _guarantee_pages,
    "leasing": _leasing_pages,
    "insurance": _insurance_pages,
    "investment": _investment_pages,
}


def _template_pages(category: str) -> list[dict]:
    builder = _TEMPLATES.get(category, _credit_pages)
    return [_COMPANY_PAGE, *builder()]


# ------------------------------------------------------------- suggest_fields

_FIELDS_SYSTEM = """Ты — помощник конструктора формы заявки на портале поддержки бизнеса.
Услуга: «{title}» (категория: {category}). Описание: {desc}
Предложи типовой минимальный набор полей формы для этой услуги.
Верни строго JSON: {{"pages":[{{"name","title","elements":[...]}}]}}
elements — в формате SurveyJS (типы: text, number, dropdown, radiogroup, checkbox, boolean, expression).
Правила: 2–4 страницы по 3–5 полей; первая страница «О компании» с полем bin;
имена полей snake_case латиницей; не выдумывай числовые условия конкретной
программы (min/max ставь только очевидные). Ответ только JSON."""


def _valid_pages(pages) -> list[dict]:
    out = []
    for p in pages if isinstance(pages, list) else []:
        if not isinstance(p, dict):
            continue
        els = p.get("elements")
        if not isinstance(els, list) or not els:
            continue
        clean = [e for e in els if isinstance(e, dict) and e.get("name") and e.get("type")]
        if clean:
            out.append({"name": p.get("name") or "page", "title": p.get("title") or "", "elements": clean})
    return out


def suggest_fields(db: Session, service_id: str) -> dict:
    service = db.get(Service, service_id)
    if not service:
        return {"pages": [], "source": "rules"}
    template = _template_pages(service.category)

    client = get_client()
    if client:
        try:
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=1800,
                system=_FIELDS_SYSTEM.format(
                    title=service.title,
                    category=service.category,
                    desc=(service.description or service.summary or "—")[:800],
                ),
                messages=[{"role": "user", "content": "Предложи поля формы."}],
            )
            data = extract_json(message_text(resp))
            pages = _valid_pages(data.get("pages") if isinstance(data, dict) else None)
            if pages:
                return {"pages": pages, "source": "ai"}
        except Exception:
            pass  # → шаблон

    return {"pages": template, "source": "rules"}


# --------------------------------------------------------- suggest_branching

def _walk(elements):
    for el in elements or []:
        if not isinstance(el, dict):
            continue
        if el.get("type") == "panel":
            yield from _walk(el.get("elements"))
        else:
            yield el


def _all_fields(schema: dict) -> list[dict]:
    out = []
    for page in (schema or {}).get("pages", []) or []:
        out.extend(_walk(page.get("elements")))
    return out


def _active_schema(db: Session, service_id: str) -> dict:
    fs = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()
    return fs.schema if fs and isinstance(fs.schema, dict) else {"pages": []}


def _tokens(*parts: str) -> set[str]:
    import re

    words: set[str] = set()
    for p in parts:
        words.update(w for w in re.findall(r"[a-zа-яё0-9]{3,}", (p or "").lower()))
    return words


def _heuristic_rules(field: dict, others: list[dict]) -> list[dict]:
    """Офлайн: связываем поле с вариантами по совпадению слов в имени/заголовке.
    Осознанно осторожно — предлагаем только явные совпадения, остальное — за AI."""
    rules = []
    name = field.get("name")
    for ch in field.get("choices") or []:
        val = ch.get("value") if isinstance(ch, dict) else ch
        text = ch.get("text") if isinstance(ch, dict) else str(ch)
        ch_tokens = _tokens(str(val), str(text))
        for o in others:
            if o.get("name") == name or o.get("visibleIf"):
                continue
            if _tokens(o.get("name", ""), o.get("title", "")) & ch_tokens:
                rules.append({
                    "targetField": o["name"],
                    "targetTitle": o.get("title") or o["name"],
                    "visibleIf": f"{{{name}}} = '{val}'",
                    "reason": f"«{o.get('title') or o['name']}» по смыслу связано с вариантом «{text}».",
                })
    # уникализируем по (targetField)
    seen, uniq = set(), []
    for r in rules:
        if r["targetField"] in seen:
            continue
        seen.add(r["targetField"])
        uniq.append(r)
    return uniq[:5]


_BRANCH_SYSTEM = """Ты — помощник конструктора формы заявки. Пользователь выбрал поле
с вариантами ответа. Предложи вероятные правила ветвления (visibleIf): какие ДРУГИЕ
поля показывать только при определённых значениях этого поля.
Поле «{field}» (варианты: {choices}).
Другие поля формы (имя: заголовок, тип): {others}
Верни строго JSON: {{"rules":[{{"targetField","visibleIf","reason"}}]}}
visibleIf — выражение SurveyJS вида "{{{field}}} = 'значение'"; targetField — только из
списка других полей; reason — 1 короткое предложение почему. Максимум 5 правил.
Не предлагай правила для полей, которые логично показывать всегда. Только JSON."""


def suggest_branching(db: Session, service_id: str, field_name: str, schema: dict) -> dict:
    schema = schema if isinstance(schema, dict) and schema.get("pages") else _active_schema(db, service_id)
    fields = _all_fields(schema)
    field = next((f for f in fields if f.get("name") == field_name), None)
    if not field or not field.get("choices"):
        return {"rules": [], "source": "rules"}
    others = [f for f in fields if f.get("name") and f.get("name") != field_name]
    valid_names = {f["name"] for f in others}

    client = get_client()
    if client:
        try:
            choices = [
                {"value": (c.get("value") if isinstance(c, dict) else c),
                 "text": (c.get("text") if isinstance(c, dict) else str(c))}
                for c in field.get("choices") or []
            ]
            others_desc = [
                {"name": f["name"], "title": f.get("title") or f["name"], "type": f.get("type")}
                for f in others
            ]
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=900,
                system=_BRANCH_SYSTEM.format(
                    field=field_name,
                    choices=json.dumps(choices, ensure_ascii=False),
                    others=json.dumps(others_desc, ensure_ascii=False),
                ),
                messages=[{"role": "user", "content": "Предложи ветвление."}],
            )
            data = extract_json(message_text(resp))
            raw = data.get("rules") if isinstance(data, dict) else None
            rules = []
            for r in raw or []:
                tgt = r.get("targetField")
                vif = r.get("visibleIf")
                if tgt in valid_names and isinstance(vif, str) and field_name in vif:
                    title = next((f.get("title") or tgt for f in others if f["name"] == tgt), tgt)
                    rules.append({
                        "targetField": tgt, "targetTitle": title,
                        "visibleIf": vif, "reason": r.get("reason") or "",
                    })
            if rules:
                return {"rules": rules[:5], "source": "ai"}
        except Exception:
            pass

    return {"rules": _heuristic_rules(field, others), "source": "rules"}
