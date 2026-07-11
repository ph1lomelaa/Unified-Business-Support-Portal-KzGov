"use client";

import { Check, Circle, Save } from "lucide-react";
import { OrgLogo } from "@/components/org-logo";
import { tenge, dateTimeRu } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrgBrief } from "@/lib/types";

export type StepState = { title: string; done: boolean; active: boolean };

export function SummarySidebar({
  serviceTitle,
  org,
  steps,
  economy,
  savedAt,
}: {
  serviceTitle: string;
  org: OrgBrief | null;
  steps: StepState[];
  economy: number | null;
  savedAt: Date | null;
}) {
  return (
    <aside className="w-full lg:w-[280px] lg:shrink-0">
      <div className="lg:sticky lg:top-24 space-y-4">
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <OrgLogo org={org} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">
                {serviceTitle}
              </p>
              <p className="truncate text-[12px] text-muted">{org?.name}</p>
            </div>
          </div>

          <ol className="mt-4 space-y-1">
            {steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-control px-2 py-1.5 text-[13px]",
                  s.active && "bg-bg font-medium text-ink"
                )}
              >
                {s.done ? (
                  <Check size={16} strokeWidth={2} className="text-accent" />
                ) : s.active ? (
                  <Circle size={16} strokeWidth={2} className="text-gold" />
                ) : (
                  <Circle size={16} strokeWidth={1.75} className="text-border" />
                )}
                <span className={cn(!s.active && !s.done && "text-muted")}>
                  {s.title}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {economy !== null && economy > 0 && (
          <div className="rounded-card border border-st-green-bg bg-st-green-bg p-4">
            <p className="text-[12px] font-medium text-st-green">
              Ваша экономия за срок
            </p>
            <p className="mt-1 num text-[24px] font-semibold text-st-green">
              {tenge(economy)}
            </p>
          </div>
        )}

        {savedAt && (
          <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted">
            <Save size={14} strokeWidth={1.75} />
            Черновик сохранён {dateTimeRu(savedAt).split(", ")[1]}
          </p>
        )}
      </div>
    </aside>
  );
}
