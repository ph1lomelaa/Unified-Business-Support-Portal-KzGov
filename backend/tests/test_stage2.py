"""Многоэтапность услуги (I этап -> II этап): разбиение схемы по этапам и
статусные переходы (spec разд. 5, критерий 9.1)."""

from app.schema_stages import has_stage2, split_schema_by_stage
from app.status import can_transition

SINGLE_STAGE = {
    "pages": [
        {"name": "company", "elements": [{"name": "bin"}]},
        {"name": "loan", "elements": [{"name": "amount"}]},
    ]
}

TWO_STAGE = {
    "pages": [
        {"name": "company", "elements": [{"name": "bin"}]},
        {"name": "loan", "elements": [{"name": "amount"}]},
        {"name": "extended", "stage": 2, "elements": [{"name": "collateral"}]},
    ]
}


def test_split_schema_single_stage_has_no_stage2():
    stage1, stage2 = split_schema_by_stage(SINGLE_STAGE)
    assert [p["name"] for p in stage1] == ["company", "loan"]
    assert stage2 == []
    assert not has_stage2(SINGLE_STAGE)


def test_split_schema_separates_stage2_pages():
    stage1, stage2 = split_schema_by_stage(TWO_STAGE)
    assert [p["name"] for p in stage1] == ["company", "loan"]
    assert [p["name"] for p in stage2] == ["extended"]
    assert has_stage2(TWO_STAGE)


def test_split_schema_tolerates_empty():
    assert split_schema_by_stage({}) == ([], [])
    assert split_schema_by_stage({"pages": []}) == ([], [])


def test_stage2_status_flow_transitions():
    # первичная подача многоэтапной услуги уходит на дозаполнение, не в очередь
    assert can_transition("submitted", "stage2_required")
    assert can_transition("stage2_required", "stage2_submitted")
    assert can_transition("stage2_submitted", "in_review")
    # одноэтапная услуга по-прежнему идёт сразу на рассмотрение
    assert can_transition("submitted", "in_review")
    # обратные/недопустимые переходы закрыты
    assert not can_transition("stage2_required", "in_review")
    assert not can_transition("stage2_required", "approved")
