"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ServiceCard as ServiceCardType } from "@/lib/types";
import { OrgLogo } from "@/components/org-logo";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n/dictionaries";

const CATEGORY_KEY: Record<string, DictKey> = {
  credit: "catalog.category.credit",
  subsidy: "catalog.category.subsidy",
  guarantee: "catalog.category.guarantee",
  leasing: "catalog.category.leasing",
  insurance: "catalog.category.insurance",
  investment: "catalog.category.investment",
};

export function ServiceCard({ service }: { service: ServiceCardType }) {
  const { t } = useI18n();
  const metrics = (service.conditions ?? []).slice(0, 2);
  const categoryKey = CATEGORY_KEY[service.category];
  return (
    <Link
      href={`/services/${service.slug}`}
      className="group flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <OrgLogo org={service.org} size={36} />
          <span className="line-clamp-2 text-[12px] font-medium leading-tight text-muted">
            {service.org?.name}
          </span>
        </div>
        <ArrowUpRight
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-border transition-colors group-hover:text-ink"
        />
      </div>

      {service.status === "published" && (
        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-st-green-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-st-green">
          Приём заявок
        </span>
      )}

      <h3 className="mt-2 text-[16px] font-semibold text-ink">
        {service.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-[13px] text-muted">
        {service.summary}
      </p>

      {metrics.length > 0 && (
        <div className="mt-4 flex gap-6">
          {metrics.map((m, i) => (
            <div key={i}>
              <p className="text-[12px] text-muted">{m.label}</p>
              <p className="num text-[18px] font-semibold text-ink">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted">
          <span className="rounded-control border border-gold/40 bg-gold/10 px-2 py-0.5 font-medium text-ink">
          {categoryKey ? t(categoryKey) : service.category}
        </span>
        <span>
          {service.reviewDays} {t("common.workDays")}
        </span>
      </div>
    </Link>
  );
}
