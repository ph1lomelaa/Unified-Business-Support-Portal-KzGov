from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlmodel import Session

from ..db import get_session
from ..models import Company, CompanyProfile
from ..session import current_user

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


class ProfileBody(BaseModel):
    email: str
    phone: str
    notifyEmail: bool = True

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("Некорректный email")
        return value


def _require_bin(request: Request) -> str:
    user = current_user(request)
    if not user or not user.bin:
        raise HTTPException(401, "Требуется вход предпринимателя")
    return user.bin


def _response(company: Company, profile: CompanyProfile | None) -> dict:
    return {
        "company": {
            "bin": company.bin,
            "name": company.name,
            "form": company.form,
            "oked": company.oked,
            "okedName": company.okedName,
            "address": company.address,
            "region": company.region,
            "director": company.director,
            "category": company.category,
            "source": "ГБД ЮЛ (имитация)",
        },
        "contacts": {
            "email": profile.email if profile else "info@agrodala.kz",
            "phone": profile.phone if profile else "+7 700 123 45 67",
            "notifyEmail": profile.notifyEmail if profile else True,
            "updatedAt": profile.updatedAt if profile else None,
        },
    }


@router.get("")
def get_profile(request: Request, db: Session = Depends(get_session)):
    bin = _require_bin(request)
    company = db.get(Company, bin)
    if not company:
        raise HTTPException(404, "Компания не найдена")
    profile = db.get(CompanyProfile, bin)
    return _response(company, profile)


@router.patch("")
def update_profile(body: ProfileBody, request: Request, db: Session = Depends(get_session)):
    bin = _require_bin(request)
    company = db.get(Company, bin)
    if not company:
        raise HTTPException(404, "Компания не найдена")

    profile = db.get(CompanyProfile, bin)
    if not profile:
        profile = CompanyProfile(companyBin=bin)
    profile.email = str(body.email)
    profile.phone = body.phone.strip()
    profile.notifyEmail = body.notifyEmail
    profile.updatedAt = datetime.now(timezone.utc)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _response(company, profile)
