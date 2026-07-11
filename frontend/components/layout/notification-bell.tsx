"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useI18n } from "@/i18n/provider";
import { timeAgoRu } from "@/lib/format";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  appId?: string | null;
  read: boolean;
  createdAt: string;
};

// Header bell: badge count + dropdown последних 5 (spec 5.4).
export function NotificationBell({
  items = [],
}: {
  items?: NotificationItem[];
}) {
  const { t } = useI18n();
  const unread = items.filter((n) => !n.read).length;
  const last5 = items.slice(0, 5);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("bell.title")}
          className="relative inline-flex size-11 items-center justify-center rounded-control border border-white/25 text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
        >
          <Bell size={20} strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[340px] overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[14px] font-semibold text-ink">
              {t("bell.title")}
            </span>
          </div>
          {last5.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              {t("bell.empty")}
            </div>
          ) : (
            <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
              {last5.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.appId ? `/cabinet/applications/${n.appId}` : "/cabinet/notifications"}
                    className={cn(
                      "block px-4 py-3 hover:bg-bg",
                      !n.read && "bg-st-blue-bg/40"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-st-blue" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">
                          {n.title}
                        </p>
                        <p className="line-clamp-2 text-[12px] text-muted">
                          {n.body}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {timeAgoRu(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <DropdownMenu.Item asChild>
            <Link
              href="/cabinet/notifications"
              className="block border-t border-border px-4 py-3 text-center text-[13px] font-medium text-ink hover:bg-bg focus-visible:outline-none"
            >
              {t("bell.all")}
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
