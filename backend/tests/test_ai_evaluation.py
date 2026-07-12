from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.ai.evaluation import NAVIGATION_CASES
from app.ai.navigate import navigate
from app.models import Organization, Service


def test_fixed_navigation_evaluation_set():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    db = Session(engine)
    for org in ("akk", "brk", "damu", "kazakhexport"):
        db.add(Organization(id=org, name=org, shortName=org))
    services = [
        ("akk-animal", "akk", "Кредит на животноводство и приобретение скота", "credit"),
        ("brk-wagons-leasing", "brk", "Приобретение грузовых вагонов в лизинг", "leasing"),
        ("damu-guarantee", "damu", "Гарантия при недостатке залога по кредиту", "guarantee"),
        ("kazakhexport-insurance", "kazakhexport", "Страхование экспортного контракта", "insurance"),
        ("damu-subsidy", "damu", "Субсидирование процентной ставки по кредиту", "subsidy"),
    ]
    for slug, org, title, category in services:
        db.add(Service(
            id=f"svc-{slug}", slug=slug, orgId=org, title=title, summary=title,
            category=category, status="published", tags={}, conditions=[],
        ))
    db.commit()

    passed = 0
    for case in NAVIGATION_CASES:
        result = navigate(db, case["query"])
        slugs = [row["service"]["slug"] for row in result["recommendations"]]
        passed += case["expectedSlug"] in slugs
    assert passed == len(NAVIGATION_CASES), f"navigator eval: {passed}/{len(NAVIGATION_CASES)}"
