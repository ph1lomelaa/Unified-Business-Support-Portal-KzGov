"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { OrgBrief, Region, ServiceFacets, CompanyLookup } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n/dictionaries";
import { Select } from "@/components/ui/select";

const CATEGORY_KEY: Record<string, DictKey> = {
  credit: "catalog.category.credit",
  subsidy: "catalog.category.subsidy",
  guarantee: "catalog.category.guarantee",
  leasing: "catalog.category.leasing",
  insurance: "catalog.category.insurance",
  investment: "catalog.category.investment",
};

const INDUSTRY_KEY: Record<string, DictKey> = {
  agro: "catalog.industry.agro",
  manufacturing: "catalog.industry.manufacturing",
  trade: "catalog.industry.trade",
  services: "catalog.industry.services",
};

const BIZ_SIZE_KEY: Record<string, DictKey> = {
  micro: "catalog.bizSize.micro",
  small: "catalog.bizSize.small",
  medium: "catalog.bizSize.medium",
  large: "catalog.bizSize.large",
};

export function SupportNavigator({
  orgs,
  regions,
}: {
  orgs: OrgBrief[];
  regions: Region[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useI18n();

  const category = params.get("category");
  const org = params.get("org") ?? "";
  const region = params.get("region") ?? "";
  const industry = params.get("industry") ?? "";
  const bizSize = params.get("bizSize") ?? "";

  const [bin, setBin] = React.useState("");
  const [binState, setBinState] = React.useState<
    "idle" | "checking" | "found" | "not-found"
  >("idle");
  const [binResult, setBinResult] = React.useState<CompanyLookup | null>(null);
  const [facets, setFacets] = React.useState<ServiceFacets | null>(null);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  // Tab badge counts follow every non-category filter change.
  React.useEffect(() => {
    const qs = new URLSearchParams();
    if (org) qs.set("org", org);
    if (bizSize) qs.set("bizSize", bizSize);
    if (industry) qs.set("industry", industry);
    if (region) qs.set("region", region);
    api<ServiceFacets>(`/api/v1/services/facets?${qs.toString()}`)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [org, bizSize, industry, region]);

  // Debounced BIN/IIN lookup — mirrors the wizard's mock ГБД ЮЛ prefill, but
  // used here to auto-pick the industry (and region) facet instead of a form.
  React.useEffect(() => {
    if (bin.length !== 12) {
      setBinState("idle");
      setBinResult(null);
      return;
    }
    setBinState("checking");
    const timer = setTimeout(() => {
      api<CompanyLookup>(`/api/v1/integrations/egov/company/${bin}`)
        .then((company) => {
          setBinState("found");
          setBinResult(company);
          // Single push for both fields — two sequential setParam() calls
          // would each start from the same stale `params` snapshot and the
          // second would clobber the first.
          const next = new URLSearchParams(params.toString());
          next.set("industry", company.industryHint);
          if (company.regionHint) next.set("region", company.regionHint);
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        })
        .catch(() => {
          setBinState("not-found");
          setBinResult(null);
        });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bin]);

  const hasFilters = Boolean(category || org || region || industry || bizSize || bin);

  const reset = () => {
    setBin("");
    setBinState("idle");
    setBinResult(null);
    router.push(pathname, { scroll: false });
  };

  return (
    <div className="rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <h2 className="text-[16px] font-bold uppercase tracking-[0.02em] text-ink">
          {t("catalog.nav.title")}
        </h2>
        {hasFilters && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"
          >
            <X size={14} strokeWidth={2} />
            {t("catalog.nav.reset")}
          </button>
        )}
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("catalog.nav.region")}>
          <Select
            value={region}
            onValueChange={(value) => setParam("region", value || null)}
            placeholder={t("catalog.nav.regionAny")}
            options={regions.map((r) => ({ value: r.id, label: r.name }))}
            className="h-11 w-full"
          />
        </Field>

        <Field label={t("catalog.nav.binOrIndustry")} className="sm:col-span-2 lg:col-span-1">
          <input
            value={bin}
            onChange={(e) => setBin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder={t("catalog.nav.binPlaceholder")}
            inputMode="numeric"
            className="h-11 w-full rounded-control border border-border bg-bg px-3 text-[14px] text-ink"
          />
          {binState === "checking" && (
            <p className="mt-1.5 text-[12px] text-muted">{t("catalog.nav.binChecking")}</p>
          )}
          {binState === "found" && binResult && (
            <p className="mt-1.5 text-[12px] text-brand-green">
              {t("catalog.nav.binFound")} {binResult.okedName}
            </p>
          )}
          {binState === "not-found" && (
            <p className="mt-1.5 text-[12px] text-st-red">{t("catalog.nav.binNotFound")}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[12px] text-muted">{t("catalog.nav.binOr")}</span>
            <Select
              value={industry}
              onValueChange={(value) => setParam("industry", value || null)}
              placeholder={t("catalog.nav.industryAny")}
              options={Object.entries(INDUSTRY_KEY).map(([k, key]) => ({
                value: k,
                label: t(key),
              }))}
              className="h-9 w-full text-[13px]"
            />
          </div>
        </Field>

        <Field label={t("catalog.nav.org")}>
          <Select
            value={org}
            onValueChange={(value) => setParam("org", value || null)}
            placeholder={t("catalog.nav.orgAny")}
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
            className="h-11 w-full"
          />
        </Field>

        <Field label={t("catalog.nav.bizSize")}>
          <Select
            value={bizSize}
            onValueChange={(value) => setParam("bizSize", value || null)}
            placeholder={t("catalog.nav.bizSizeAny")}
            options={Object.entries(BIZ_SIZE_KEY).map(([k, key]) => ({
              value: k,
              label: t(key),
            }))}
            className="h-11 w-full"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1 overflow-x-auto border-t border-border px-3 py-2">
        <Tab
          active={!category}
          label={t("catalog.nav.tabAll")}
          count={facets?.all}
          onClick={() => setParam("category", null)}
        />
        {CATEGORIES.map((c) => (
          <Tab
            key={c}
            active={category === c}
            label={t(CATEGORY_KEY[c])}
            count={facets?.byCategory?.[c]}
            onClick={() => setParam("category", c)}
          />
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Tab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-3 py-2 text-[14px] font-semibold transition-colors",
        active ? "bg-ink text-white" : "text-muted hover:bg-bg hover:text-ink"
      )}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={cn(
            "num rounded-full px-1.5 py-0.5 text-[11px]",
            active ? "bg-white/20" : "bg-bg"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
