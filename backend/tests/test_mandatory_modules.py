from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.models import Calculator, Project, Report


def _client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Report(
            id="rep-public", orgId="damu", type="financial", title="Отчёт 2025",
            description="Финансовая отчётность", source="Даму", period="2025",
            updated="2026-01-01", url="https://example.test/report", embedUrl="https://example.test/embed",
            status="published",
        ))
        db.add(Report(
            id="rep-draft", orgId="damu", type="financial", title="Черновик",
            status="draft",
        ))
        db.add(Project(
            id="project-1", title="Ферма", orgId="akk", regionId="astana",
            city="Астана", industry="Агропромышленный комплекс", status="Финансируется",
            year=2025, amount=5_000_000_000, jobs=50, lat=51.1, lon=71.4,
            description="Проект",
        ))
        db.add(Project(
            id="project-no-coords", title="Проект региона", orgId="damu", regionId="astana",
            city="", industry="Обрабатывающая промышленность", status="Завершён",
            year=2023, amount=1_000_000, jobs=2, lat=None, lon=None,
        ))
        db.add(Calculator(
            slug="safe-calc", title="Расчёт", summary="", status="published",
            inputs=[{"name": "amount", "default": 100}, {"name": "rate", "default": 5}],
            formula="amount * rate / 100", resultLabel="Результат",
        ))
        db.add(Calculator(
            slug="broken-calc", title="Ошибка", summary="", status="published",
            inputs=[{"name": "amount", "default": 100}], formula="amount / zero",
        ))
        db.commit()

    def override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = override
    return TestClient(app)


def test_reports_publish_filter_source_period_and_embed_contract():
    client = _client()
    try:
        payload = client.get("/api/v1/reports?org=damu&type=financial").json()
        assert payload["total"] == 1
        assert len(payload["items"]) == 1
        report = payload["items"][0]
        assert report["source"] == "Даму"
        assert report["period"] == "2025"
        assert report["embedUrl"].endswith("/embed")
        assert "Черновик" not in str(payload)
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_map_filters_status_period_details_and_region_aggregation():
    client = _client()
    try:
        payload = client.get(
            "/api/v1/map/projects?org=akk&region=astana&status=Финансируется&yearFrom=2024&yearTo=2026"
        ).json()
        assert [p["id"] for p in payload["projects"]] == ["project-1"]
        project = payload["projects"][0]
        assert project["amount"] == 5_000_000_000
        assert project["jobs"] == 50
        astana = next(r for r in payload["regions"] if r["id"] == "astana")
        assert astana["count"] == 1
        assert astana["amount"] == 5_000_000_000

        all_projects = client.get("/api/v1/map/projects?region=astana").json()["projects"]
        no_coords = next(p for p in all_projects if p["id"] == "project-no-coords")
        assert no_coords["lat"] is None and no_coords["lon"] is None
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_calculator_is_server_side_and_handles_invalid_formula():
    client = _client()
    try:
        public = client.get("/api/v1/calculators/safe-calc").json()
        assert "formula" not in public
        result = client.post(
            "/api/v1/calculators/safe-calc/compute", json={"values": {"amount": 200, "rate": 10}}
        )
        assert result.status_code == 200
        assert result.json()["result"] == 20
        assert client.post(
            "/api/v1/calculators/broken-calc/compute", json={"values": {}}
        ).status_code == 422
    finally:
        app.dependency_overrides.clear()
        client.close()
