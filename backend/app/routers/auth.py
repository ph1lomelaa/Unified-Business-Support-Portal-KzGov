"""Auth: NCALayer EDS sign-in + demo role login (M5).

The browser signs a server nonce via NCALayer and posts the CMS here; we parse
the signer certificate's subject for ИИН/БИН/ФИО (real integration, not a
mock). Full CMS chain verification against the НУЦ root is a roadmap item —
offline we trust the embedded certificate for the demo. The frontend route
handler turns the returned identity into an httpOnly session cookie.
"""

from __future__ import annotations

import base64
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..auth.eds import parse_cms_subject
from ..db import get_session
from ..models import Company

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_USERS: dict[str, dict] = {
    "entrepreneur": {
        "id": "ent-agrodala", "name": "Асхат Нурланов",
        "role": "entrepreneur", "bin": "123456789012", "orgId": None,
    },
    "analyst": {
        "id": "analyst-damu", "name": "Аналитик Фонда «Даму»",
        "role": "analyst", "bin": None, "orgId": "damu",
    },
    "admin": {
        "id": "admin-portal", "name": "Администратор портала",
        "role": "admin", "bin": None, "orgId": None,
    },
}


class EdsBody(BaseModel):
    cms: str
    nonce: str | None = None


class DemoBody(BaseModel):
    role: str


@router.get("/nonce")
def nonce():
    return {"nonce": base64.b64encode(secrets.token_bytes(24)).decode("ascii")}


@router.post("/eds")
def eds_login(body: EdsBody, db: Session = Depends(get_session)):
    try:
        ident = parse_cms_subject(body.cms)
    except Exception as e:
        raise HTTPException(400, f"Не удалось разобрать подпись ЭЦП: {e}")

    bin_ = ident.bin or ident.iin
    company = db.get(Company, bin_) if bin_ else None
    user = {
        "id": f"eds-{bin_ or 'unknown'}",
        "name": ident.fio,
        "role": "entrepreneur",
        "bin": bin_,
        "orgId": None,
        "company": company.name if company else ident.org,
    }
    return {"user": user}


@router.post("/demo")
def demo_login(body: DemoBody):
    user = DEMO_USERS.get(body.role)
    if not user:
        raise HTTPException(400, "Неизвестная роль")
    return {"user": user}
