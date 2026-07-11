"""Anthropic client wrapper + JSON extraction helpers.

The client is created lazily from ANTHROPIC_API_KEY. When the key is empty,
callers fall back to deterministic logic (keyword search / honest error),
so the whole product works offline for the demo (spec Часть 14 risk plan).
"""

from __future__ import annotations

import json
import re

from ..config import settings

# 6s timeout per spec (Часть 8): on timeout -> fallback.
_AI_TIMEOUT = 6.0


class _OpenAIBlock:
    """Мимикрия под блок ответа Anthropic (type/text), чтобы message_text работал."""

    type = "text"

    def __init__(self, text: str):
        self.text = text


class _OpenAIResponse:
    def __init__(self, text: str):
        self.content = [_OpenAIBlock(text)]


class _OpenAIAdapter:
    """Адаптер OpenAI под интерфейс Anthropic: client.messages.create(...).

    Весь ai/* написан под Messages API Anthropic (system=..., messages=[...],
    resp.content[].text). Адаптер переводит вызов в OpenAI Chat Completions и
    возвращает ответ той же формы — остальной код не меняется. Модель берём из
    настроек OpenAI (переданный claude-id игнорируем)."""

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key, timeout=_AI_TIMEOUT)
        self._model = model
        self.messages = self  # чтобы client.messages.create(...) звал наш create

    def create(self, *, system=None, messages=None, max_tokens=1024, **_ignored):
        oai_messages = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        for m in messages or []:
            oai_messages.append({"role": m["role"], "content": m["content"]})
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=oai_messages,
            max_tokens=max_tokens,
        )
        return _OpenAIResponse(resp.choices[0].message.content or "")


def get_client():
    # Приоритет у Claude; OpenAI — если задан только его ключ.
    if settings.anthropic_api_key:
        try:
            import anthropic

            return anthropic.Anthropic(
                api_key=settings.anthropic_api_key, timeout=_AI_TIMEOUT
            )
        except Exception:
            return None
    if settings.openai_api_key:
        try:
            return _OpenAIAdapter(settings.openai_api_key, settings.openai_model)
        except Exception:
            return None
    return None


def ai_enabled() -> bool:
    return bool(settings.anthropic_api_key or settings.openai_api_key)


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def extract_json(text: str) -> dict | list:
    """Parse a JSON object/array out of a model response, tolerating ```json fences."""
    cleaned = _FENCE.sub("", text).strip()
    # If there is leading/trailing prose, grab the outermost {...} or [...].
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = min(
            [i for i in (cleaned.find("{"), cleaned.find("[")) if i >= 0],
            default=-1,
        )
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def message_text(resp) -> str:
    return "".join(
        block.text for block in resp.content if getattr(block, "type", "") == "text"
    )
