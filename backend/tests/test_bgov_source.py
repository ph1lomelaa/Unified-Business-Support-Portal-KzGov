"""Fixture-based tests for the bgov.kz adapter — no live network calls.

Fixtures mirror the real shape observed from https://bgov.kz/ru/services
(Inertia data-page JSON) as of 2026-07, notably the "Программа «Іскер
аймақ»" listing used to validate structured conditions/description/materials
extraction against real published data.
"""

import html
import json

from app.sources.bgov import (
    normalize_card,
    normalize_category,
    parse_data_page,
    parse_materials,
    structured_conditions,
    structured_description,
)
from app.sources.pipeline import map_org_id

CONDITIONS = [
    {"code": "amount", "title": "Сумма", "min": None, "max": 200_000_000, "unit": "тенге"},
    {"code": "period", "title": "Срок", "min": None, "max": 3, "unit": "лет"},
    {"code": "percent", "title": "Ставка", "min": None, "max": 12.6, "unit": "%"},
]

CONTENT_BLOCKS = {
    "blocks": [
        {"type": "header", "data": {"text": "Участники", "level": 2}},
        {
            "type": "paragraph",
            "data": {"text": "Субъекты микро и малого бизнеса, сельскохозяйственные кооперативы"},
        },
        {"type": "header", "data": {"text": "Целевое назначение", "level": 2}},
        {"type": "paragraph", "data": {"text": "- Инвестиции;"}},
        {"type": "paragraph", "data": {"text": "- Пополнение оборотных средств"}},
    ]
}

ROW = {
    "id": 234,
    "code": "isker_aimak",
    "name": "Программа «Іскер аймақ»",
    "description": "Льготное финансирование сельхозкооперативов",
    "content": CONTENT_BLOCKS,
    "requirements": [{"name": "Справка об отсутствии задолженности"}],
    "conditions": CONDITIONS,
    "team": {"code": "damu", "short_name": "Фонд «Даму»", "name": "АО «Фонд развития предпринимательства «Даму»"},
    "primary_category": {"code": "subsidy", "name": "Субсидирование"},
}


class FakeOrg:
    def __init__(self, org_id: str):
        self.id = org_id


ORGS = {oid: FakeOrg(oid) for oid in ["damu", "akk", "brk", "kaf", "frp", "kazakhexport"]}


def test_structured_conditions_uses_real_min_max_unit():
    conditions = structured_conditions(CONDITIONS)
    assert conditions == [
        {"label": "Сумма", "value": "до 200 000 000 тенге", "code": "amount"},
        {"label": "Срок", "value": "до 3 лет", "code": "period"},
        {"label": "Ставка", "value": "до 12.6 %", "code": "percent"},
    ]


def test_structured_conditions_handles_range_and_missing_max():
    ranged = structured_conditions([{"code": "x", "title": "Диапазон", "min": 5, "max": 10, "unit": "лет"}])
    assert ranged[0]["value"] == "5–10 лет"

    floor_only = structured_conditions([{"code": "y", "title": "От", "min": 7, "max": None, "unit": "%"}])
    assert floor_only[0]["value"] == "от 7 %"

    assert structured_conditions("not-a-list") == []
    assert structured_conditions([{"code": "z", "title": "", "min": None, "max": None, "unit": ""}]) == []


def test_summary_does_not_dump_the_raw_html_table():
    # bgov's own `description` field is often an HTML *table* (used for
    # structured_description()), not a sentence — regression test for a bug
    # where clean_text() flattened the whole table into one run-on summary.
    table_row = dict(
        ROW,
        content={},  # no Editor.js blocks to fall back to either
        description=(
            '<figure class="table"><table><tbody>'
            "<tr><td>Участники</td><td>Субъекты микро и малого бизнеса, юридические лица, "
            "являющиеся сельскохозяйственными кооперативами</td></tr>"
            "<tr><td>Сумма кредита</td><td>до 200 млн тг</td></tr>"
            "<tr><td>Целевое назначение</td><td>Инвестиции; Пополнение оборотных средств</td></tr>"
            "<tr><td>Ставка вознаграждения</td><td>Базовая ставка НБ РК + 4%</td></tr>"
            "<tr><td>Размер субсидирования</td><td>40% от номинальной ставки вознаграждения</td></tr>"
            "<tr><td>Конечная ставка на заемщика</td><td>не менее 12,6%</td></tr>"
            "</tbody></table></figure>"
        ),
        short_description=None,
    )
    card = normalize_card(table_row, "https://bgov.kz")
    assert len(card.summary) <= 220
    assert "<" not in card.summary


def test_structured_description_renders_sections_as_plain_text():
    text = structured_description(CONTENT_BLOCKS)
    assert "Участники:" in text
    assert "Субъекты микро и малого бизнеса" in text
    assert "Целевое назначение:" in text
    assert "- Инвестиции;" in text
    # No leftover HTML/markup — the frontend renders this as plain text.
    assert "<" not in text


def test_normalize_card_maps_real_row_end_to_end():
    card = normalize_card(ROW, "https://bgov.kz")
    assert card.code == "isker_aimak"
    assert card.url == "https://bgov.kz/ru/services/isker_aimak"
    assert card.org_code == "damu"
    assert card.category == "subsidy"
    assert card.conditions[0] == {"label": "Сумма", "value": "до 200 000 000 тенге", "code": "amount"}
    # High confidence, source-grounded evidence for every structured condition.
    rate_evidence = [e for e in card.evidence if e["kind"] == "rate"]
    assert rate_evidence and rate_evidence[0]["confidence"] > 0.9
    assert "Участники:" in card.description


def test_map_org_id_only_matches_known_institutions():
    assert map_org_id(normalize_card(ROW, "https://bgov.kz"), ORGS) == "damu"

    unmapped_row = dict(ROW, team={"code": "mitwork", "name": 'ТОО "MITWORK"'})
    assert map_org_id(normalize_card(unmapped_row, "https://bgov.kz"), ORGS) is None


def test_normalize_category_falls_back_to_subsidy():
    assert normalize_category("credit") == "credit"
    assert normalize_category("Гарантирование") == "guarantee"
    assert normalize_category("something-unrelated") == "subsidy"


def _inertia_page(payload: dict) -> str:
    encoded = html.escape(json.dumps(payload), quote=True)
    return f'<html><body><div id="app" data-page="{encoded}"></div></body></html>'


def test_parse_data_page_reads_inertia_json():
    payload = {"component": "Public/Announces/Index", "props": {"services": {"data": [ROW], "last_page": 1}}}
    parsed = parse_data_page(_inertia_page(payload))
    assert parsed["props"]["services"]["data"][0]["code"] == "isker_aimak"


def test_parse_materials_extracts_real_downloadable_files():
    detail_payload = {
        "props": {
            "model": {
                "files": [
                    {
                        "name": "Іскер_Аймақ_презентация.pdf",
                        "link": "https://bgov.kz/ru/download/abc123",
                        "mime": "application/pdf",
                        "prettySize": "7.1 MB",
                    },
                    {"name": "no-link-file.docx"},
                ]
            }
        }
    }
    materials = parse_materials(detail_payload)
    assert materials == [
        {
            "name": "Іскер_Аймақ_презентация.pdf",
            "url": "https://bgov.kz/ru/download/abc123",
            "mime": "application/pdf",
            "size": "7.1 MB",
        }
    ]


def test_parse_materials_empty_when_no_files():
    assert parse_materials({"props": {"model": {}}}) == []
    assert parse_materials({}) == []
