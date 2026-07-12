"""Regression tests for the mandatory administrative application contour."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.config import settings
from app.db import get_session
from app.main import app
from app.models import (
    Application,
    ApplicationEvent,
    AuditLog,
    Company,
    Notification,
    Organization,
    Service,
)
from app.session import SessionUser, encode_session


def _test_client(role="admin", org_id=None):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def session_override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = session_override
    client = TestClient(app)
    client.cookies.set(
        settings.session_cookie,
        encode_session(
            SessionUser(
                id=f"{role}-test",
                name=role.title(),
                role=role,
                orgId=org_id,
            )
        ),
    )
    return engine, client


def test_admin_queue_returns_sla_instead_of_500():
    engine, client = _test_client()
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        db.add(Organization(id="akk", name="Аграрная кредитная корпорация", shortName="АКК"))
        db.add(
            Service(
                id="svc-test",
                slug="animal-test",
                orgId="akk",
                title="Животноводство",
                category="credit",
                status="published",
            )
        )
        db.add(
            Company(
                bin="123456789012",
                name="ТОО Тест",
                form="TOO",
                oked="0142",
                okedName="Животноводство",
                address="Астана",
                region="Астана",
                director="Тестовый директор",
                category="small",
            )
        )
        db.add(
            Application(
                id="app-test",
                number="EPPB-TEST-001",
                serviceId="svc-test",
                companyBin="123456789012",
                status="in_review",
                createdAt=now,
                updatedAt=now,
            )
        )
        db.add(
            ApplicationEvent(
                appId="app-test",
                fromStatus="draft",
                toStatus="submitted",
                actor="client",
                createdAt=now,
            )
        )
        db.commit()

    try:
        response = client.get("/api/v1/admin/applications")
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        assert rows[0]["number"] == "EPPB-TEST-001"
        assert rows[0]["statusLabel"] == "На рассмотрении"
        assert rows[0]["sla"]["total"] == 5
        assert rows[0]["company"]["bin"] == "123456789012"
        assert rows[0]["org"]["shortName"] == "АКК"
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_analyst_without_organization_cannot_open_or_transition_application():
    engine, client = _test_client(role="analyst")
    _seed_review_application(engine)
    try:
        assert client.get("/api/v1/admin/applications").json() == []
        assert client.get("/api/v1/admin/applications/app-test").status_code == 403
        response = client.post(
            "/api/v1/admin/applications/app-test/transition",
            json={"to": "approved"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_transition_requires_comment_and_writes_event_notification_and_audit():
    engine, client = _test_client(role="analyst", org_id="akk")
    _seed_review_application(engine)
    try:
        missing = client.post(
            "/api/v1/admin/applications/app-test/transition",
            json={"to": "needs_changes"},
        )
        assert missing.status_code == 400

        changed = client.post(
            "/api/v1/admin/applications/app-test/transition",
            json={"to": "needs_changes", "comment": "Добавьте бизнес-план"},
        )
        assert changed.status_code == 200
        assert changed.json()["status"] == "needs_changes"

        with Session(engine) as db:
            stored = db.get(Application, "app-test")
            assert stored.status == "needs_changes"
            events = db.exec(
                select(ApplicationEvent).where(ApplicationEvent.appId == "app-test")
            ).all()
            assert events[-1].comment == "Добавьте бизнес-план"
            assert events[-1].actor == "manager"
            notice = db.exec(
                select(Notification).where(Notification.appId == "app-test")
            ).one()
            assert notice.userBin == "123456789012"
            audit = db.exec(
                select(AuditLog).where(AuditLog.entityId == "app-test")
            ).one()
            assert audit.action == "application.status_changed"
            assert audit.meta["toStatus"] == "needs_changes"
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_queue_filters_and_detail_next_statuses():
    engine, client = _test_client()
    _seed_review_application(engine)
    try:
        assert len(client.get("/api/v1/admin/applications?status=in_review").json()) == 1
        assert client.get("/api/v1/admin/applications?status=approved").json() == []
        assert len(client.get("/api/v1/admin/applications?service=svc-test").json()) == 1
        assert client.get("/api/v1/admin/applications?service=other").json() == []
        assert len(client.get("/api/v1/admin/applications?org=akk").json()) == 1
        assert client.get("/api/v1/admin/applications?org=damu").json() == []
        assert client.get("/api/v1/admin/applications?offset=1&limit=1").json() == []

        detail = client.get("/api/v1/admin/applications/app-test")
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["number"] == "EPPB-TEST-002"
        assert set(payload["nextStatuses"]) == {"approved", "needs_changes", "rejected"}
        assert payload["service"]["slug"] == "animal-test"
        assert payload["company"]["region"] == "Астана"
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_analyst_only_sees_own_organization_even_with_org_filter():
    engine, client = _test_client(role="analyst", org_id="damu")
    _seed_review_application(engine)
    try:
        assert client.get("/api/v1/admin/applications?org=akk").json() == []
        assert client.get("/api/v1/admin/applications/app-test").status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()


def _seed_review_application(engine):
    now = datetime.now(timezone.utc)
    with Session(engine) as db:
        db.add(Organization(id="akk", name="АКК", shortName="АКК"))
        db.add(
            Service(
                id="svc-test",
                slug="animal-test",
                orgId="akk",
                title="Животноводство",
                category="credit",
                status="published",
            )
        )
        db.add(
            Company(
                bin="123456789012",
                name="ТОО Тест",
                form="TOO",
                oked="0142",
                okedName="Животноводство",
                address="Астана",
                region="Астана",
                director="Директор",
                category="small",
            )
        )
        db.add(
            Application(
                id="app-test",
                number="EPPB-TEST-002",
                serviceId="svc-test",
                companyBin="123456789012",
                status="in_review",
                createdAt=now,
                updatedAt=now,
            )
        )
        db.commit()
