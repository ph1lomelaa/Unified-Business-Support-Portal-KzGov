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
        "stage2_required", "Требуются расширенные данные", "amber",
        who="client", next=("stage2_submitted",),
    ),
    "stage2_submitted": StatusDef(
        "stage2_submitted", "Расширенные данные поданы", "blue",
        next=("in_review",),
    ),
    "in_review": StatusDef(
        "in_review", "На рассмотрении", "blue", sla=5,
        next=("approved", "needs_changes", "rejected"),
    ),
    "needs_changes": StatusDef(
        "needs_changes", "Требует доработки", "amber",
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
    "rejected": StatusDef("rejected", "Отказ", "red", comment_required=True),
}

# Terminal statuses (no outgoing transitions).
TERMINAL = {"completed", "rejected"}


def can_transition(src: str, dst: str) -> bool:
    s = STATUS.get(src)
    return bool(s and dst in s.next)


def requires_comment(dst: str) -> bool:
    d = STATUS.get(dst)
    return bool(d and d.comment_required)


def status_label(key: str) -> str:
    d = STATUS.get(key)
    return d.label if d else key


def status_color(key: str) -> str:
    d = STATUS.get(key)
    return d.color if d else "gray"


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
