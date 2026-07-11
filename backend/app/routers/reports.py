"""Каталог аналитической отчётности дочерних организаций (spec 6.7).

Тонкий роутер поверх reports_data — единая точка для внешних материалов
(порталы, отчёты, дашборды) с фильтрами по организации и типу материала.
"""

from fastapi import APIRouter

from ..reports_data import reports_payload

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("")
def list_reports(org: str | None = None, type: str | None = None):
    return reports_payload(org=org, type=type)
