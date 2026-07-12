"""End-to-end API contracts for both mandatory multi-stage control cases."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.config import settings
from app.db import get_session
from app.main import app
from app.models import (
    Application,
    ApplicationEvent,
    Company,
    FormSchema,
    Notification,
    Organization,
    Service,
)
from app.session import SessionUser, encode_session


@pytest.mark.parametrize(
    ("slug", "title", "org_id"),
    [
        ("akk-animal-contract", "Агробизнес животноводство", "akk"),
        ("brk-wagons-contract", "Приобретение вагонов в лизинг", "brk"),
    ],
)
def test_control_case_primary_submit_snapshot_stage2_and_cabinet(
    slug, title, org_id, tmp_path, monkeypatch
):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    schema_v1 = {
        "title": title,
        "pages": [
            {"name": "company", "elements": [{"type": "text", "name": "bin"}]},
            {"name": "initial", "elements": [{"type": "number", "name": "amount"}]},
            {
                "name": "extended",
                "stage": 2,
                "elements": [{"type": "text", "name": "collateral"}],
            },
            {"name": "calculation", "elements": [
                {"type": "expression", "name": "double_amount", "expression": "{amount} * 2"}
            ]},
        ],
    }
    schema_v2 = {"title": "Later version", "pages": [{"name": "replacement", "elements": []}]}
    with Session(engine) as db:
        db.add(Organization(id=org_id, name=org_id.upper(), shortName=org_id.upper()))
        db.add(
            Company(
                bin="123456789012",
                name="ТОО Агро Тест",
                form="TOO",
                oked="0142",
                okedName="Животноводство",
                address="Астана",
                region="Астана",
                director="Директор",
                category="small",
            )
        )
        service = Service(
            id=f"svc-{org_id}",
            slug=slug,
            orgId=org_id,
            title=title,
            category="leasing" if org_id == "brk" else "credit",
            status="published",
            docTemplate="Заявка {{app.number}} — {{answers.amount}}",
        )
        db.add(service)
        db.add(FormSchema(serviceId=service.id, version=1, schema=schema_v1, isActive=True))
        db.commit()

    def override():
        with Session(engine) as db:
            yield db

    routed = []
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    monkeypatch.setattr("app.routers.applications.bus.call", lambda *a, **kw: routed.append((a, kw)))
    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    client.cookies.set(
        settings.session_cookie,
        encode_session(
            SessionUser(
                id="owner", name="Предприниматель", role="entrepreneur", bin="123456789012"
            )
        ),
    )
    try:
        draft = client.post(
            "/api/v1/applications",
            json={"serviceId": f"svc-{org_id}", "companyBin": "123456789012"},
        )
        assert draft.status_code == 201
        app_id = draft.json()["id"]

        submitted = client.post(
            f"/api/v1/applications/{app_id}/submit",
            json={
                "answers": {"bin": "123456789012", "amount": 10_000_000},
                "calc": {"double_amount": 1},
                "consents": [True, True],
                "signedBy": "Директор",
            },
        )
        assert submitted.status_code == 200
        assert submitted.json()["multistage"] is True
        assert submitted.json()["status"] == "stage2_required"
        assert len(routed) == 1
        assert routed[0][1]["idempotency_key"].startswith("app-EPPB-")

        # Publishing/changing a form later must never mutate an existing application.
        with Session(engine) as db:
            old = db.exec(select(FormSchema).where(FormSchema.serviceId == f"svc-{org_id}")) .one()
            old.isActive = False
            db.add(old)
            db.add(FormSchema(serviceId=f"svc-{org_id}", version=2, schema=schema_v2, isActive=True))
            db.commit()

        detail = client.get(f"/api/v1/applications/{app_id}").json()
        assert detail["schema"] == schema_v1
        assert detail["stage2"]["pending"] is True
        assert [p["name"] for p in detail["stage2"]["pages"]] == ["extended"]

        stage2 = client.post(
            f"/api/v1/applications/{app_id}/stage2",
            json={"answers": {"collateral": "Недвижимость"}, "signedBy": "Директор"},
        )
        assert stage2.status_code == 200
        assert stage2.json()["status"] == "in_review"

        applications = client.get("/api/v1/applications").json()
        documents = client.get("/api/v1/applications/documents").json()
        history = client.get("/api/v1/applications/history").json()
        assert applications[0]["id"] == app_id
        assert applications[0]["status"] == "in_review"
        assert any(d["appId"] == app_id and d["source"] == "system" for d in documents)
        assert {h["toStatus"] for h in history if h["appId"] == app_id} >= {
            "submitted",
            "stage2_required",
            "stage2_submitted",
            "in_review",
        }

        with Session(engine) as db:
            stored = db.get(Application, app_id)
            assert stored.schemaSnapshot == schema_v1
            assert stored.answers["collateral"] == "Недвижимость"
            assert stored.calc["double_amount"] == 20_000_000
            assert (tmp_path / f"{stored.number}.pdf").exists()
            assert len(db.exec(select(Notification).where(Notification.appId == app_id)).all()) == 2
            assert len(db.exec(select(ApplicationEvent).where(ApplicationEvent.appId == app_id)).all()) == 4
    finally:
        app.dependency_overrides.clear()
        client.close()
