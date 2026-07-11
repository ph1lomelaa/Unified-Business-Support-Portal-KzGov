"""Встроенные в путь заполнения AI-помощники (spec 6.6, items 3–4).

Два независимых помощника, оба со стратегией «AI-слой поверх детерминированного
ядра»: при заданном ключе Claude уточняет формулировку, при любой ошибке/таймауте
или без ключа откатываемся к офлайн-логике. Форма ответа одинакова — фронт не
различает источник.

* validate_field — мягкая проверка ТЕКСТОВЫХ полей при потере фокуса (onBlur):
  ловим случайный набор символов и слишком короткие описания, предлагаем
  исправление. Не блокирует переход между шагами — только информирует.
* field_help — короткая подсказка по полю: объяснение по клику «?» и проактивная
  реакция на выбор «сложной» опции (напр. цель «инвестиции» → доп. условие).
"""

from __future__ import annotations

import json
import re

from sqlmodel import Session, select

from ..config import settings
from ..models import FormSchema, Service
from .client import extract_json, get_client, message_text

# ------------------------------------------------------------------ helpers --

def _walk(elements: list | None):
    """Плоский обход элементов формы, включая вложенные panel."""
    for el in elements or []:
        if not isinstance(el, dict):
            continue
        if el.get("type") == "panel":
            yield from _walk(el.get("elements"))
        else:
            yield el


def _active_schema(db: Session, service_id: str) -> dict:
    fs = db.exec(
        select(FormSchema)
        .where(FormSchema.serviceId == service_id, FormSchema.isActive == True)  # noqa: E712
        .order_by(FormSchema.version.desc())
    ).first()
    return fs.schema if fs and isinstance(fs.schema, dict) else {"pages": []}


def _find_field(schema: dict, field_name: str) -> dict | None:
    for page in (schema or {}).get("pages", []) or []:
        for el in _walk(page.get("elements")):
            if el.get("name") == field_name:
                return el
    return None


def _find_choice(field: dict | None, option_value) -> dict | None:
    for ch in (field or {}).get("choices", []) or []:
        if isinstance(ch, dict) and str(ch.get("value")) == str(option_value):
            return ch
        if not isinstance(ch, dict) and str(ch) == str(option_value):
            return {"value": ch, "text": str(ch)}
    return None


# -------------------------------------------------------- 4. validate_field --

_VOWELS = set("аеёиоуыэюяaeiouy")
_RUN = re.compile(r"(.)\1{3,}")  # один символ ≥4 раз подряд: «ааааа», «!!!!»
_LONG_HINTS = ("описан", "обоснован", "коммент", "цель проект", "информац", "примечан")
_ALPHA_TOKEN = re.compile(r"[^\W\d_]{2,}", re.UNICODE)


def _is_long_text(field_name: str, ctx: dict) -> bool:
    if (ctx.get("type") or "") == "comment":
        return True
    hay = f"{ctx.get('title', '')} {field_name}".lower()
    return any(h in hay for h in _LONG_HINTS)


def heuristic_check(field_name: str, value: str, ctx: dict) -> dict:
    """Офлайн-ядро: regex/эвристики без сети. suggestion всегда None —
    предлагать правку без AI не беремся (spec: fallback без AI-текста)."""
    s = (value or "").strip()
    title = ctx.get("title") or field_name

    if not s:  # пустое обрабатывает обычная required-валидация формы
        return _ok()

    # 1) осмысленный минимум для описаний/обоснований
    min_len = 20 if _is_long_text(field_name, ctx) else 3
    if len(s) < min_len:
        return _warn(
            f"«{title}»: слишком короткое значение — опишите подробнее."
            if min_len >= 20
            else f"«{title}»: значение выглядит слишком коротким."
        )

    letters = [c for c in s.lower() if c.isalpha()]
    compact = re.sub(r"\s+", "", s)

    # 2) один символ, повторённый подряд, или почти нет разных символов
    if _RUN.search(s) or (len(compact) >= 4 and len(set(compact.lower())) <= 2):
        return _warn(f"«{title}»: похоже на случайный ввод, а не на текст.")

    # 3) в строке есть длинное «слово» вообще без гласных → набор символов
    for tok in _ALPHA_TOKEN.findall(s):
        low = tok.lower()
        if len(low) >= 5 and not (_VOWELS & set(low)):
            return _warn(f"«{title}»: похоже на случайный набор символов.")

    # 3b) ≥5 согласных подряд — типичный «клавиатурный» мусор («фывапролдж»)
    run = 0
    for c in s.lower():
        if c.isalpha() and c not in _VOWELS:
            run += 1
            if run >= 5:
                return _warn(f"«{title}»: похоже на случайный набор символов.")
        else:
            run = 0

    # 4) слишком много не-буквенных символов для текстового поля
    if letters:
        junk = sum(1 for c in s if not c.isalnum() and not c.isspace() and c not in ".,-—«»№/()\"'")
        if junk / max(len(s), 1) > 0.4:
            return _warn(f"«{title}»: слишком много посторонних символов.")

    return _ok()


def _ok() -> dict:
    return {"ok": True, "severity": "ok", "message": None, "suggestion": None}


def _warn(message: str, suggestion: str | None = None) -> dict:
    return {"ok": False, "severity": "warn", "message": message, "suggestion": suggestion}


_VALIDATE_SYSTEM = """Ты — ассистент проверки ввода в форме заявки на портале поддержки бизнеса.
Проверь, похоже ли значение на осмысленный ввод для поля «{title}» (услуга: {service}).
Ищи только явные проблемы: случайный набор символов, бессмысленный текст,
очевидную опечатку/раскладку, слишком короткое значение для поля-описания.
Не придирайся: имена, аббревиатуры, короткие корректные значения — это норма.
Верни строго JSON: {{"ok": true|false, "message": "мягкая подсказка на русском или null",
"suggestion": "исправленное значение или null"}}.
ok=false только при явной проблеме; suggestion указывай только если уверенно
исправляешь опечатку/раскладку, иначе null. Только JSON, без пояснений."""


def validate_field(field_name: str, value: str, service_context: dict) -> dict:
    """AI-проверка текстового значения с откатом к эвристикам."""
    ctx = service_context or {}
    fallback = heuristic_check(field_name, value, ctx)

    s = (value or "").strip()
    client = get_client()
    if not client or not s:
        return {**fallback, "source": "rules"}

    try:
        resp = client.messages.create(
            model=settings.ai_model,
            max_tokens=300,
            system=_VALIDATE_SYSTEM.format(
                title=ctx.get("title") or field_name,
                service=ctx.get("serviceTitle") or "—",
            ),
            messages=[{"role": "user", "content": s}],
        )
        data = extract_json(message_text(resp))
        if isinstance(data, dict) and "ok" in data:
            if data.get("ok"):
                return {**_ok(), "source": "ai"}
            message = (data.get("message") or "").strip() or fallback["message"] or (
                f"«{ctx.get('title') or field_name}»: проверьте значение."
            )
            suggestion = data.get("suggestion")
            suggestion = suggestion.strip() if isinstance(suggestion, str) and suggestion.strip() else None
            # не предлагаем «исправление», совпадающее с исходным значением
            if suggestion and suggestion == s:
                suggestion = None
            return {**_warn(message, suggestion), "source": "ai"}
    except Exception:
        pass  # сеть/таймаут/парсинг → офлайн-ядро

    return {**fallback, "source": "rules"}


# ------------------------------------------------------------ 3. field_help --

_EXPLAIN_SYSTEM = """Ты — помощник предпринимателя на портале поддержки бизнеса.
Объясни простыми словами (1–2 коротких предложения, без юридических терминов),
что нужно указать в поле «{title}» услуги «{service}».
Верни строго JSON: {{"hint": "объяснение на русском"}}. Только JSON."""

_OPTION_SYSTEM = """Ты — помощник предпринимателя на портале поддержки бизнеса.
Пользователь выбрал вариант «{option}» в поле «{title}» услуги «{service}».
Контекст услуги: {desc}
Дай короткую (1 предложение) проактивную подсказку о том, что повлечёт этот выбор
(доп. документ, условие или срок), если это уместно. Не выдумывай требований,
которых нет в контексте. Если добавить нечего — hint=null.
Верни строго JSON: {{"hint": "подсказка на русском или null"}}. Только JSON."""


def _hint(hint: str | None, source: str) -> dict:
    hint = hint.strip() if isinstance(hint, str) and hint.strip() else None
    return {"hint": hint, "source": source}


def field_help(
    db: Session,
    service_id: str,
    field_name: str,
    option_value=None,
    option_text: str | None = None,
) -> dict:
    """Подсказка по полю. option_value задан → проактивная реакция на выбор опции;
    иначе — объяснение поля («?»)."""
    service = db.get(Service, service_id)
    schema = _active_schema(db, service_id)
    field = _find_field(schema, field_name)
    title = (field or {}).get("title") or field_name
    service_title = service.title if service else "—"

    is_option = option_value is not None and option_value != ""
    choice = _find_choice(field, option_value) if is_option else None
    if choice and not option_text:
        option_text = choice.get("text") or str(choice.get("value"))

    # детерминированный фолбэк — берём из схемы, не выдумываем
    if is_option:
        fallback = (choice or {}).get("description")
    else:
        fallback = (field or {}).get("description")

    client = get_client()
    if not client:
        return _hint(fallback, "rules")

    try:
        if is_option:
            system = _OPTION_SYSTEM.format(
                option=option_text or option_value,
                title=title,
                service=service_title,
                desc=(service.description if service and service.description else service_title),
            )
            user = "Дай подсказку по выбранному варианту."
        else:
            system = _EXPLAIN_SYSTEM.format(title=title, service=service_title)
            user = "Объясни это поле."
        resp = client.messages.create(
            model=settings.ai_model,
            max_tokens=200,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        data = extract_json(message_text(resp))
        if isinstance(data, dict):
            return _hint(data.get("hint") or fallback, "ai")
    except Exception:
        pass

    return _hint(fallback, "rules")
