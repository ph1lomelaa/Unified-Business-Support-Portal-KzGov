"""Точечная AI-помощь в конструкторе — детерминированное ядро (без ключа).

Проверяем офлайн-путь: шаблоны полей по категории и эвристику ветвления.
"""

from app.ai.construct import suggest_branching, suggest_fields


def _mem_session():
    from sqlmodel import Session, SQLModel, create_engine

    from app import models  # noqa: F401 — регистрируем таблицы

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _service(db, category: str):
    from app.models import Organization, Service

    db.add(Organization(id="org", name="Орг", shortName="Орг", color="#0B7A3E"))
    svc = Service(slug=f"s-{category}", orgId="org", title=f"Услуга {category}", category=category)
    db.add(svc)
    db.commit()
    return svc.id


def _names(pages):
    return {e["name"] for p in pages for e in p["elements"]}


def test_suggest_fields_credit_template():
    db = _mem_session()
    sid = _service(db, "credit")
    res = suggest_fields(db, sid)
    assert res["source"] == "rules"
    names = _names(res["pages"])
    # spec: кредит → сумма/срок/ставка/цель + компания
    assert {"bin", "loan_amount", "loan_term", "interest_rate", "project_goal"} <= names


def test_suggest_fields_subsidy_has_calc_expression():
    db = _mem_session()
    sid = _service(db, "subsidy")
    res = suggest_fields(db, sid)
    els = [e for p in res["pages"] for e in p["elements"]]
    assert any(e["type"] == "expression" for e in els)  # расчётное поле


def test_suggest_fields_unknown_service_is_empty():
    db = _mem_session()
    res = suggest_fields(db, "nope")
    assert res == {"pages": [], "source": "rules"}


BRANCH_SCHEMA = {
    "pages": [
        {"elements": [
            {"type": "radiogroup", "name": "project_goal", "title": "Цель",
             "choices": [{"value": "working", "text": "Оборотные"},
                         {"value": "investment", "text": "Инвестиции"}]},
            # имя содержит токен «investment» → эвристика свяжет с этим вариантом
            {"type": "number", "name": "investment_share", "title": "Доля инвестиций, %"},
            {"type": "number", "name": "loan_amount", "title": "Сумма"},
        ]}
    ]
}


def test_suggest_branching_heuristic_links_by_token():
    db = _mem_session()
    sid = _service(db, "credit")
    res = suggest_branching(db, sid, "project_goal", BRANCH_SCHEMA)
    assert res["source"] == "rules"
    by_target = {r["targetField"]: r for r in res["rules"]}
    assert "investment_share" in by_target
    assert by_target["investment_share"]["visibleIf"] == "{project_goal} = 'investment'"


def test_suggest_branching_ignores_field_without_choices():
    db = _mem_session()
    sid = _service(db, "credit")
    res = suggest_branching(db, sid, "loan_amount", BRANCH_SCHEMA)
    assert res["rules"] == []
