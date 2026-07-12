from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
from app.db import get_session
from app.main import app
from app.models import Project, Report
from app.session import SessionUser, encode_session


def _client(user):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Report(id="akk-report", orgId="akk", title="АКК", status="published"))
        db.add(Report(id="damu-report", orgId="damu", title="Даму", status="published"))
        db.add(Project(
            id="akk-project", title="АКК", orgId="akk", regionId="astana",
            industry="АПК", status="Финансируется", year=2025,
        ))
        db.add(Project(
            id="damu-project", title="Даму", orgId="damu", regionId="astana",
            industry="МСБ", status="Финансируется", year=2025,
        ))
        db.commit()

    def override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    client.cookies.set(settings.session_cookie, encode_session(user))
    return client


def test_analyst_only_manages_own_reports_and_projects():
    client = _client(SessionUser(id="a", name="Analyst", role="analyst", orgId="akk"))
    try:
        reports = client.get("/api/v1/admin/reports").json()["items"]
        assert [r["id"] for r in reports] == ["akk-report"]
        assert client.patch("/api/v1/admin/reports/damu-report", json={"title": "hack"}).status_code == 403
        assert client.post("/api/v1/admin/reports", json={"orgId": "damu", "title": "hack"}).status_code == 403

        projects = client.get("/api/v1/admin/projects").json()["items"]
        assert [p["id"] for p in projects] == ["akk-project"]
        assert client.delete("/api/v1/admin/projects/damu-project").status_code == 403
        assert client.post(
            "/api/v1/admin/projects",
            json={"title": "hack", "orgId": "damu", "regionId": "astana", "industry": "МСБ"},
        ).status_code == 403
        assert client.get("/api/v1/admin/calculators").status_code == 403
        assert client.get("/api/v1/admin/knowledge").status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_admin_can_crud_report_project_and_calculator():
    client = _client(SessionUser(id="admin", name="Admin", role="admin"))
    try:
        report = client.post(
            "/api/v1/admin/reports",
            json={"orgId": "damu", "title": "Новый отчёт", "period": "2026"},
        )
        assert report.status_code == 201
        assert client.patch(
            f"/api/v1/admin/reports/{report.json()['id']}", json={"status": "published"}
        ).status_code == 200

        project = client.post(
            "/api/v1/admin/projects",
            json={"title": "Новый проект", "orgId": "akk", "regionId": "astana", "industry": "АПК", "amount": 8_000_000_000},
        )
        assert project.status_code == 201
        assert project.json()["lat"] is not None
        assert client.patch(
            f"/api/v1/admin/projects/{project.json()['id']}", json={"jobs": 25}
        ).json()["jobs"] == 25
        assert client.post(
            "/api/v1/admin/projects",
            json={"title": "Без отрасли", "orgId": "akk", "regionId": "astana"},
        ).status_code == 400

        calculator = client.post(
            "/api/v1/admin/calculators",
            json={
                "title": "Новый расчёт",
                "inputs": [{"name": "amount", "default": 100}],
                "formula": "amount * 2",
                "status": "published",
            },
        )
        assert calculator.status_code == 201
        assert client.post(
            "/api/v1/admin/calculators/preview",
            json={"formula": "amount * 3", "inputs": [{"name": "amount", "default": 2}]},
        ).json()["result"] == 6

        knowledge = client.post(
            "/api/v1/admin/knowledge",
            json={
                "type": "checklist",
                "title": "Проверка документов",
                "summary": "Чек-лист",
                "body": "- Документ 1",
                "downloadRef": "documents-checklist",
                "relatedServiceSlugs": ["akk-animal"],
            },
        )
        assert knowledge.status_code == 201
        item_id = knowledge.json()["id"]
        assert client.patch(
            f"/api/v1/admin/knowledge/{item_id}", json={"readMinutes": 3}
        ).json()["readMinutes"] == 3
        assert client.get("/api/v1/knowledge?relatedTo=akk-animal").json()["items"][0]["id"] == item_id
        download = client.get(f"/api/v1/knowledge/{knowledge.json()['slug']}/download")
        assert download.status_code == 200
        assert download.headers["content-type"] == "application/pdf"

        no_file = client.post(
            "/api/v1/admin/knowledge",
            json={"type": "article", "title": "Без файла", "body": "Текст"},
        ).json()
        assert client.get(f"/api/v1/knowledge/{no_file['slug']}/download").status_code == 404
        assert client.delete(f"/api/v1/admin/knowledge/{no_file['id']}").status_code == 204
    finally:
        app.dependency_overrides.clear()
        client.close()
