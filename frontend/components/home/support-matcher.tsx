"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  CircleAlert,
  Landmark,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ServiceCard } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OrgMonogram } from "@/components/org-monogram";
import { cn } from "@/lib/utils";

type MatcherState = {
  region: string;
  bin: string;
  industry: string;
  amount: string;
  category: string;
  bizSize: string;
};

type MatchResult = {
  service: ServiceCard;
  score: number;
  verdict: "fit" | "possible" | "check";
  reasons: string[];
  checks: string[];
};

const CATEGORY_TABS = [
  { value: "", label: "Все меры" },
  { value: "subsidy", label: "Субсидии" },
  { value: "guarantee", label: "Гарантии" },
  { value: "credit", label: "Кредитование" },
  { value: "leasing", label: "Лизинг" },
  { value: "insurance", label: "Экспорт" },
  { value: "investment", label: "Инвестиции" },
];

const INDUSTRIES = [
  { value: "", label: "Выбрать" },
  { value: "agro", label: "Агро / животноводство" },
  { value: "manufacturing", label: "Производство" },
  { value: "trade", label: "Торговля" },
  { value: "services", label: "Услуги" },
];

const BIZ_SIZES = [
  { value: "", label: "Не указано" },
  { value: "micro", label: "Микро" },
  { value: "small", label: "Малый" },
  { value: "medium", label: "Средний" },
  { value: "large", label: "Крупный" },
];

const REGIONS = [
  "Астана",
  "Алматы",
  "Шымкент",
  "Акмолинская область",
  "Алматинская область",
  "Карагандинская область",
  "Костанайская область",
  "Туркестанская область",
];

const DEFAULT_STATE: MatcherState = {
  region: "Костанайская область",
  bin: "123456789012",
  industry: "agro",
  amount: "50000000",
  category: "",
  bizSize: "small",
};

export function SupportMatcher() {
  const [services, setServices] = React.useState<ServiceCard[]>([]);
  const [state, setState] = React.useState<MatcherState>(DEFAULT_STATE);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api<ServiceCard[]>("/api/v1/services")
      .then(setServices)
      .finally(() => setLoading(false));
  }, []);

  const results = React.useMemo(
    () => services.map((service) => scoreService(service, state)).sort((a, b) => b.score - a.score),
    [services, state]
  );
  const visible = results
    .filter((item) => (state.category ? item.service.category === state.category : true))
    .slice(0, 4);

  return (
    <div id="support-matcher" className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Search size={20} strokeWidth={1.75} className="text-ink" />
          <div>
            <h2 className="text-[18px] font-semibold uppercase tracking-[0.01em] text-ink">
              Навигатор мер поддержки
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Быстрая сверка по параметрам бизнеса, без длинной анкеты.
            </p>
          </div>
        </div>
        <button
          onClick={() => setState(DEFAULT_STATE)}
          className="h-9 rounded-control border border-border px-3 text-[13px] font-medium text-muted hover:border-ink hover:text-ink"
        >
          Сбросить
        </button>
      </div>

      <div className="mt-5 rounded-card border border-border p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Picker
            icon={<MapPin />}
            label="Регион"
            value={state.region}
            options={REGIONS.map((region) => ({ value: region, label: region }))}
            onChange={(region) => setState((current) => ({ ...current, region }))}
          />
          <Field
            icon={<Building2 />}
            label="Ваш БИН / ИИН"
            value={state.bin}
            onChange={(bin) => setState((current) => ({ ...current, bin }))}
          />
          <Picker
            icon={<Landmark />}
            label="Ваша деятельность"
            value={state.industry}
            options={INDUSTRIES}
            onChange={(industry) => setState((current) => ({ ...current, industry }))}
          />
          <Field
            icon={<SlidersHorizontal />}
            label="Сумма финансирования"
            value={state.amount}
            onChange={(amount) =>
              setState((current) => ({ ...current, amount: amount.replace(/[^\d]/g, "") }))
            }
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
          <Picker
            icon={<Building2 />}
            label="Размер бизнеса"
            value={state.bizSize}
            options={BIZ_SIZES}
            onChange={(bizSize) => setState((current) => ({ ...current, bizSize }))}
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                onClick={() => setState((current) => ({ ...current, category: tab.value }))}
                className={cn(
                  "h-10 rounded-control border px-3 text-[13px] font-semibold transition-colors",
                  state.category === tab.value
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-bg text-muted hover:border-ink hover:text-ink"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
            {loading ? "Загружаем меры" : `Найдено ${visible.length} подходящих`}
          </p>
          <Link href="/services" className="text-[13px] font-medium text-ink underline underline-offset-2">
            Весь каталог
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-card border border-border p-5">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton mt-3 h-3 w-full" />
                <div className="skeleton mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((item) => (
              <MatchCard key={item.service.id} result={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="flex min-h-[64px] items-center gap-3 rounded-control border border-border bg-bg px-3">
      {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number; className?: string }>, {
        size: 20,
        strokeWidth: 1.75,
        className: "text-muted",
      })}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        <Input
          value={formatFieldValue(label, value)}
          onChange={(event) => onChange(event.target.value)}
          className="mt-0 h-7 truncate border-0 bg-transparent px-0 text-[14px] font-semibold focus-visible:outline-0"
        />
      </span>
    </Label>
  );
}

function Picker({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Label className="flex min-h-[64px] items-center gap-3 rounded-control border border-border bg-bg px-3">
      {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number; className?: string }>, {
        size: 20,
        strokeWidth: 1.75,
        className: "text-muted",
      })}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        <Select
          value={value}
          onValueChange={onChange}
          placeholder={options.find((option) => option.value === "")?.label ?? "Выбрать"}
          ariaLabel={label}
          options={options.filter((option) => option.value !== "")}
          className="mt-1 h-9 w-full min-w-0 border-0 bg-transparent px-0 font-semibold shadow-none hover:border-0"
        />
      </span>
    </Label>
  );
}

function MatchCard({ result }: { result: MatchResult }) {
  const { service, score, verdict, reasons, checks } = result;
  const tone =
    verdict === "fit"
      ? "border-st-green/40 bg-st-green-bg/40 text-st-green"
      : verdict === "possible"
        ? "border-st-amber/40 bg-st-amber-bg/50 text-st-amber"
        : "border-border bg-bg text-muted";
  return (
    <div className="flex min-h-[310px] flex-col rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <OrgMonogram name={service.org?.name ?? "?"} color={service.org?.color} size={40} />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-muted">{service.org?.shortName}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[17px] font-semibold text-ink">
              {service.title}
            </h3>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-control border px-2 py-1 text-[12px] font-semibold", tone)}>
          {score}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3">
        {(service.conditions ?? []).slice(0, 2).map((condition) => (
          <div key={`${condition.label}-${condition.value}`}>
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted">{condition.label}</p>
            <p className="num mt-1 text-[18px] font-semibold text-ink">{condition.value}</p>
          </div>
        ))}
        {(service.conditions ?? []).length === 0 && (
          <p className="col-span-2 text-[13px] text-muted">Условия уточняются по источнику</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {reasons.slice(0, 3).map((reason) => (
          <p key={reason} className="flex gap-2 text-[13px] text-ink">
            <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-st-green" />
            {reason}
          </p>
        ))}
        {checks.slice(0, 2).map((check) => (
          <p key={check} className="flex gap-2 text-[13px] text-muted">
            <CircleAlert size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-st-amber" />
            {check}
          </p>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="rounded-control bg-bg px-2 py-1 text-[12px] font-medium text-muted">
          {CATEGORY_LABEL[service.category] ?? service.category}
        </span>
        <Button asChild size="sm">
          <Link href={`/services/${service.slug}`}>Проверить</Link>
        </Button>
      </div>
    </div>
  );
}

function scoreService(service: ServiceCard, state: MatcherState): MatchResult {
  let score = 42;
  const reasons: string[] = [];
  const checks: string[] = [];
  const tags = service.tags ?? {};

  if (!state.category || service.category === state.category) {
    score += 16;
    if (state.category) reasons.push(`Категория: ${CATEGORY_LABEL[service.category] ?? service.category}`);
  }
  if (state.industry && (tags.industries ?? []).includes(state.industry)) {
    score += 18;
    reasons.push("Отрасль совпадает с условиями программы");
  } else if (state.industry) {
    checks.push("Нужно сверить отрасль и ОКЭД с правилами программы");
  }
  if (state.bizSize && (tags.bizSize ?? []).includes(state.bizSize)) {
    score += 14;
    reasons.push("Размер бизнеса входит в целевую группу");
  } else if (state.bizSize) {
    checks.push("Размер бизнеса может требовать альтернативную меру");
  }
  if (!tags.regions?.length || tags.regions.includes(state.region)) {
    score += 6;
    reasons.push("Регион не ограничивает участие");
  }

  const amount = Number(state.amount || 0);
  const amountCheck = inferAmountFit(service, amount);
  if (amountCheck === "fit") {
    score += 10;
    reasons.push("Запрошенная сумма выглядит в пределах лимитов");
  } else if (amountCheck === "check") {
    checks.push("Лимит суммы нужно подтвердить по карточке услуги");
  } else {
    score -= 12;
    checks.push("Сумма может выходить за лимит программы");
  }

  if (state.bin.length === 12) {
    score += 4;
    reasons.push("БИН готов для автозаполнения данных компании");
  }

  const clipped = Math.max(35, Math.min(96, score));
  return {
    service,
    score: clipped,
    verdict: clipped >= 78 ? "fit" : clipped >= 58 ? "possible" : "check",
    reasons: reasons.length ? reasons : ["Мера близка по общим параметрам запроса"],
    checks: checks.length ? checks : ["Финальное решение зависит от документов и проверки оператора"],
  };
}

function inferAmountFit(service: ServiceCard, amount: number): "fit" | "check" | "miss" {
  if (!amount) return "check";
  const text = `${service.title} ${service.summary} ${(service.conditions ?? [])
    .map((item) => `${item.label} ${item.value}`)
    .join(" ")}`.toLowerCase();
  if (text.includes("1,5 млрд") || text.includes("1.5 млрд")) return amount <= 1_500_000_000 ? "fit" : "miss";
  if (text.includes("7 млрд")) return amount <= 7_000_000_000 ? "fit" : "miss";
  if (text.includes("1 млрд")) return amount <= 1_000_000_000 ? "fit" : "miss";
  if (text.includes("от 7 млрд")) return amount >= 7_000_000_000 ? "fit" : "miss";
  return "check";
}

function formatFieldValue(label: string, value: string) {
  if (!label.toLowerCase().includes("сумма")) return value;
  const numeric = Number(value || 0);
  return numeric ? numeric.toLocaleString("ru-RU").replace(/\u00a0/g, " ") : "";
}
