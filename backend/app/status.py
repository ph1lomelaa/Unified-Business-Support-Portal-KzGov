"""Application status model — single source of truth (spec Часть 7).

draft -> submitted -> in_review -> approved -> contract_signed -> active -> completed
                              -> needs_changes -> resubmitted -> in_review (цикл)
                              -> rejected

Многоэтапные услуги (I этап -> II этап): после первичной подачи заявка уходит не
на рассмотрение, а на дозаполнение расширенных данных/документов, и только затем
попадает в очередь:
submitted -> stage2_required -> stage2_submitted -> in_review -> ...
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta


@dataclass(frozen=True)
class StatusDef:
    key: str
    label: str
    color: str  # gray|blue|amber|green|red
    who: str | None = None
    sla: int | None = None
    comment_required: bool = False
    next: tuple[str, ...] = field(default_factory=tuple)


STATUS: dict[str, StatusDef] = {
    "draft": StatusDef("draft", "Черновик", "gray", who="client", next=("submitted",)),
    "submitted": StatusDef(
        "submitted", "Подана", "blue", next=("in_review", "stage2_required")
    ),
    "stage2_required": StatusDef(
        "stage2_required", "Нужно добавить сведения", "amber",
        who="client", next=("stage2_submitted",),
    ),
    "stage2_submitted": StatusDef(
        "stage2_submitted", "Сведения отправлены", "blue",
        next=("in_review",),
    ),
    "in_review": StatusDef(
        "in_review", "На рассмотрении", "blue", sla=5,
        next=("approved", "needs_changes", "rejected"),
    ),
    "needs_changes": StatusDef(
        "needs_changes", "Нужно исправить заявку", "amber",
        next=("resubmitted",), comment_required=True,
    ),
    "resubmitted": StatusDef(
        "resubmitted", "Отправлена повторно", "blue", next=("in_review",)
    ),
    "approved": StatusDef(
        "approved", "Одобрена", "green", next=("contract_signed",)
    ),
    "contract_signed": StatusDef(
        "contract_signed", "Договор подписан", "green", next=("active",)
    ),
    "active": StatusDef(
        "active", "Субсидирование активно", "green", next=("completed",)
    ),
    "completed": StatusDef("completed", "Завершена", "green"),
    "rejected": StatusDef("rejected", "Не одобрена", "red", comment_required=True),
}

# Terminal statuses (no outgoing transitions).
TERMINAL = {"completed", "rejected"}


# --- DB-configurable overrides (Фаза 4.4) ------------------------------------
# The map above is the DEFAULT and the seed source. At startup (and after admin
# edits) `load_status_config(db)` loads StatusModel/StatusTransition into these
# caches. While empty (offline / before seed) everything falls back to STATUS,
# so behaviour is unchanged. Statuses, labels, colours, SLA, comment rules and
# transitions (per named flow) become admin-editable without code.
_OVR: dict[str, dict] | None = None
_FLOWS: dict[str, dict[str, list[str]]] = {}


def load_status_config(db) -> None:
    global _OVR, _FLOWS
    from sqlmodel import select

    from .models import StatusModel, StatusTransition

    rows = db.exec(select(StatusModel)).all()
    if not rows:
        _OVR, _FLOWS = None, {}
        return
    _OVR = {
        m.key: {
            "label": m.label,
            "color": m.color,
            "who": m.who,
            "sla": m.sla,
            "comment_required": m.commentRequired,
            "terminal": m.terminal,
        }
        for m in rows
    }
    flows: dict[str, dict[str, list[str]]] = {}
    for t in sorted(db.exec(select(StatusTransition)).all(), key=lambda t: t.sortOrder):
        targets = flows.setdefault(t.flow, {}).setdefault(t.fromKey, [])
        if t.toKey and t.toKey not in targets:
            targets.append(t.toKey)
    _FLOWS = flows


def _eff(key: str) -> dict | None:
    if _OVR is not None:
        return _OVR.get(key)
    d = STATUS.get(key)
    if not d:
        return None
    return {
        "label": d.label,
        "color": d.color,
        "who": d.who,
        "sla": d.sla,
        "comment_required": d.comment_required,
        "terminal": key in TERMINAL,
    }


def next_statuses(key: str, flow: str = "default") -> list[str]:
    if _FLOWS:
        return list(_FLOWS.get(flow, {}).get(key, []))
    d = STATUS.get(key)
    return list(d.next) if d else []


def can_transition(src: str, dst: str, flow: str = "default") -> bool:
    return dst in next_statuses(src, flow)


def requires_comment(dst: str) -> bool:
    d = _eff(dst)
    return bool(d and d["comment_required"])


def status_label(key: str) -> str:
    d = _eff(key)
    return d["label"] if d else key


def status_color(key: str) -> str:
    d = _eff(key)
    return d["color"] if d else "gray"


def add_working_days(start: date, days: int) -> date:
    """Add N working days (skip Sat/Sun) — SLA due date."""
    cur = start
    added = 0
    while added < days:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


def working_days_between(start: date, end: date) -> int:
    """Count working days elapsed from start to end (inclusive of progress)."""
    if end <= start:
        return 0
    cur = start
    count = 0
    while cur < end:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            count += 1
    return count


def sla_progress(submitted_at: datetime, sla_days: int = 5) -> dict:
    """Compute 'день N из 5' style SLA progress from a submitted timestamp."""
    start = submitted_at.date()
    today = datetime.now().date()
    elapsed = working_days_between(start, today)
    due = add_working_days(start, sla_days)
    remaining = max(0, working_days_between(today, due))
    return {
        "elapsed": min(elapsed, sla_days),
        "total": sla_days,
        "due": due.isoformat(),
        "remaining": remaining,
        "overdue": today > due,
    }
