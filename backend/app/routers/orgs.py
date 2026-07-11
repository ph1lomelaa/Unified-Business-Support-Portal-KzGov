from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import Organization, Service

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


@router.get("")
def list_organizations(db: Session = Depends(get_session)):
    rows = db.exec(select(Organization).order_by(Organization.name)).all()
    counts = dict(
        db.exec(
            select(Service.orgId, func.count())
            .where(Service.status == "published")
            .group_by(Service.orgId)
        ).all()
    )
    return [
        {
            "id": o.id,
            "name": o.name,
            "shortName": o.shortName,
            "color": o.color,
            "logo": o.logo or None,
            "serviceCount": counts.get(o.id, 0),
        }
        for o in rows
    ]
