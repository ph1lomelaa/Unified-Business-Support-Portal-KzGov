from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.integration import bus
from app.integration.adapters import AdapterError
from app.models import IntegrationCall, IntegrationOperation, IntegrationSystem


class FlakyAdapter:
    def __init__(self):
        self.calls = 0

    def execute(self, system, op, payload, db):
        self.calls += 1
        if self.calls == 1:
            raise AdapterError("temporary")
        return {"accepted": True, "bin": payload["bin"], "token": "response-secret"}


def _db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    db = Session(engine)
    db.add(
        IntegrationSystem(
            id="esb-test",
            name="ЕИШ test",
            adapterType="test",
            retryPolicy={"maxAttempts": 2, "backoffMs": 0},
        )
    )
    db.add(IntegrationOperation(systemId="esb-test", code="submit", title="Submit"))
    db.commit()
    return db


def test_retry_idempotency_and_sensitive_log_redaction(monkeypatch):
    db = _db()
    adapter = FlakyAdapter()
    monkeypatch.setattr(bus, "get_adapter", lambda _kind: adapter)
    payload = {
        "bin": "123456789012",
        "signedBy": "Иван Иванов",
        "token": "request-secret",
        "nested": {"password": "pwd"},
    }
    first = bus.call(
        db, "esb-test", "submit", payload,
        idempotency_key="unique-submit", application="EPPB-1",
    )
    assert first["ok"] is True
    assert first["attempts"] == 2
    assert adapter.calls == 2

    replay = bus.call(
        db, "esb-test", "submit", payload, idempotency_key="unique-submit"
    )
    assert replay["status"] == "replayed"
    assert adapter.calls == 2

    stored = db.exec(select(IntegrationCall)).one()
    assert stored.requestPayload["bin"] == "********9012"
    assert stored.requestPayload["signedBy"] == "***"
    assert stored.requestPayload["token"] == "***"
    assert stored.requestPayload["nested"]["password"] == "***"
    assert stored.responsePayload["bin"] == "********9012"
    assert stored.responsePayload["token"] == "***"


def test_exhausted_retry_is_recorded_without_bubbling(monkeypatch):
    db = _db()

    class Down:
        def execute(self, *args):
            raise AdapterError("downstream unavailable")

    monkeypatch.setattr(bus, "get_adapter", lambda _kind: Down())
    result = bus.call(db, "esb-test", "submit", {"iin": "123456789012"})
    assert result["ok"] is False
    assert result["attempts"] == 2
    assert result["error"] == "downstream unavailable"
    stored = db.exec(select(IntegrationCall)).one()
    assert stored.status == "error"
    assert stored.requestPayload["iin"] == "********9012"
