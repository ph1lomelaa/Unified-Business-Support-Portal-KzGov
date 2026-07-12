"use client";

import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, FileText, GraduationCap, ListChecks, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { KnowledgeCard, KnowledgeType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DictKey } from "@/i18n/dictionaries";

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  template: FileText,
  checklist: ListChecks,
  article: GraduationCap,
  guide: GraduationCap,
};

const TAB_KEY: Record<string, DictKey> = {
  all: "knowledge.tabs.all",
  article: "knowledge.tabs.article",
  checklist: "knowledge.tabs.checklist",
  template: "knowledge.tabs.template",
  guide: "knowledge.tabs.guide",
};

const TYPE_LABEL_KEY: Record<string, DictKey> = {
  article: "knowledge.type.article",
  checklist: "knowledge.type.checklist",
  template: "knowledge.type.template",
  guide: "knowledge.type.guide",
};

const TABS: Array<KnowledgeType | "all"> = ["all", "article", "checklist", "template", "guide"];

type CalcResult = {
  paymentNoSubsidy: number;
  paymentSubsidy: number;
  economy: number;
  economySimple: number;
  series: { month: number; overpayNoSubsidy: number; overpaySubsidy: number }[];
};

export default function KnowledgePage() {
  const { t } = useI18n();
  const [items, setItems] = React.useState<KnowledgeCard[]>([]);
  const [itemsError, setItemsError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [tab, setTab] = React.useState<KnowledgeType | "all">("all");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    setItemsError(null);
    const qs = new URLSearchParams();
    if (tab !== "all") qs.set("type", tab);
    if (query.trim()) qs.set("q", query.trim());
    const id = window.setTimeout(() => {
      api<{ items: KnowledgeCard[] }>(`/api/v1/knowledge?${qs.toString()}`)
        .then((r) => setItems(r.items))
        .catch((err) => setItemsError(err instanceof ApiError ? err.message : "Неизвестная ошибка"));
    }, 150);
    return () => window.clearTimeout(id);
  }, [tab, query, reloadKey]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-brand-green">
          {t("knowledge.kicker")}
        </p>
        <h1 className="mt-3 text-[40px] font-bold uppercase tracking-[0.02em] text-ink">{t("knowledge.title")}</h1>
        <p className="mt-3 text-[16px] text-muted">{t("knowledge.sub")}</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 overflow-x-auto rounded-control border border-border bg-surface p-1">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-control px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
                tab === k ? "bg-ink text-white" : "text-muted hover:bg-bg hover:text-ink"
              )}
            >
              {t(TAB_KEY[k])}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-[280px]">
          <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("knowledge.search.placeholder")}
            className="pl-9"
          />
        </div>
      </div>

      {itemsError && (
        <ErrorBanner className="mt-6" message={itemsError} onRetry={() => setReloadKey((k) => k + 1)} />
      )}

      {!itemsError && items.length === 0 && (
        <p className="mt-8 text-[14px] text-muted">{t("knowledge.empty")}</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = TYPE_ICON[item.type] ?? GraduationCap;
          return (
            <Link key={item.id} href={`/knowledge/${item.slug}`}>
              <Card hover className="flex h-full flex-col">
                <CardBody className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-control bg-bg text-ink ring-1 ring-border">
                      <Icon size={20} />
                    </div>
                    <span className="rounded-control bg-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted">
                      {t(TYPE_LABEL_KEY[item.type] ?? "knowledge.type.article")}
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-[16px]">{item.title}</CardTitle>
                  <p className="mt-2 flex-1 text-[13px] text-muted">{item.summary}</p>
                  <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted">
                    <span className="num">
                      {item.readMinutes} {t("knowledge.card.minutes")}
                    </span>
                  </p>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-10">
        <SubsidyCalculator />
      </div>
    </div>
  );
}

function SubsidyCalculator() {
  const { t } = useI18n();
  const [amount, setAmount] = React.useState(80_000_000);
  const [bankRate, setBankRate] = React.useState(19);
  const [programRate, setProgramRate] = React.useState(7);
  const [months, setMonths] = React.useState(60);
  const [result, setResult] = React.useState<CalcResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(true);

  React.useEffect(() => {
    setPending(true);
    const id = window.setTimeout(() => {
      api<CalcResult>("/api/v1/knowledge/subsidy-calc", {
        method: "POST",
        json: { amount, bankRate, programRate, months },
      })
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Неизвестная ошибка"))
        .finally(() => setPending(false));
    }, 150);
    return () => window.clearTimeout(id);
  }, [amount, bankRate, programRate, months]);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <Calculator size={22} strokeWidth={1.75} />
              <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-brand-green">{t("knowledge.calc.kicker")}</span>
            </div>
            <h2 className="mt-2 text-[24px] font-semibold text-ink">
              {t("knowledge.calc.title")}
            </h2>
          </div>
          <Button asChild>
            <Link href="/services/damu-subsidy">{t("knowledge.calc.apply")}</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <NumberField label={t("knowledge.calc.amount")} value={amount} min={1_000_000} max={500_000_000} step={1_000_000} onChange={setAmount} />
            <NumberField label={t("knowledge.calc.bankRate")} value={bankRate} min={8} max={25} step={0.5} onChange={setBankRate} />
            <NumberField label={t("knowledge.calc.programRate")} value={programRate} min={5} max={9} step={0.5} onChange={setProgramRate} />
            <NumberField label={t("knowledge.calc.months")} value={months} min={12} max={84} step={12} onChange={setMonths} />
          </div>

          <div>
            {error ? (
              <ErrorBanner
                message={error}
                onRetry={() => {
                  setError(null);
                  setPending(true);
                  api<CalcResult>("/api/v1/knowledge/subsidy-calc", {
                    method: "POST",
                    json: { amount, bankRate, programRate, months },
                  })
                    .then((r) => setResult(r))
                    .catch((err) => setError(err instanceof ApiError ? err.message : "Неизвестная ошибка"))
                    .finally(() => setPending(false));
                }}
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Metric label={t("knowledge.calc.noSubsidy")} value={result?.paymentNoSubsidy} loading={pending} />
                  <Metric label={t("knowledge.calc.withSubsidy")} value={result?.paymentSubsidy} loading={pending} />
                  <Metric label={t("knowledge.calc.economy")} value={result?.economy} loading={pending} accent />
                </div>
                <p className="num mt-3 text-[14px] text-fg">
                  {result
                    ? t("knowledge.calc.caption")
                        .replace("{economy}", result.economy.toLocaleString("ru-RU"))
                        .replace("{months}", String(months))
                        .replace("{bankRate}", String(bankRate))
                        .replace("{programRate}", String(programRate))
                    : " "}
                </p>
                <div className="mt-6 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result?.series ?? []} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => (Number(v) / 1_000_000).toLocaleString("ru-RU")}
                        label={{ value: "млн ₸", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#6A7276" } }}
                      />
                      <Tooltip
                        formatter={(v) => `${(Number(v) / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₸`}
                        labelFormatter={(m) => `${m} ${t("knowledge.calc.month")}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Area type="monotone" dataKey="overpayNoSubsidy" name={t("knowledge.calc.noSubsidy")} stroke="#b89758" fill="#f5ead8" />
                      <Area type="monotone" dataKey="overpaySubsidy" name={t("knowledge.calc.withSubsidy")} stroke="#0b7a3e" fill="#dcefe4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Link
                  href="/knowledge/subsidy-vs-guarantee"
                  className="mt-4 inline-block text-[13px] font-medium text-brand-green underline underline-offset-2 hover:text-brand-green-hover"
                >
                  {t("knowledge.calc.readMore")}
                </Link>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-control border p-4 ${accent ? "border-brand-green/35 bg-brand-green/10" : "border-border bg-bg"}`}>
      <p className="text-[12px] text-muted">{label}</p>
      {value === undefined ? (
        <p className="mt-1 h-[24px] w-20 animate-pulse rounded bg-border" aria-label={loading ? "Загрузка" : undefined} />
      ) : (
        <p className={`mt-1 text-[20px] font-semibold num ${accent ? "text-brand-green" : "text-ink"}`}>
          {value.toLocaleString("ru-RU")} ₸
        </p>
      )}
    </div>
  );
}
