"""Встроенные AI-помощники — детерминированное ядро (spec 6.6, items 3–4).

Ключ в тестах не задан → validate_field откатывается к офлайн-эвристикам
(source == "rules"). Проверяем именно этот путь: он работает без сети.
"""

from app.ai.assist import heuristic_check, validate_field


def test_clean_project_name_passes():
    res = validate_field(
        "project_name",
        "Молочная ферма на 200 голов",
        {"title": "Наименование проекта", "type": "text"},
    )
    assert res["ok"] is True
    assert res["severity"] == "ok"
    assert res["message"] is None
    assert res["source"] == "rules"


def test_gibberish_flagged_as_warning():
    res = validate_field(
        "project_name",
        "sdfgh jklzx cvbnm",  # слова без гласных — клавиатурный мусор
        {"title": "Наименование проекта", "type": "text"},
    )
    assert res["ok"] is False
    assert res["severity"] == "warn"
    assert res["suggestion"] is None  # офлайн-ядро не предлагает правку


def test_consonant_run_flagged():
    res = heuristic_check(
        "project_name", "прролджкт фыва", {"title": "Наименование проекта"}
    )
    assert res["ok"] is False  # «фывапролдж»-подобный ввод: ≥5 согласных подряд


def test_random_symbol_run_flagged():
    res = heuristic_check("name", "aaaaa", {"title": "Наименование"})
    assert res["ok"] is False


def test_short_description_flagged():
    res = validate_field(
        "justification",
        "ок",
        {"title": "Обоснование проекта", "type": "comment"},
    )
    assert res["ok"] is False
    assert "подробнее" in (res["message"] or "")


def test_empty_value_is_ok():
    # пустое значение — забота обычной required-валидации формы, не наша
    res = validate_field("project_name", "  ", {"title": "Наименование проекта"})
    assert res["ok"] is True


def test_short_names_are_not_nitpicked():
    res = heuristic_check("company", "ТОО АгроМир", {"title": "Компания"})
    assert res["ok"] is True


# --- field_help: детерминированный фолбэк из схемы (без ключа) ---------------

def _mem_session():
    from sqlmodel import Session, SQLModel, create_engine

    from app import models  # noqa: F401 — регистрируем таблицы

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed_service(db):
    from app.models import FormSchema, Organization, Service

    db.add(Organization(id="akk", name="АКК", shortName="АКК", color="#0B7A3E"))
    svc = Service(
        slug="akk-animal", orgId="akk", title="Льготное кредитование животноводства",
        category="credit", description="Не менее 70% суммы займа — на скот.",
        status="published",
    )
    db.add(svc)
    db.flush()
    db.add(FormSchema(
        serviceId=svc.id, version=1, isActive=True,
        schema={"pages": [{"elements": [
            {"type": "radiogroup", "name": "project_goal", "title": "Цель финансирования",
             "choices": [
                 {"value": "working", "text": "Оборотные средства"},
                 {"value": "investment", "text": "Инвестиции",
                  "description": "Для инвестиционных целей — собственное участие не менее 20%."},
             ]},
            {"type": "text", "name": "cattle_supplier", "title": "Поставщик скота",
             "description": "Укажите наименование поставщика по договору."},
        ]}]},
    ))
    db.commit()
    return svc.id


def test_field_help_option_uses_choice_description():
    from app.ai.assist import field_help

    db = _mem_session()
    sid = _seed_service(db)
    res = field_help(db, sid, "project_goal", option_value="investment")
    assert res["source"] == "rules"  # ключа нет → офлайн
    assert "20%" in (res["hint"] or "")


def test_field_help_explain_uses_field_description():
    from app.ai.assist import field_help

    db = _mem_session()
    sid = _seed_service(db)
    res = field_help(db, sid, "cattle_supplier")
    assert res["source"] == "rules"
    assert "поставщик" in (res["hint"] or "").lower()


def test_field_help_unknown_field_returns_null_hint():
    from app.ai.assist import field_help

    db = _mem_session()
    sid = _seed_service(db)
    res = field_help(db, sid, "does_not_exist")
    assert res["hint"] is None
