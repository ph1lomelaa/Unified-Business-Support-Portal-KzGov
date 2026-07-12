"""Safe arithmetic formula evaluator (Фаза 4.2).

Evaluates a formula string over a dict of numeric variables using a whitelisted
AST — NO `eval`, no attribute access, no arbitrary calls. Powers the interactive
calculators (Calculator.formula) and can validate expression-field formulas.
Supports + - * / % ** , unary +/- , parentheses, and the functions
pow/min/max/round/abs/sqrt.
"""

from __future__ import annotations

import ast
import math
import operator
import re

_BIN = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCS = {
    "pow": pow,
    "min": min,
    "max": max,
    "round": round,
    "abs": abs,
    "sqrt": math.sqrt,
}


class FormulaError(Exception):
    """Raised for an invalid formula or an unsafe/unknown reference."""


_REF = re.compile(r"\{([a-zA-Z0-9_]+)\}")


def compute_schema_expressions(schema: dict, answers: dict) -> dict[str, float]:
    """Recompute SurveyJS expression fields server-side from submitted answers."""
    fields: list[dict] = []

    def walk(elements):
        for item in elements or []:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "panel":
                walk(item.get("elements"))
            else:
                fields.append(item)

    for page in (schema or {}).get("pages", []) or []:
        walk(page.get("elements"))

    variables: dict[str, float] = {}
    for key, value in (answers or {}).items():
        try:
            if not isinstance(value, bool):
                variables[str(key)] = float(value)
        except (TypeError, ValueError):
            continue

    results: dict[str, float] = {}
    pending = [f for f in fields if f.get("type") == "expression" and f.get("name")]
    for _ in range(len(pending) + 1):
        progressed = False
        for field in list(pending):
            formula = str(field.get("expression") or "")
            refs = _REF.findall(formula)
            if not refs or any(ref not in variables for ref in refs):
                continue
            normalized = _REF.sub(lambda match: match.group(1), formula)
            value = evaluate(normalized, variables)
            name = str(field["name"])
            variables[name] = value
            results[name] = value
            pending.remove(field)
            progressed = True
        if not progressed:
            break
    return results


def evaluate(formula: str, variables: dict[str, float]) -> float:
    try:
        tree = ast.parse(formula or "", mode="eval")
        result = _eval(tree.body, variables)
    except FormulaError:
        raise
    except ZeroDivisionError as exc:
        raise FormulaError("деление на ноль") from exc
    except Exception as exc:  # noqa: BLE001 — normalise any parse/eval error
        raise FormulaError(f"некорректная формула: {exc}") from exc
    if isinstance(result, bool) or not isinstance(result, (int, float)):
        raise FormulaError("формула должна возвращать число")
    if result != result or result in (float("inf"), float("-inf")):  # NaN/inf
        raise FormulaError("результат не является конечным числом")
    return float(result)


def _eval(node: ast.AST, v: dict[str, float]) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return node.value
        raise FormulaError("недопустимая константа")
    if isinstance(node, ast.Name):
        if node.id in v:
            return float(v[node.id])
        raise FormulaError(f"неизвестная переменная: {node.id}")
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
        return _BIN[type(node.op)](_eval(node.left, v), _eval(node.right, v))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_eval(node.operand, v))
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS:
        return _FUNCS[node.func.id](*[_eval(a, v) for a in node.args])
    raise FormulaError("недопустимое выражение")
