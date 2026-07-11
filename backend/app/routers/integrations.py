"""eGov / ГБД ЮЛ company lookup — now routed through the integration bus.

The wizard's "Найти компанию" calls this endpoint, which delegates to
`bus.call("gbd-ul", "company.prefill", ...)`. The system + its mock dataset are
admin-editable, so changing the wiring in the admin console changes what the
wizard autofills — no code change (Фаза 1).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..db import get_session
from ..integration import bus

router = APIRouter(prefix="/api/v1/integrations/egov", tags=["integrations"])

DEMO_BIN = "123456789012"


def _prefill(bin: str, db: Session) -> dict:
    # No idempotency key: the resolver reads the live registry, so admins can
    # tweak the mock and immediately see the new prefill.
    env = bus.call(db, "gbd-ul", "company.prefill", {"bin": bin.strip()})
    if not env["ok"]:
        raise HTTPException(
            status_code=404,
            detail=env.get("error") or f"Компания не найдена. Попробуйте демо-БИН: {DEMO_BIN}",
        )
    return env["data"]


@router.get("/company/{bin}")
def get_company_get(bin: str, db: Session = Depends(get_session)):
    return _prefill(bin, db)


@router.post("/company/{bin}")
def get_company_post(bin: str, db: Session = Depends(get_session)):
    # Spec uses POST for the wizard "Найти компанию" call.
    return _prefill(bin, db)
