from app.analytics import analytics_csv, build_analytics
from app.map_data import map_payload
from app.reports_data import reports_payload


def test_analytics_payload_and_csv_are_deterministic():
    data = build_analytics(["damu"], 90)
    assert data["orgs"] == [{"id": "damu", "shortName": "Даму"}]
    assert len(data["weekly"]) >= 4
    assert data["funnel"]["created"] > data["funnel"]["approved"]
    csv = analytics_csv(data)
    assert "Неделя" in csv
    assert "Даму" in csv


def test_map_payload_filters_projects():
    all_data = map_payload()
    akk_data = map_payload(org="akk")
    assert len(all_data["projects"]) >= 100
    assert 0 < len(akk_data["projects"]) < len(all_data["projects"])
    assert all(p["orgId"] == "akk" for p in akk_data["projects"])
    assert all_data["regions"][0]["name"]


def test_reports_catalog_filters_and_decorates():
    all_data = reports_payload()
    assert all_data["total"] == len(all_data["items"])
    # каждая карточка несёт источник, период и человекочитаемый тип
    first = all_data["items"][0]
    for item in all_data["items"]:
        for key in ("title", "description", "source", "period", "updated", "url", "typeLabel", "orgShort", "orgLogo"):
            assert item[key]
        assert len(item["description"].split(".")) >= 3
        assert "embeddable" not in item
        assert len(item["updated"]) == 10
    assert len(all_data["orgs"]) == 8  # Holding + seven subsidiaries
    # фильтр по организации сужает выборку
    damu = reports_payload(org="damu")
    assert 0 < len(damu["items"]) < len(all_data["items"])
    assert all(r["org"] == "damu" for r in damu["items"])
    # фильтр по типу материала
    dashboards = reports_payload(type="dashboard")
    assert dashboards["items"] == []
    combined = reports_payload(org="damu,brk", type="financial,research")
    assert combined["items"]
    assert all(r["org"] in {"damu", "brk"} for r in combined["items"])
    assert all(r["type"] in {"financial", "research"} for r in combined["items"])
