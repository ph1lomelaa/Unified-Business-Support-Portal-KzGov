"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Calculator,
  ClipboardList,
  DatabaseZap,
  FileBarChart,
  FileInput,
  LayoutDashboard,
  Library,
  MapPinned,
  Network,
  Rss,
  ScrollText,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_ITEMS = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard, exact: true },
  { href: "/admin/services", label: "Услуги", icon: ClipboardList },
  { href: "/admin/dictionaries", label: "Справочники", icon: Library },
  { href: "/admin/imports", label: "Импорт из источников", icon: FileInput },
  { href: "/admin/knowledge", label: "База знаний", icon: BookOpenText },
  { href: "/admin/calculators", label: "Калькуляторы", icon: Calculator },
  { href: "/admin/reports", label: "Аналитика дочерних компаний", icon: FileBarChart },
  { href: "/admin/projects", label: "Карта проектов", icon: MapPinned },
  { href: "/admin/applications", label: "Заявки", icon: DatabaseZap },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
];

const CONTROL_ITEMS = [
  { href: "/admin/integrations", label: "Интеграции", icon: Network },
  { href: "/admin/sources", label: "Источники", icon: Rss },
  { href: "/admin/statuses", label: "Статусы и маршруты", icon: Workflow },
  { href: "/admin/audit", label: "Журнал аудита", icon: ScrollText },
];

function NavItems({
  items,
  pathname,
}: {
  items: typeof PRIMARY_ITEMS;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

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
  );
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-card border border-border bg-surface p-2 shadow-[var(--shadow-card)]">
      <div className="px-3 py-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
          Администрирование
        </p>
      </div>
      <NavItems items={PRIMARY_ITEMS} pathname={pathname} />
      <div className="mx-3 my-3 border-t border-border" />
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
        Контроль
      </p>
      <NavItems items={CONTROL_ITEMS} pathname={pathname} />
    </nav>
  );
}
