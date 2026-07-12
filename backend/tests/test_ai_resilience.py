from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.ai import assist, client as ai_client, construct, navigate
from app.config import settings
from app.models import Organization, Service


class FailingMessages:
    messages = None

    def __init__(self):
        self.messages = self

    def create(self, **_kwargs):
        raise TimeoutError("provider timeout")


def _db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    db = Session(engine)
    db.add(Organization(id="akk", name="АКК", shortName="АКК"))
    db.add(Service(
        id="svc-ai", slug="animal-ai", orgId="akk", title="Кредит животноводству",
        category="credit", summary="Кредит на приобретение скота", status="published",
        tags={"industries": ["agro"]}, conditions=[{"label": "Ставка", "value": "5%"}],
    ))
    db.commit()
    return db


def test_ai_status_distinguishes_unavailable_and_provider_fallback(monkeypatch):
    ai_client._STATUS_CACHE.update({"expires": 0.0, "payload": None})
    unavailable = ai_client.ai_status(force=True)
    assert unavailable["mode"] == "unavailable"
    assert unavailable["live"] is False

    monkeypatch.setattr(settings, "anthropic_api_key", "configured-test-key")
    monkeypatch.setattr(ai_client, "get_client", lambda *a, **k: FailingMessages())
    fallback = ai_client.ai_status(force=True)
    assert fallback["mode"] == "fallback"
    assert fallback["live"] is False
    assert fallback["error"]


def test_user_and_constructor_helpers_fall_back_on_provider_timeout(monkeypatch):
    failing = FailingMessages()
    db = _db()
    monkeypatch.setattr(navigate, "get_client", lambda *a, **k: failing)
    monkeypatch.setattr(assist, "get_client", lambda *a, **k: failing)
    monkeypatch.setattr(construct, "get_client", lambda *a, **k: failing)

    nav = navigate.navigate(db, "нужен кредит на скот")
    assert nav["source"] == "fallback"
    assert nav["recommendations"][0]["service"]["slug"] == "animal-ai"
    assert nav["recommendations"][0]["evidence"] == [{"label": "Ставка", "value": "5%"}]

    field = assist.validate_field("project_name", "Молочная ферма", {"title": "Проект"})
    assert field["source"] == "rules"

    audit = construct.audit_schema({
        "pages": [{"elements": [{"type": "text", "name": "bin", "isRequired": True}]}]
    })
    assert audit["source"] == "rules"
