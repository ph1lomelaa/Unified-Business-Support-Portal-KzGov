from fastapi import APIRouter, Depends, Request, Response

from ..analytics import analytics_csv, build_analytics
from ..session import require_role

router = APIRouter(
    prefix="/api/v1/admin/analytics",
    tags=["admin:analytics"],
    dependencies=[Depends(require_role("admin", "analyst"))],
)


def _org_filter(org: str | None) -> list[str] | None:
    if not org:
        return None
    values = [x.strip() for x in org.split(",") if x.strip()]
    return values or None


def _scoped_org_filter(request: Request, org: str | None) -> list[str] | None:
    user = require_role("admin", "analyst")(request)
    if user.role == "analyst":
        return [user.orgId] if user.orgId else []
    return _org_filter(org)


@router.get("")
def get_analytics(request: Request, org: str | None = None, period: int = 365):
    return build_analytics(_scoped_org_filter(request, org), period)


@router.get(".csv")
def get_analytics_csv(request: Request, org: str | None = None, period: int = 365):
    data = build_analytics(_scoped_org_filter(request, org), period)
    return Response(
        analytics_csv(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=eppb-analytics.csv"},
    )
