"""Anthropic client wrapper + JSON extraction helpers.

The client is created lazily from ANTHROPIC_API_KEY. When the key is empty,
callers fall back to deterministic logic (keyword search / honest error),
so the whole product works offline for the demo (spec Часть 14 risk plan).
"""

from __future__ import annotations

import json
import re
import time

from ..config import settings

# 6s timeout per spec (Часть 8): on timeout -> fallback.
_AI_TIMEOUT = 6.0


def redact_personal_data(text: str) -> str:
    """Minimise personal data before any prompt leaves the portal boundary."""
    value = str(text or "")
    value = re.sub(r"(?<!\d)\d{12}(?!\d)", "************", value)
    value = re.sub(
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        "***@***",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"(?<!\d)(?:\+?7|8)[\s()\-]*\d(?:[\s()\-]*\d){9}(?!\d)", "***********", value)
    return value


class _RedactingClient:
    def __init__(self, client):
        self._client = client
        self.messages = self

    def create(self, *, system=None, messages=None, **kwargs):
        safe_messages = [
            {
                **message,
                "content": redact_personal_data(message.get("content", "")),
            }
            for message in (messages or [])
        ]
        return self._client.messages.create(
            system=redact_personal_data(system) if system else system,
            messages=safe_messages,
            **kwargs,
        )


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

    def __init__(self, api_key: str, model: str, timeout: float = _AI_TIMEOUT):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key, timeout=timeout)
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


def _make_anthropic(timeout: float):
    try:
        import anthropic

        return anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=timeout)
    except Exception:
        return None


def _make_openai(timeout: float):
    try:
        return _OpenAIAdapter(settings.openai_api_key, settings.openai_model, timeout=timeout)
    except Exception:
        return None


def get_client(timeout: float = _AI_TIMEOUT):
    """Клиент выбранного провайдера. `AI_PROVIDER`: "openai" | "anthropic" |
    "auto" (по умолчанию — Claude, затем OpenAI). `timeout` задаётся вызовом:
    чат-эндпоинт использует больший таймаут, навигатор — короткий."""
    provider = (settings.ai_provider or "auto").strip().lower()
    if provider == "openai":
        client = _make_openai(timeout) if settings.openai_api_key else None
        return _RedactingClient(client) if client else None
    if provider == "anthropic":
        client = _make_anthropic(timeout) if settings.anthropic_api_key else None
        return _RedactingClient(client) if client else None
    # auto — приоритет у Claude, иначе OpenAI
    if settings.anthropic_api_key:
        client = _make_anthropic(timeout)
        return _RedactingClient(client) if client else None
    if settings.openai_api_key:
        client = _make_openai(timeout)
        return _RedactingClient(client) if client else None
    return None


def ai_enabled() -> bool:
    return bool(settings.anthropic_api_key or settings.openai_api_key)


def ai_provider() -> tuple[str | None, str | None]:
    provider = (settings.ai_provider or "auto").strip().lower()
    if provider == "openai":
        return ("openai", settings.openai_model) if settings.openai_api_key else (None, None)
    if provider == "anthropic":
        return ("anthropic", settings.ai_model) if settings.anthropic_api_key else (None, None)
    if settings.anthropic_api_key:
        return "anthropic", settings.ai_model
    if settings.openai_api_key:
        return "openai", settings.openai_model
    return None, None


_STATUS_CACHE: dict[str, object] = {"expires": 0.0, "payload": None}


def ai_status(force: bool = False) -> dict:
    """Return honest stand status: configured key is not enough, we probe once
    and cache the result briefly so every page load does not call the model."""
    now = time.time()
    cached = _STATUS_CACHE.get("payload")
    if cached and not force and float(_STATUS_CACHE.get("expires") or 0) > now:
        return cached  # type: ignore[return-value]

    provider, model = ai_provider()
    payload = {
        "aiEnabled": False,
        "live": False,
        "provider": provider,
        "model": model,
        "mode": "unavailable" if not provider else "checking",
        "checkedAt": int(now),
        "error": None,
    }
    client = get_client()
    if not client:
        payload["mode"] = "unavailable"
    else:
        try:
            client.messages.create(
                model=settings.ai_model,
                max_tokens=8,
                system="Ответь одним словом: ok",
                messages=[{"role": "user", "content": "ping"}],
            )
            payload.update({"aiEnabled": True, "live": True, "mode": "live"})
        except Exception as exc:  # noqa: BLE001
            payload.update({"mode": "fallback", "error": str(exc)[:180]})

    _STATUS_CACHE.update({"expires": now + 60, "payload": payload})
    return payload


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
