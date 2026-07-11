import { Check } from "lucide-react";
import type { AppEvent, SlaProgress } from "@/lib/status";
import { statusMeta } from "@/lib/status";
import { dateTimeRu } from "@/lib/format";
import { cn } from "@/lib/utils";

const HAPPY = [
  "submitted",
  "stage2_required",
  "stage2_submitted",
  "in_review",
  "approved",
  "contract_signed",
  "active",
  "completed",
];
const TERMINAL = new Set(["completed", "rejected"]);

export function StatusTimeline({
  events,
  status,
  sla,
}: {
  events: AppEvent[];
  status: string;
  sla?: SlaProgress | null;
}) {
  // future greyed nodes on the happy path after the current status
  let future: string[] = [];
  if (!TERMINAL.has(status)) {
    if (status === "needs_changes") {
      future = ["resubmitted", "in_review"];
    } else if (status === "stage2_required") {
      future = ["stage2_submitted", "in_review", "approved", "contract_signed"];
    } else if (status === "stage2_submitted") {
      future = ["in_review", "approved", "contract_signed"];
    } else {
      const idx = HAPPY.indexOf(status);
      if (idx >= 0) future = HAPPY.slice(idx + 1);
    }
  }

  return (
    <ol className="relative">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const current = isLast && !TERMINAL.has(status);
        const meta = statusMeta(e.toStatus);
        return (
          <li key={e.id} className="relative flex gap-3 pb-6 last:pb-0">
            <Rail last={future.length === 0 && isLast} />
            <Dot tone={current ? "current" : "done"} toneName={meta.tone} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p
                  className={cn(
                    "text-[14px] font-medium",
                    current ? "text-ink" : "text-fg"
                  )}
                >
                  {e.toLabel}
                </p>
                <span className="num text-[12px] text-muted">
                  {dateTimeRu(e.createdAt)}
                </span>
              </div>
              {current && sla && (
                <p className="mt-0.5 text-[12px] text-st-blue">
                  {sla.overdue
                    ? "Срок рассмотрения истёк"
                    : `Осталось ~${sla.remaining} раб. дней (до ${sla.due.split("-").reverse().join(".")})`}
                </p>
              )}
              {e.comment && (
                <p className="mt-1.5 rounded-control bg-bg px-3 py-2 text-[13px] text-fg">
                  {e.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}

      {future.map((s, i) => {
        const meta = statusMeta(s);
        return (
          <li key={`f-${s}-${i}`} className="relative flex gap-3 pb-6 last:pb-0">
            <Rail last={i === future.length - 1} />
            <Dot tone="future" toneName={meta.tone} />
            <div className="pt-0.5">
              <p className="text-[14px] text-muted">{meta.label}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Rail({ last }: { last: boolean }) {
  if (last) return null;
  return (
    <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-border" />
  );
}

function Dot({
  tone,
  toneName,
}: {
  tone: "done" | "current" | "future";
  toneName: string;
}) {
  if (tone === "done")
    return (
      <span
        className={cn(
          "z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
          toneName === "red" ? "bg-st-red" : "bg-accent"
        )}
      >
        <Check size={14} strokeWidth={2.5} className="text-white" />
      </span>
    );
  if (tone === "current")
    return (
      <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-st-blue">
        <span className="size-2 rounded-full bg-white pulse-dot" />
      </span>
    );
  return (
    <span className="z-10 size-6 shrink-0 rounded-full border-2 border-border bg-surface" />
  );
}
