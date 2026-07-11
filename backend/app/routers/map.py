from fastapi import APIRouter

from ..map_data import REGIONS, map_payload

router = APIRouter(prefix="/api/v1/map", tags=["map"])


@router.get("/regions")
def regions():
    return [{"id": r["id"], "name": r["name"]} for r in REGIONS]


@router.get("/projects")
def projects(
    org: str | None = None,
    region: str | None = None,
    industry: str | None = None,
    year: int | None = None,
):
    return map_payload(org=org, region=region, industry=industry, year=year)
