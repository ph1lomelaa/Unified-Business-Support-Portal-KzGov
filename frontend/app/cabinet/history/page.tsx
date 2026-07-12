"use client";

import * as React from "react";
import Link from "next/link";
import { Clock3, UserRound, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { StatusChip } from "@/components/status-chip";
import { dateTimeRu } from "@/lib/format";

type HistoryItem = {
  id: string;
  appId: string;
  appNumber: string;
  serviceTitle: string;
  fromStatus: string | null;
  toStatus: string;
  toLabel: string;
  actor: "system" | "manager" | "client" | string;
  comment: string | null;
  createdAt: string;
};

const ACTOR_LABEL: Record<string, string> = {
  system: "Система",
  manager: "Менеджер",
  client: "Заявитель",
};

export default function HistoryPage() {
  const [items, setItems] = React.useState<HistoryItem[] | null>(null);

  React.useEffect(() => {
    api<HistoryItem[]>("/api/v1/applications/history")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div>
      <div>
        <h1 className="text-[24px] font-semibold text-ink">История действий</h1>
        <p className="mt-1 text-[14px] text-muted">
          Единый журнал подачи, доработок, смены статусов и системных событий.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
        {items === null ? (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-4">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-[14px] text-muted">
            История появится после подачи первой заявки.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 px-4 py-4 hover:bg-bg/60">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-bg text-brand-green">
                  {item.actor === "system" ? (
                    <Workflow size={18} strokeWidth={1.75} />
                  ) : item.actor === "client" ? (
                    <UserRound size={18} strokeWidth={1.75} />
                  ) : (
                    <Clock3 size={18} strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{item.toLabel}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {ACTOR_LABEL[item.actor] ?? item.actor} ·{" "}
                        <Link href={`/cabinet/applications/${item.appId}`} className="font-medium text-fg hover:underline">
                          {item.appNumber}
                        </Link>{" "}
                        · {item.serviceTitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted">{dateTimeRu(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={item.toStatus} label={item.toLabel} />
                    {item.fromStatus && <span className="text-[12px] text-muted">из статуса {item.fromStatus}</span>}
                  </div>
                  {item.comment && (
                    <p className="mt-2 rounded-control bg-bg px-3 py-2 text-[13px] text-fg">{item.comment}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
