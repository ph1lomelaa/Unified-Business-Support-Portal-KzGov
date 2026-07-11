"""AI-проверка полноты и корректности заявки перед отправкой (spec 6.6, крит. 9.4).

Ядро проверки — ДЕТЕРМИНИРОВАННОЕ (обязательные поля, диапазоны, форматы,
доменное правило 70%): для проверки полноты это надёжнее LLM и работает офлайн.
Claude (если сконфигурирован ключ) добавляет дружелюбное резюме и мягкие советы;
при любой ошибке/таймауте откатываемся к детерминированному резюме — форма
ответа одинакова, фронт не различает источник.
"""

from __future__ import annotations

import json
import re

from ..calc import cattle_rule_ok
from ..config import settings
from .client import extract_json, get_client, message_text

_SKIP_TYPES = {"html", "expression", "image"}

SYSTEM_PROMPT = """Ты — помощник предпринимателя на портале поддержки бизнеса «Байтерек».
Пользователь заполнил заявку. Дай короткое дружелюбное резюме и до 3 практических
советов простым языком (без юридических терминов). Верни строго JSON:
{{"summary":"1-2 предложения","advice":["совет","совет"]}}
Данные заявки (поле: значение): {answers}
Уже найденные системой проблемы: {issues}
Не выдумывай новых требований, опирайся только на данные. Отвечай на русском.
Только JSON."""


def _walk_elements(elements: list | None):
    for el in elements or []:
        if el.get("type") == "panel":
            yield from _walk_elements(el.get("elements"))
        else:
            yield el


def _fields(schema: dict):
    for page in (schema or {}).get("pages", []) or []:
        yield from _walk_elements(page.get("elements"))


def _empty(v) -> bool:
    return v is None or v == "" or (isinstance(v, list) and not v)


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _issue(field, title, severity, message, suggestion=""):
    return {
        "field": field,
        "title": title,
        "severity": severity,
        "message": message,
        "suggestion": suggestion,
    }


def deterministic_issues(schema: dict, answers: dict) -> list[dict]:
    """Ошибки заполнения: обязательные, диапазоны, форматы, правило 70%."""
    issues: list[dict] = []
    answers = answers or {}
    for el in _fields(schema):
        name = el.get("name")
        if not name or el.get("type") in _SKIP_TYPES:
            continue
        title = el.get("title") or name
        val = answers.get(name)

        if el.get("isRequired") and _empty(val):
            issues.append(_issue(
                name, title, "error",
                f"Обязательное поле «{title}» не заполнено.",
                "Заполните это поле, чтобы подать заявку.",
            ))
            continue
        if _empty(val):
            continue

        if _is_number(val):
            mn, mx = el.get("min"), el.get("max")
            if _is_number(mn) and val < mn:
                issues.append(_issue(
                    name, title, "error",
                    f"«{title}»: значение ниже минимально допустимого.",
                    f"Укажите не менее {mn:,}".replace(",", " "),
                ))
            elif _is_number(mx) and val > mx:
                issues.append(_issue(
                    name, title, "error",
                    f"«{title}»: значение выше максимально допустимого.",
                    f"Укажите не более {mx:,}".replace(",", " "),
                ))

        if isinstance(val, str):
            for vld in el.get("validators") or []:
                if vld.get("type") == "regex" and vld.get("regex"):
                    if not re.search(vld["regex"], val):
                        issues.append(_issue(
                            name, title, "warn",
                            f"«{title}»: {vld.get('text') or 'проверьте формат'}.",
                        ))

    # доменное правило 70% (животноводство): не менее 70% займа — на скот
    loan = answers.get("loan_amount")
    cattle = answers.get("cattle_amount")
    if _is_number(loan) and _is_number(cattle) and not cattle_rule_ok(cattle, loan):
        need = round(loan * 0.7)
        issues.append(_issue(
            "cattle_amount", "Сумма на приобретение скота", "error",
            "На приобретение скота направляется менее 70% суммы займа.",
            f"Увеличьте сумму на скот до {need:,} ₸".replace(",", " "),
        ))
    return issues


def _completeness(schema: dict, answers: dict) -> tuple[int, int]:
    total = filled = 0
    answers = answers or {}
    for el in _fields(schema):
        name = el.get("name")
        if not name or el.get("type") in _SKIP_TYPES:
            continue
        total += 1
        if not _empty(answers.get(name)):
            filled += 1
    return total, filled


def _default_summary(issues: list[dict]) -> str:
    errors = [i for i in issues if i["severity"] == "error"]
    warns = [i for i in issues if i["severity"] == "warn"]
    if not issues:
        return "Заявка заполнена корректно — можно подписывать и отправлять."
    parts = []
    if errors:
        parts.append(f"{len(errors)} ошибок(и) нужно исправить")
    if warns:
        parts.append(f"{len(warns)} предупреждение(й)")
    return "Перед отправкой: " + ", ".join(parts) + "."


def _ai_layer(answers: dict, issues: list[dict]) -> dict | None:
    client = get_client()
    if not client:
        return None
    try:
        resp = client.messages.create(
            model=settings.ai_model,
            max_tokens=400,
            system=SYSTEM_PROMPT.format(
                answers=json.dumps(answers, ensure_ascii=False),
                issues=json.dumps(issues, ensure_ascii=False),
            ),
            messages=[{"role": "user", "content": "Проверь заявку."}],
        )
        data = extract_json(message_text(resp))
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


def check_application(schema: dict, answers: dict) -> dict:
    issues = deterministic_issues(schema, answers)
    total, filled = _completeness(schema, answers)
    ok = not any(i["severity"] == "error" for i in issues)

    ai = _ai_layer(answers or {}, issues)
    if ai:
        summary = ai.get("summary") or _default_summary(issues)
        advice = [a for a in (ai.get("advice") or []) if isinstance(a, str)][:3]
        source = "ai"
    else:
        summary = _default_summary(issues)
        advice = []
        source = "rules"

    return {
        "ok": ok,
        "summary": summary,
        "issues": issues,
        "advice": advice,
        "filled": filled,
        "total": total,
        "source": source,
    }
