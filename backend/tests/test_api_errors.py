from fastapi.testclient import TestClient

from app.main import app


def test_http_errors_have_correlation_id_and_compatible_detail():
    client = TestClient(app)
    response = client.get("/api/v1/services/definitely-missing", headers={"x-request-id": "req-test-1"})
    assert response.status_code == 404
    assert response.headers["x-request-id"] == "req-test-1"
    assert response.json()["detail"] == "Услуга не найдена"
    assert response.json()["error"] == {
        "code": "http_404",
        "message": "Услуга не найдена",
        "requestId": "req-test-1",
    }


def test_validation_errors_are_structured_and_do_not_expose_tracebacks():
    client = TestClient(app)
    response = client.post("/api/ai/navigate", json={})
    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "validation_error"
    assert payload["error"]["requestId"]
    assert "Traceback" not in response.text
