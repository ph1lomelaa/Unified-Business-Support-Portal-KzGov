from datetime import date

from app.calc import cattle_rule_ok, economy_simple, subsidy_calc
from app.status import add_working_days, can_transition, requires_comment


def test_cattle_rule_requires_70_percent():
    assert cattle_rule_ok(70, 100)
    assert not cattle_rule_ok(69, 100)
    assert not cattle_rule_ok(10, 0)


def test_subsidy_simple_economy():
    assert economy_simple(10_000_000, 19, 7, 24) == 2_400_000
    data = subsidy_calc(10_000_000, 19, 7, 24)
    assert data["paymentNoSubsidy"] > data["paymentSubsidy"]
    assert data["economy"] > 0


def test_status_transition_rules_and_comments():
    assert can_transition("submitted", "in_review")
    assert can_transition("in_review", "needs_changes")
    assert not can_transition("submitted", "approved")
    assert requires_comment("needs_changes")
    assert requires_comment("rejected")


def test_working_days_skip_weekend():
    assert add_working_days(date(2026, 7, 10), 1).isoformat() == "2026-07-13"
