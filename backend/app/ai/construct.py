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
    # SurveyJS не имеет типа "number" — числовое поле это text + inputType number,
    # иначе поле не рендерится в форме.
    return {"type": "text", "inputType": "number", "name": name, "title": title, **kw}


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


# ------------------------------------------------------------- audit_schema

def _referenced_names(expr: str) -> set[str]:
    import re

    return set(re.findall(r"\{([a-zA-Z0-9_.\[\]]+)\}", expr or ""))


def deterministic_schema_issues(schema: dict) -> list[dict]:
    """Офлайн-аудит схемы формы: ищем типовые «дыры», не полагаясь на AI.
    severity: error (сломает форму) | warning (скорее всего проблема) | info."""
    issues: list[dict] = []
    pages = (schema or {}).get("pages") or []
    fields = _all_fields(schema)
    names = {f.get("name") for f in fields if f.get("name")}

    if not pages or not fields:
        return [{
            "severity": "error", "field": None,
            "message": "Форма пустая — нет ни одного поля.",
            "hint": "Добавьте страницы и поля или воспользуйтесь «Предложить поля».",
        }]

    # 1. Нет панели БИН/ИИН — почти всем услугам нужен идентификатор заявителя.
    if not ({"bin", "iin", "bin_iin"} & {str(n).lower() for n in names}):
        issues.append({
            "severity": "warning", "field": None,
            "message": "Нет поля БИН/ИИН заявителя.",
            "hint": "Вставьте пресет «БИН-панель» — он добавит идентификатор с проверкой формата.",
        })

    # 2. Нет загрузки документов.
    if not any(f.get("type") == "file" for f in fields):
        issues.append({
            "severity": "warning", "field": None,
            "message": "В форме нет ни одного поля загрузки документа.",
            "hint": "Большинству мер поддержки нужны подтверждающие документы — добавьте поле «файл».",
        })

    # 3. Ни одно поле не обязательно.
    if not any(f.get("isRequired") for f in fields):
        issues.append({
            "severity": "warning", "field": None,
            "message": "Ни одно поле не помечено обязательным.",
            "hint": "Отметьте ключевые поля как обязательные, чтобы заявки приходили заполненными.",
        })

    # 4. Дубли имён полей — сломают сохранение значений.
    seen: set[str] = set()
    for f in fields:
        n = f.get("name")
        if n in seen:
            issues.append({
                "severity": "error", "field": n,
                "message": f"Дублируется имя поля «{n}».",
                "hint": "Переименуйте одно из полей — имена должны быть уникальны.",
            })
        seen.add(n)

    for f in fields:
        name = f.get("name")
        ftype = f.get("type")
        title = f.get("title") or name

        # 5. Поле с вариантами, но без вариантов и без справочника.
        if ftype in {"dropdown", "radiogroup", "checkbox", "tagbox"}:
            has_choices = bool(f.get("choices"))
            has_url = bool(f.get("choicesByUrl") or f.get("dictionaryCode"))
            if not has_choices and not has_url:
                issues.append({
                    "severity": "error", "field": name,
                    "message": f"«{title}» — список без вариантов ответа.",
                    "hint": "Добавьте варианты или привяжите справочник (свойство «Справочник (ЕППБ)»).",
                })

        # 6. visibleIf/expression ссылается на несуществующее поле — битая ветка.
        for prop in ("visibleIf", "enableIf", "requiredIf", "expression"):
            expr = f.get(prop)
            if isinstance(expr, str) and expr:
                missing = _referenced_names(expr) - names
                # {panel...}/{row...} служебные токены пропускаем
                missing = {m for m in missing if "." not in m and "[" not in m}
                if missing:
                    issues.append({
                        "severity": "error", "field": name,
                        "message": f"«{title}»: условие ссылается на несуществующее поле: {', '.join(sorted(missing))}.",
                        "hint": "Проверьте имена полей в условии — возможно, поле переименовано или удалено.",
                    })
                if name and name in _referenced_names(expr):
                    issues.append({
                        "severity": "error", "field": name,
                        "message": f"«{title}»: условие циклически ссылается на само поле.",
                        "hint": "Выберите другое поле-источник для условия.",
                    })

        if f.get("isRequired") and f.get("visibleIf"):
            issues.append({
                "severity": "info", "field": name,
                "message": f"«{title}» обязательное, но показывается по условию.",
                "hint": "Проверьте preview обоих сценариев: скрытого и отображаемого поля.",
            })

        # 7. Расчётное поле должно содержать безопасную арифметическую формулу.
        if ftype == "expression" and isinstance(f.get("expression"), str):
            from ..calc_eval import FormulaError, evaluate

            formula = f["expression"]
            refs = _referenced_names(formula)
            normalized = formula
            for ref in refs:
                normalized = normalized.replace("{" + ref + "}", ref)
            try:
                evaluate(normalized, {ref: 1.0 for ref in refs})
            except FormulaError as exc:
                issues.append({
                    "severity": "error", "field": name,
                    "message": f"«{title}»: некорректная формула ({exc}).",
                    "hint": "Исправьте формулу в сборщике расчётов перед публикацией.",
                })

    return issues


_AUDIT_SYSTEM = """Ты — методолог форм на портале поддержки бизнеса. Проверь схему формы
(SurveyJS) на «дыры»: пропущенные обязательные поля, отсутствие идентификатора заявителя,
отсутствие загрузки документов, списки без вариантов, битые условия visibleIf, нелогичный
порядок. Схема: {schema}
Верни строго JSON: {{"issues":[{{"severity","field","message","hint"}}]}}
severity ∈ error|warning|info; field — имя поля или null; message — коротко что не так;
hint — что сделать. Максимум 8 пунктов, самое важное первым. Только JSON."""


def audit_schema(schema: dict) -> dict:
    """«Проверь форму на дыры»: список проблем схемы. Claude при ключе, иначе —
    детерминированные эвристики. Форма ответа одинакова."""
    schema = schema if isinstance(schema, dict) else {"pages": []}
    heuristic = deterministic_schema_issues(schema)

    client = get_client()
    if client:
        try:
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=1100,
                system=_AUDIT_SYSTEM.format(
                    schema=json.dumps(schema, ensure_ascii=False)[:6000]
                ),
                messages=[{"role": "user", "content": "Проверь форму."}],
            )
            data = extract_json(message_text(resp))
            raw = data.get("issues") if isinstance(data, dict) else None
            issues = []
            for it in raw or []:
                if not isinstance(it, dict) or not it.get("message"):
                    continue
                sev = it.get("severity")
                issues.append({
                    "severity": sev if sev in {"error", "warning", "info"} else "warning",
                    "field": it.get("field"),
                    "message": str(it.get("message")),
                    "hint": str(it.get("hint") or ""),
                })
            if issues:
                return {"issues": issues[:8], "source": "ai", "ok": False}
        except Exception:
            pass

    return {
        "issues": heuristic[:8],
        "source": "rules",
        "ok": len(heuristic) == 0,
    }
