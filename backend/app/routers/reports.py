"""Каталог аналитической отчётности дочерних организаций (spec 6.7, Фаза 4.1).

Читает материалы из таблицы Report (раньше — reports_data.py), поэтому каталог
редактируется в админке без кода. Декорации организаций/типов берём из
справочных констант reports_data, фильтры по org/type сохранены.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Report
from ..reports_data import ORG_META, TYPE_LABELS

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def decorate_report(r: Report) -> dict:
    meta = ORG_META.get(r.orgId)
    full, short, color, logo = meta if meta else (r.orgId, r.orgId, "#121517", "")
    return {
        "id": r.id,
        "org": r.orgId,
        "type": r.type,
        "title": r.title,
        "description": r.description,
        "source": r.source,
        "period": r.period,
        "updated": r.updated,
        "url": r.url,
        "embedUrl": r.embedUrl,
        "orgName": full,
        "orgShort": short,
        "orgColor": color,
        "orgLogo": logo,
        "typeLabel": TYPE_LABELS.get(r.type, r.type),
    }


@router.get("")
def list_reports(
    org: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_session),
):
    rows = db.exec(select(Report).where(Report.status == "published")).all()
    rows = sorted(rows, key=lambda r: (r.sortOrder, r.title))
    selected_orgs = {p for p in (org or "").split(",") if p}
    selected_types = {p for p in (type or "").split(",") if p}
    items = [
        decorate_report(r)
        for r in rows
        if (not selected_orgs or r.orgId in selected_orgs)
        and (not selected_types or r.type in selected_types)
    ]
    return {
        "items": items,
        "orgs": [
            {"id": key, "shortName": meta[1], "name": meta[0], "logo": meta[3], "color": meta[2]}
            for key, meta in ORG_META.items()
        ],
        "types": [{"id": key, "label": label} for key, label in TYPE_LABELS.items()],
        "total": len(rows),
    }
