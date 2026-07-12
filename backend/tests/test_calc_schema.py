import pytest

from app.calc_eval import FormulaError, compute_schema_expressions


def test_schema_calculations_support_dependencies_and_ignore_client_values():
    schema = {"pages": [{"elements": [
        {"type": "number", "name": "amount"},
        {"type": "number", "name": "rate"},
        {"type": "expression", "name": "interest", "expression": "{amount} * {rate} / 100"},
        {"type": "expression", "name": "total", "expression": "{amount} + {interest}"},
    ]}]}
    assert compute_schema_expressions(schema, {"amount": 1000, "rate": 10}) == {
        "interest": 100,
        "total": 1100,
    }


def test_schema_calculation_normalises_division_by_zero():
    schema = {"pages": [{"elements": [
        {"type": "number", "name": "amount"},
        {"type": "number", "name": "term"},
        {"type": "expression", "name": "payment", "expression": "{amount} / {term}"},
    ]}]}
    with pytest.raises(FormulaError, match="деление на ноль"):
        compute_schema_expressions(schema, {"amount": 1000, "term": 0})
