import Link from "next/link";
import { ArrowRight, Upload, FileText, Eye } from "lucide-react";
import type { AppListItem } from "@/lib/types";
import { OrgLogo } from "@/components/org-logo";
import { StatusChip } from "@/components/status-chip";
import { dateRu } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEP_INDEX: Record<string, number> = {
  draft: 0,
  submitted: 1,
  stage2_required: 2,
  stage2_submitted: 2,
  in_review: 2,
  needs_changes: 2,
  resubmitted: 2,
  approved: 3,
  contract_signed: 4,
  active: 4,
  completed: 5,
  rejected: 3,
};

function cta(status: string): { label: string; icon: React.ReactNode } {
  if (status === "draft")
    return { label: "Продолжить", icon: <ArrowRight size={16} strokeWidth={1.75} /> };
  if (status === "needs_changes")
    return { label: "Загрузить документы", icon: <Upload size={16} strokeWidth={1.75} /> };
  if (status === "stage2_required")
    return { label: "Добавить сведения", icon: <ArrowRight size={16} strokeWidth={1.75} /> };
  if (status === "approved" || status === "completed" || status === "active")
    return { label: "Посмотреть решение", icon: <FileText size={16} strokeWidth={1.75} /> };
  return { label: "Открыть", icon: <Eye size={16} strokeWidth={1.75} /> };
}

export function ApplicationCard({ app }: { app: AppListItem }) {
  const step = STEP_INDEX[app.status] ?? 0;
  const total = 5;
  const action = cta(app.status);
  const needsAction =
    app.status === "needs_changes" ||
    app.status === "draft" ||
    app.status === "stage2_required";

  return (
    <Link
      href={`/cabinet/applications/${app.id}`}
      className={cn(
        "card-hover block rounded-card border bg-surface p-5 shadow-[var(--shadow-card)]",
        needsAction ? "border-st-amber bg-[#FFFDF7]" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <OrgLogo org={app.org} size={36} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              {app.service?.title}
            </p>
            <p className="truncate text-[12px] text-muted">
              <span className="num">{app.number}</span> · {app.org?.name}
            </p>
          </div>
        </div>
        <StatusChip status={app.status} label={app.statusLabel} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>Срок рассмотрения</span>
          <span>Обновлено {dateRu(app.updatedAt)}</span>
        </div>
        <DayProgress status={app.status} step={step} total={total} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <span
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-control px-4 text-[14px] font-semibold",
            needsAction
              ? "bg-st-amber text-white"
              : "border border-border bg-surface text-ink hover:border-ink"
          )}
        >
          {action.label}
          {action.icon}
        </span>
      </div>
    </Link>
  );
}

function DayProgress({ status, step, total }: { status: string; step: number; total: number }) {
  const done = status === "completed";
  const rejected = status === "rejected";
  const days = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="mt-2 grid grid-cols-5 gap-1.5" aria-label={`Прогресс заявки: шаг ${step} из ${total}`}>
      {days.map((day) => {
        const active = day <= step;
        return (
          <span
            key={day}
            className={cn(
              "h-2 rounded-full",
              active && !rejected && "bg-brand-green",
              active && rejected && "bg-st-red",
              !active && "bg-bg",
              done && "bg-brand-green"
            )}
          />
        );
      })}
    </div>
  );
}
