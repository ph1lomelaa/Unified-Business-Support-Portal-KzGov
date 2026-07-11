"""AI-проверка заявки — детерминированное ядро (spec 6.6, критерий 9.4).

Проверяем правила без обращения к Claude (ключ в тестах не задан -> fallback).
"""

from app.ai.review import check_application

SCHEMA = {
    "pages": [
        {
            "elements": [
                {
                    "type": "text", "name": "bin", "title": "БИН",
                    "isRequired": True,
                    "validators": [
                        {"type": "regex", "regex": "^[0-9]{12}$", "text": "12 цифр"}
                    ],
                },
                {
                    "type": "number", "name": "loan_amount", "title": "Сумма займа",
                    "isRequired": True, "min": 3_000_000, "max": 1_500_000_000,
                },
                {"type": "number", "name": "cattle_amount", "title": "На скот"},
                {"type": "html", "name": "note", "html": "<div>...</div>"},
            ]
        }
    ]
}


def test_flags_missing_required_fields():
    res = check_application(SCHEMA, {})
    errors = {i["field"] for i in res["issues"] if i["severity"] == "error"}
    assert "bin" in errors
    assert "loan_amount" in errors
    assert res["ok"] is False
    assert res["total"] == 3  # html-поле не считается
    assert res["source"] == "rules"


def test_flags_range_regex_and_70_percent_rule():
    res = check_application(
        SCHEMA, {"bin": "123", "loan_amount": 1000, "cattle_amount": 100}
    )
    by_field = {i["field"]: i for i in res["issues"]}
    assert by_field["bin"]["severity"] == "warn"  # неверный формат БИН
    assert by_field["loan_amount"]["severity"] == "error"  # ниже минимума
    assert by_field["cattle_amount"]["severity"] == "error"  # нарушено правило 70%


def test_clean_application_passes():
    res = check_application(
        SCHEMA,
        {"bin": "123456789012", "loan_amount": 10_000_000, "cattle_amount": 8_000_000},
    )
    assert res["ok"] is True
    assert res["issues"] == []
    assert res["filled"] == 3
    assert "корректно" in res["summary"]
