"""AI service generator (REQ-22, spec Часть 17.2): program text -> service draft.

Output is validated; on a structural error we make exactly one repair attempt
with the error text, then fail honestly (no fictional stub — spec is explicit).
The result opens as a DRAFT in the visual constructor for a human to finish and
publish.
"""

from __future__ import annotations

import json

from ..config import settings
from .client import extract_json, get_client, message_text

SYSTEM_PROMPT = """Ты — генератор описания услуги для конструктора портала поддержки бизнеса.
Из текста программы господдержки извлеки и верни СТРОГО один JSON:
{"card":{"title","summary","category","conditions":[{"label","value"}],"documents":[{"name","auto"}]},
"form":{"pages":[{"title","elements":[...]}]},
"extracted_rules":[{"rule","source_quote"}]}
"form" — в формате SurveyJS (типы полей: text, number, dropdown, radiogroup, checkbox, boolean, file, expression, html).
category — одно из: credit, subsidy, guarantee, leasing, insurance, investment.
Правила: не выдумывай числа и условия, которых нет в тексте — пропускай поле;
поля группируй по 3–6 на страницу по темам; первую страницу назови «О компании» с полем bin (БСН);
для условий вида «не менее X%» создавай expression-валидатор; имена полей — snake_case латиницей;
extracted_rules — краткие правила со ссылкой на цитату из текста. Ответ только JSON."""

APPLICATION_EXAMPLE_PROMPT = """Ты проверяешь черновик формы меры поддержки.
По схеме SurveyJS верни СТРОГО один JSON:
{"summary":"краткое описание примера","answers":[{"name":"имя поля","label":"человекочитаемая подпись","value":"правдоподобное тестовое значение"}]}
Заполняй только поля с непустым name. Значения должны быть тестовыми и
правдоподобными для казахстанского малого бизнеса, но не использовать данные
реальных людей. Для file укажи «Пример документа.pdf», для boolean — «Да» или
«Нет». Ничего не выдумывай о ставках и условиях программы. Ответ только JSON."""


class AiError(Exception):
    pass


VALID_CATEGORIES = {"credit", "subsidy", "guarantee", "leasing", "insurance", "investment"}


def _validate(data) -> dict:
    if not isinstance(data, dict):
        raise ValueError("корень должен быть объектом")
    card = data.get("card")
    if not isinstance(card, dict) or not card.get("title"):
        raise ValueError("card.title обязателен")
    form = data.get("form")
    if not isinstance(form, dict) or not isinstance(form.get("pages"), list) or not form["pages"]:
        raise ValueError("form.pages должен быть непустым массивом")
    for i, page in enumerate(form["pages"]):
        if not isinstance(page, dict) or not isinstance(page.get("elements"), list):
            raise ValueError(f"form.pages[{i}].elements должен быть массивом")
    # normalize
    cat = card.get("category")
    if cat not in VALID_CATEGORIES:
        card["category"] = "subsidy"
    card.setdefault("summary", "")
    card.setdefault("conditions", [])
    card.setdefault("documents", [])
    data.setdefault("extracted_rules", [])
    return data


def generate_service(text: str) -> dict:
    client = get_client()
    if not client:
        raise AiError(
            "AI-генерация недоступна: не задан ANTHROPIC_API_KEY. "
            "Создайте услугу вручную кнопкой «Новая услуга»."
        )
    if not text.strip():
        raise AiError("Вставьте текст программы для анализа.")

    messages = [{"role": "user", "content": text}]
    last_err = ""
    for attempt in range(2):  # initial + 1 repair
        try:
            resp = client.messages.create(
                model=settings.ai_model,
                max_tokens=4000,
                system=SYSTEM_PROMPT,
                messages=messages,
            )
            raw = message_text(resp)
            data = extract_json(raw)
            return _validate(data)
        except (ValueError, json.JSONDecodeError) as e:
            last_err = str(e)
            # repair: hand the model its own output + the error
            messages = [
                {"role": "user", "content": text},
                {"role": "assistant", "content": raw if "raw" in dir() else ""},
                {
                    "role": "user",
                    "content": f"Твой ответ не прошёл проверку: {last_err}. Верни исправленный СТРОГО JSON.",
                },
            ]
        except Exception as e:  # network/timeout/etc.
            raise AiError(
                "Не удалось обратиться к AI. Попробуйте позже или создайте услугу вручную."
            ) from e

    raise AiError(
        "Не удалось разобрать текст. Создайте форму вручную в конструкторе."
    )


def generate_application_example(form: dict) -> dict:
    """Generate a review-only filled application for an imported form."""
    pages = form.get("pages") if isinstance(form, dict) else None
    if not isinstance(pages, list) or not pages:
        raise AiError("Невозможно создать пример: схема формы пуста.")
    client = get_client()
    if not client:
        raise AiError("AI-генерация недоступна: не задан ANTHROPIC_API_KEY.")
    try:
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=1800,
            system=APPLICATION_EXAMPLE_PROMPT,
            messages=[{"role": "user", "content": json.dumps(form, ensure_ascii=False)}],
        )
        data = extract_json(message_text(response))
    except Exception as exc:
        raise AiError("Не удалось сгенерировать пример заявки.") from exc
    if not isinstance(data, dict) or not isinstance(data.get("answers"), list):
        raise AiError("AI вернул некорректный пример заявки.")
    answers = [
        answer
        for answer in data["answers"]
        if isinstance(answer, dict) and answer.get("name") and answer.get("value") is not None
    ]
    return {"summary": str(data.get("summary") or "Пример заполнения для проверки формы"), "answers": answers}
