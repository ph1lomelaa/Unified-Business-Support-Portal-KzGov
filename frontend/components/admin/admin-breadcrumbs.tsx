"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  services: "Услуги",
  imports: "Импорт из источников",
  knowledge: "База знаний",
  applications: "Заявки",
  analytics: "Аналитика",
  integrations: "Интеграции",
  audit: "Журнал аудита",
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const crumbs = parts.map((part, index) => ({
    label: LABELS[part] ?? (index > 0 ? "Редактирование" : part),
    href: `/admin/${parts.slice(0, index + 1).join("/")}`,
  }));

  return (
    <nav aria-label="Хлебные крошки" className="mb-5 flex min-h-5 items-center gap-1.5 text-[13px] text-muted">
      <Link href="/admin" className="hover:text-ink">
        Администрирование
      </Link>
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight size={15} aria-hidden="true" />
            {last ? (
              <span className="font-medium text-fg">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-ink">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
