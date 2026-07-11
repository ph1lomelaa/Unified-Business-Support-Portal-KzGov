from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from ..calc import subsidy_calc
from ..db import get_session
from ..models import FaqEntry, KnowledgeItem
from ..pdf.generator import render_knowledge_template_pdf

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


def _card(item: KnowledgeItem) -> dict:
    return {
        "id": item.id,
        "slug": item.slug,
        "type": item.type,
        "title": item.title,
        "summary": item.summary,
        "readMinutes": item.readMinutes,
        "relatedServiceSlugs": item.relatedServiceSlugs,
        "downloadRef": item.downloadRef,
    }


@router.get("")
def list_knowledge(
    db: Session = Depends(get_session),
    type: str | None = Query(None),
    q: str | None = Query(None),
    relatedTo: str | None = Query(None),
):
    rows = db.exec(select(KnowledgeItem)).all()
    if type:
        rows = [r for r in rows if r.type == type]
    if relatedTo:
        rows = [r for r in rows if relatedTo in (r.relatedServiceSlugs or [])]
    if q:
        needle = q.lower()
        rows = [r for r in rows if needle in r.title.lower() or needle in r.summary.lower()]
    rows.sort(key=lambda r: r.title)
    return {"items": [_card(r) for r in rows]}


@router.get("/faq")
def list_faq(db: Session = Depends(get_session)):
    rows = db.exec(select(FaqEntry).order_by(FaqEntry.order)).all()
    return {"items": [{"question": r.question, "answer": r.answer} for r in rows]}


@router.get("/{slug}")
def get_knowledge(slug: str, db: Session = Depends(get_session)):
    item = db.exec(select(KnowledgeItem).where(KnowledgeItem.slug == slug)).first()
    if not item:
        raise HTTPException(404, "Материал не найден")
    return {**_card(item), "body": item.body, "updatedAt": item.updatedAt}


@router.get("/{slug}/download")
def download_knowledge(slug: str, db: Session = Depends(get_session)):
    item = db.exec(select(KnowledgeItem).where(KnowledgeItem.slug == slug)).first()
    if not item or not item.downloadRef:
        raise HTTPException(404, "Файл недоступен для этого материала")
    pdf = render_knowledge_template_pdf(title=item.title, body=item.body)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{item.downloadRef}.pdf"'},
    )


class CalcBody(BaseModel):
    amount: float
    bankRate: float
    programRate: float
    months: int


@router.post("/subsidy-calc")
def calculate(body: CalcBody):
    return subsidy_calc(body.amount, body.bankRate, body.programRate, body.months)
