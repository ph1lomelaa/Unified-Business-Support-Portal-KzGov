"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, Clock3, FileText, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/cabinet", label: "Мои заявки", icon: Inbox, exact: true },
  { href: "/cabinet/documents", label: "Документы", icon: FileText },
  { href: "/cabinet/notifications", label: "Уведомления", icon: Bell },
  { href: "/cabinet/profile", label: "Профиль компании", icon: Building2 },
  { href: "/cabinet/history", label: "История действий", icon: Clock3 },
];

export function CabinetNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-card border border-border bg-surface p-2 shadow-[var(--shadow-card)]">
      <div className="px-3 py-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
          Личный кабинет
        </p>
      </div>
      <div className="space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-[14px] font-medium transition-colors",
                active
                  ? "bg-st-green-bg text-brand-green"
                  : "text-fg hover:bg-bg hover:text-ink"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
