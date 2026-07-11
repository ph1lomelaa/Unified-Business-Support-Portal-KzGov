"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, FileText, Newspaper, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { timeAgoRu } from "@/lib/format";
import { cn } from "@/lib/utils";

function icon(kind: string) {
  if (kind === "documents") return <FileText size={18} strokeWidth={1.75} />;
  if (kind === "news") return <Newspaper size={18} strokeWidth={1.75} />;
  return <Bell size={18} strokeWidth={1.75} />;
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);

  const load = React.useCallback(async () => {
    setItems(await api<NotificationItem[]>("/api/v1/notifications"));
  }, []);

  React.useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  async function markAll() {
    await api("/api/v1/notifications/read-all", { method: "POST", json: {} });
    load();
  }

  const unread = (items ?? []).filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">Уведомления</h1>
          <p className="mt-1 text-[14px] text-muted">
            {unread > 0 ? `${unread} непрочитанных` : "Все прочитаны"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck size={16} strokeWidth={1.75} />
            Отметить всё прочитанным
          </Button>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
        {items === null ? (
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-[14px] text-muted">
            Уведомлений пока нет
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={
                    n.appId
                      ? `/cabinet/applications/${n.appId}`
                      : "/cabinet/notifications"
                  }
                  className={cn(
                    "flex gap-3 px-4 py-4 hover:bg-bg",
                    !n.read && "bg-st-blue-bg/40"
                  )}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-bg text-ink">
                    {icon("status")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={cn(
                          "text-[14px]",
                          n.read ? "font-medium text-fg" : "font-semibold text-ink"
                        )}
                      >
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[12px] text-muted">
                        {timeAgoRu(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-st-blue" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
