from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
from app.db import get_session
from app.main import app
from app.models import Organization
from app.session import SessionUser, encode_session


def _client(user=None):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
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
    if user:
        client.cookies.set(settings.session_cookie, encode_session(user))
    return client


def test_ai_service_generation_requires_authenticated_author():
    client = _client()
    try:
        response = client.post(
            "/api/ai/generate-service", json={"text": "Программа", "orgId": "akk"}
        )
        assert response.status_code == 401
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_analyst_cannot_generate_service_for_other_organization():
    client = _client(
        SessionUser(id="analyst", name="Analyst", role="analyst", orgId="damu")
    )
    try:
        response = client.post(
            "/api/ai/generate-service", json={"text": "Программа", "orgId": "akk"}
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_ai_warmup_requires_admin_role():
    client = _client(
        SessionUser(id="analyst", name="Analyst", role="analyst", orgId="akk")
    )
    try:
        assert client.post("/api/ai/warmup").status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()
