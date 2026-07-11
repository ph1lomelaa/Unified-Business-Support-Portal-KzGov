"""Subsidy / annuity calculations (spec Часть 4.5).

- annuity monthly payment (standard formula)
- subsidy comparison: payment & overpayment with bank rate vs program rate
- economy over the term (both annuity-accurate and the simple interest-
  differential used by the wizard expression field:
  amount * (bank_rate - program_rate)/100 * months/12)
"""

from __future__ import annotations


def annuity_payment(principal: float, annual_rate_pct: float, months: int) -> float:
    if months <= 0:
        return 0.0
    mr = annual_rate_pct / 100.0 / 12.0
    if mr == 0:
        return principal / months
    factor = (1 + mr) ** months
    return principal * mr * factor / (factor - 1)


def economy_simple(
    amount: float, bank_rate: float, program_rate: float, months: int
) -> float:
    """Interest-differential approximation used by the live wizard field."""
    return amount * (bank_rate - program_rate) / 100.0 * months / 12.0


def subsidy_calc(
    amount: float,
    bank_rate: float,
    program_rate: float,
    months: int,
) -> dict:
    pay_no_sub = annuity_payment(amount, bank_rate, months)
    pay_sub = annuity_payment(amount, program_rate, months)
    total_no_sub = pay_no_sub * months
    total_sub = pay_sub * months
    overpay_no_sub = total_no_sub - amount
    overpay_sub = total_sub - amount
    economy = total_no_sub - total_sub

    return {
        "amount": round(amount),
        "bankRate": bank_rate,
        "programRate": program_rate,
        "months": months,
        "paymentNoSubsidy": round(pay_no_sub),
        "paymentSubsidy": round(pay_sub),
        "totalNoSubsidy": round(total_no_sub),
        "totalSubsidy": round(total_sub),
        "overpayNoSubsidy": round(overpay_no_sub),
        "overpaySubsidy": round(overpay_sub),
        "economy": round(economy),
        "economySimple": round(economy_simple(amount, bank_rate, program_rate, months)),
        "series": _overpay_series(amount, bank_rate, program_rate, months),
    }


def _overpay_series(
    amount: float, bank_rate: float, program_rate: float, months: int
) -> list[dict]:
    """Cumulative overpayment per month for the AreaChart (two lines)."""
    pay_no = annuity_payment(amount, bank_rate, months)
    pay_sub = annuity_payment(amount, program_rate, months)
    bal_no = amount
    bal_sub = amount
    paid_no = 0.0
    paid_sub = 0.0
    mr_no = bank_rate / 100.0 / 12.0
    mr_sub = program_rate / 100.0 / 12.0
    # Sample ~24 points max to keep payload small.
    step = max(1, months // 24)
    out: list[dict] = []
    for m in range(1, months + 1):
        int_no = bal_no * mr_no
        int_sub = bal_sub * mr_sub
        bal_no = max(0.0, bal_no + int_no - pay_no)
        bal_sub = max(0.0, bal_sub + int_sub - pay_sub)
        paid_no += int_no
        paid_sub += int_sub
        if m % step == 0 or m == months:
            out.append(
                {
                    "month": m,
                    "overpayNoSubsidy": round(paid_no),
                    "overpaySubsidy": round(paid_sub),
                }
            )
    return out


def cattle_rule_ok(cattle_amount: float, loan_amount: float) -> bool:
    """Правило 70%: не менее 70% суммы займа идёт на приобретение скота."""
    if loan_amount <= 0:
        return False
    return cattle_amount >= loan_amount * 0.7
