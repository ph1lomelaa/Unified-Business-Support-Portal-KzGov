"""Deterministic analytics generator (spec Часть 6.5 / REQ-18).

52 weeks × the seeded services, with weekly seasonality and an agro growth
trend from March 2026 (tied to the livestock program launch). Deterministic
(hashed) so charts are stable across reloads — no random seed file needed.
"""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import date, timedelta

ORGS = [
    ("damu", "Даму"),
    ("akk", "АКК"),
    ("kazakhexport", "KE"),
    ("brk", "БРК"),
    ("kzhk", "КЖК"),
    ("frp", "ФРП"),
]

SERVICES = [
    ("Субсидирование ставки", "damu"),
    ("Гарантирование", "damu"),
    ("Животноводство", "akk"),
    ("Страхование экспорта", "kazakhexport"),
    ("Кредит крупных проектов", "brk"),
    ("Ипотека для бизнеса", "kzhk"),
]

REGIONS = [
    "г. Алматы", "г. Астана", "Костанайская область", "Карагандинская область",
    "Туркестанская область", "Актюбинская область", "Восточно-Казахстанская область",
    "Павлодарская область", "Жамбылская область", "Атырауская область",
]

AGRO_RAMP_WEEK = 18  # ~ начало марта 2026


def _h(*parts) -> int:
    raw = "|".join(str(p) for p in parts).encode()
    return int(hashlib.sha256(raw).hexdigest(), 16)


def _week_count(org: str, week_idx: int) -> int:
    base = 6 + (_h(org, "base") % 10)
    seasonal = 1.0 + 0.35 * ((week_idx % 13) / 13.0)
    noise = (_h(org, week_idx) % 7) - 3
    val = base * seasonal + noise
    if org == "akk" and week_idx >= AGRO_RAMP_WEEK:
        val *= 1.0 + 0.06 * (week_idx - AGRO_RAMP_WEEK)  # agro growth trend
    return max(0, round(val))


def _weeks(period_days: int) -> list[date]:
    total = min(52, max(4, period_days // 7))
    end = date(2026, 7, 6)
    return [end - timedelta(weeks=(total - 1 - i)) for i in range(total)]


def build_analytics(org_filter: list[str] | None, period_days: int) -> dict:
    orgs = [o for o in ORGS if not org_filter or o[0] in org_filter]
    weeks = _weeks(period_days)

    weekly = []
    for w_idx, wk in enumerate(weeks, start=52 - len(weeks)):
        row = {"week": wk.isoformat(), "byOrg": {}}
        for org_id, _ in orgs:
            row["byOrg"][org_id] = _week_count(org_id, w_idx)
        weekly.append(row)

    # top services (sum over the window)
    top = []
    for title, org_id in SERVICES:
        if org_filter and org_id not in org_filter:
            continue
        total = sum(_week_count(org_id, i) for i in range(52 - len(weeks), 52))
        # split org volume across its services deterministically
        total = round(total * (0.5 + (_h(title, "share") % 50) / 100.0))
        top.append({"title": title, "count": total, "org": org_id})
    top.sort(key=lambda x: x["count"], reverse=True)

    created = sum(sum(r["byOrg"].values()) for r in weekly)
    submitted = round(created * 0.82)
    approved = round(submitted * 0.63)

    regions = []
    for r in REGIONS:
        cnt = 20 + (_h(r, "region") % 180)
        if "Костанай" in r or "Туркестан" in r or "Жамбыл" in r:
            cnt = round(cnt * 1.4)  # agro regions
        regions.append({"region": r, "count": cnt})
    regions.sort(key=lambda x: x["count"], reverse=True)
    maxr = regions[0]["count"] if regions else 1
    for r in regions:
        r["bar"] = round(100 * r["count"] / maxr)

    avg_days = []
    for org_id, short in orgs:
        d = 3.0 + (_h(org_id, "avg") % 30) / 10.0
        avg_days.append({"org": short, "orgId": org_id, "days": round(d, 1)})

    return {
        "weekly": weekly,
        "orgs": [{"id": o[0], "shortName": o[1]} for o in orgs],
        "topServices": top[:6],
        "funnel": {"created": created, "submitted": submitted, "approved": approved},
        "regions": regions[:10],
        "avgDaysByOrg": avg_days,
    }


def analytics_csv(data: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    org_ids = [o["id"] for o in data["orgs"]]
    w.writerow(["Неделя", *[o["shortName"] for o in data["orgs"]], "Всего"])
    for row in data["weekly"]:
        vals = [row["byOrg"].get(oid, 0) for oid in org_ids]
        w.writerow([row["week"], *vals, sum(vals)])
    return buf.getvalue()
