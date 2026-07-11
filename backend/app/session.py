"""Signed session cookie helpers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from .config import settings
from .db import get_session


@dataclass
class SessionUser:
    id: str
    name: str
    role: str  # entrepreneur|analyst|admin
    bin: str | None = None
    orgId: str | None = None


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(payload: str) -> str:
    digest = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return _b64url_encode(digest)


def encode_session(user: SessionUser) -> str:
    payload = {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "bin": user.bin,
        "orgId": user.orgId,
    }
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    body = _b64url_encode(raw)
    return f"{body}.{_sign(body)}"


def decode_session(raw: str) -> SessionUser | None:
    try:
        body, sig = raw.split(".", 1)
        expected = _sign(body)
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_b64url_decode(body).decode("utf-8"))
        if not data.get("name") or not data.get("role"):
            return None
        return SessionUser(
            id=data.get("id", ""),
            name=data["name"],
            role=data["role"],
            bin=data.get("bin"),
            orgId=data.get("orgId"),
        )
    except Exception:
        return None


def current_user(request: Request) -> SessionUser | None:
    raw = request.cookies.get(settings.session_cookie)
    if not raw:
        return None
    return decode_session(raw)


def require_user(request: Request) -> SessionUser:
    user = current_user(request)
    if not user:
        raise HTTPException(401, "Требуется вход")
    return user


def require_role(*roles: str) -> Callable[[Request], SessionUser]:
    allowed = set(roles)

    def dependency(request: Request) -> SessionUser:
        user = require_user(request)
        if user.role not in allowed:
            raise HTTPException(403, "Недостаточно прав")
        return user

    return dependency


def require_owner_or_admin(
    app_id: str,
    request: Request,
    db: Session = Depends(get_session),
) -> SessionUser:
    """Allow the application owner, an admin, or an analyst of the service org."""
    from .models import Application, Service

    user = require_user(request)
    if user.role == "admin":
        return user

    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")

    if user.role == "entrepreneur" and user.bin and app.companyBin == user.bin:
        return user

    if user.role == "analyst" and user.orgId:
        service = db.get(Service, app.serviceId)
        if service and service.orgId == user.orgId:
            return user

    raise HTTPException(403, "Недостаточно прав")
