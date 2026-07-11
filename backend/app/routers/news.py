from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import NewsItem, Organization

router = APIRouter(prefix="/api/v1/news", tags=["news"])


@router.get("")
def list_news(db: Session = Depends(get_session)):
    rows = db.exec(
        select(NewsItem, Organization)
        .join(Organization, NewsItem.sourceOrgId == Organization.id, isouter=True)
        .where(NewsItem.status == "published")
        .order_by(NewsItem.publishedAt.desc())
        .limit(8)
    ).all()
    last_imported = db.exec(select(func.max(NewsItem.importedAt))).one()
    return {
        "items": [_news_to_public(item, org) for item, org in rows],
        "lastImportedAt": last_imported,
    }


def _news_to_public(item: NewsItem, org: Organization | None) -> dict:
    return {
        "id": item.id,
        "sourceOrgId": item.sourceOrgId,
        "sourceOrg": {
            "id": org.id,
            "shortName": org.shortName,
            "name": org.name,
            "color": org.color,
            "logo": org.logo or None,
        }
        if org
        else None,
        "title": item.title,
        "summary": item.summary,
        "publishedAt": item.publishedAt,
        "sourceUrl": item.sourceUrl,
        "imageUrl": item.imageUrl,
        "importedAt": item.importedAt,
    }
