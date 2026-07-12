"""Contract proof that services are authored, versioned and published no-code."""

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.config import settings
from app.db import get_session
from app.main import app
from app.models import FormSchema, Organization, Service
from app.session import SessionUser, encode_session


def _client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Organization(id="akk", name="АКК", shortName="АКК"))
        db.commit()

    def override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    client.cookies.set(
        settings.session_cookie,
        encode_session(SessionUser(id="admin", name="Admin", role="admin")),
    )
    return engine, client


def test_constructor_create_version_publish_and_runtime_active_schema():
    engine, client = _client()
    schema_v2 = {
        "title": "Контрольная услуга",
        "pages": [{"name": "initial", "elements": [{"type": "text", "name": "bin"}]}],
    }
    schema_v3 = {
        "title": "Контрольная услуга v3",
        "pages": [{"name": "changed", "elements": [{"type": "number", "name": "amount"}]}],
    }
    try:
        created = client.post(
            "/api/v1/admin/services",
            json={"title": "Контрольная услуга", "orgId": "akk", "category": "credit", "slug": "contract-service"},
        )
        assert created.status_code == 201
        service_id = created.json()["id"]

        # Drafts must never leak into the public catalog by a guessed slug.
        assert client.get("/api/v1/services/contract-service").status_code == 404

        saved_v2 = client.put(
            f"/api/v1/admin/services/{service_id}/form",
            json={"schema": schema_v2, "author": "Contract test"},
        )
        assert saved_v2.json()["version"] == 2
        assert client.post(
            f"/api/v1/admin/services/{service_id}/publish", json={"version": 2}
        ).json() == {"status": "published", "activeVersion": 2}

        runtime_v2 = client.get("/api/v1/services/contract-service").json()
        assert runtime_v2["form"] == schema_v2

        assert client.put(
            f"/api/v1/admin/services/{service_id}/form",
            json={"schema": schema_v3, "author": "Contract test"},
        ).json()["version"] == 3
        # Saving a draft version must not alter the active runtime form.
        assert client.get("/api/v1/services/contract-service").json()["form"] == schema_v2

        assert client.post(
            f"/api/v1/admin/services/{service_id}/publish", json={"version": 3}
        ).json()["activeVersion"] == 3
        assert client.get("/api/v1/services/contract-service").json()["form"] == schema_v3

        comparison = client.get(
            f"/api/v1/admin/services/{service_id}/versions/compare?fromVersion=2&toVersion=3"
        ).json()
        assert comparison["added"] == ["amount"]
        assert comparison["removed"] == ["bin"]
        assert comparison["pagesBefore"] == comparison["pagesAfter"] == 1

        with Session(engine) as db:
            service = db.get(Service, service_id)
            versions = db.exec(
                select(FormSchema).where(FormSchema.serviceId == service_id)
            ).all()
            assert service.status == "published"
            assert [v.version for v in versions] == [1, 2, 3]
            assert [v.version for v in versions if v.isActive] == [3]
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_publish_rejects_broken_conditions_duplicates_and_formula():
    _engine, client = _client()
    try:
        created = client.post(
            "/api/v1/admin/services",
            json={"title": "Сломанная форма", "orgId": "akk", "slug": "broken-form"},
        )
        service_id = created.json()["id"]
        broken = {
            "pages": [{"elements": [
                {"type": "text", "name": "bin", "isRequired": True},
                {"type": "text", "name": "bin"},
                {"type": "text", "name": "conditional", "visibleIf": "{missing} = true"},
                {"type": "text", "name": "self_ref", "visibleIf": "{self_ref} = true"},
                {"type": "expression", "name": "calc", "expression": "{bin} / ("},
            ]}],
        }
        version = client.put(
            f"/api/v1/admin/services/{service_id}/form", json={"schema": broken}
        ).json()["version"]
        response = client.post(
            f"/api/v1/admin/services/{service_id}/publish", json={"version": version}
        )
        assert response.status_code == 422
        issues = response.json()["detail"]["issues"]
        messages = " ".join(i["message"] for i in issues)
        assert "Дублируется" in messages
        assert "несуществующее поле" in messages
        assert "циклически" in messages
        assert "некорректная формула" in messages
        assert client.get("/api/v1/services/broken-form").status_code == 404
    finally:
        app.dependency_overrides.clear()
        client.close()
