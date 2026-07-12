"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calculator as CalcIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/card";

// Реальный интерактивный калькулятор. Формула по-прежнему считается на сервере
// (единый безопасный движок) и используется как эталон/фолбэк, но для «богатых»
// сценариев (субсидия / кредит / лизинг) виджет строит наглядные плитки и график
// амортизации на клиенте из тех же входных значений — как в референсе.

type Input = {
  name: string;
  label: string;
  type?: "number" | "percent";
  default?: number;
  min?: number;
  max?: number;
  suffix?: string;
};

type CalcConfig = {
  slug: string;
  title: string;
  summary: string;
  inputs: Input[];
  resultLabel: string;
  resultSuffix: string;
  currency: boolean;
  note: string;
  relatedServiceSlugs: string[];
};

const AMBER = "#c2872b"; // «без субсидии» — стоимость по ставке банка
const GREEN = "#0b7a3e"; // «с субсидией» — фирменный зелёный

const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function tenge(value: number): string {
  return `${nf0.format(Math.round(value))} ₸`;
}

/** Аннуитетный ежемесячный платёж. i = годовая ставка / 1200. */
function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const i = annualRatePct / 1200;
  if (i <= 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

type SchedulePoint = { month: number; balance: number; cumInterest: number };

function schedule(principal: number, annualRatePct: number, months: number): {
  payment: number;
  points: SchedulePoint[];
  totalInterest: number;
} {
  const i = annualRatePct / 1200;
  const payment = annuityPayment(principal, annualRatePct, months);
  let balance = principal;
  let cumInterest = 0;
  const points: SchedulePoint[] = [];
  for (let m = 1; m <= months; m += 1) {
    const interest = Math.max(0, balance * i);
    const principalPart = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - principalPart);
    cumInterest += interest;
    points.push({ month: m, balance, cumInterest });
  }
  return { payment, points, totalInterest: cumInterest };
}

type Mode = "subsidy" | "loan" | "leasing" | "generic";

function detectMode(inputs: Input[]): Mode {
  const names = new Set(inputs.map((i) => i.name));
  if (names.has("bank_rate") && names.has("program_rate")) return "subsidy";
  if (names.has("advance")) return "leasing";
  const hasAmount = ["amount", "loan", "cost"].some((n) => names.has(n));
  const hasRate = names.has("rate") || inputs.some((i) => i.type === "percent");
  if (hasAmount && hasRate && names.has("term")) return "loan";
  return "generic";
}

function pickName(inputs: Input[], candidates: string[]): string | null {
  const names = new Set(inputs.map((i) => i.name));
  for (const c of candidates) if (names.has(c)) return c;
  return null;
}

export function CalculatorWidget({ slug }: { slug: string }) {
  const [config, setConfig] = React.useState<CalcConfig | null>(null);
  const [values, setValues] = React.useState<Record<string, number>>({});
  const [serverResult, setServerResult] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<CalcConfig>(`/api/v1/calculators/${slug}`)
      .then((c) => {
        setConfig(c);
        const init: Record<string, number> = {};
        (c.inputs ?? []).forEach((i) => (init[i.name] = Number(i.default ?? 0)));
        setValues(init);
      })
      .catch(() => setError("Не удалось загрузить калькулятор"));
  }, [slug]);

  // Серверный расчёт (эталон формулы) — с дебаунсом.
  React.useEffect(() => {
    if (!config || !Object.keys(values).length) return;
    const t = setTimeout(() => {
      api<{ result: number }>(`/api/v1/calculators/${slug}/compute`, {
        method: "POST",
        json: { values },
      })
        .then((r) => setServerResult(r.result))
        .catch(() => setServerResult(null));
    }, 200);
    return () => clearTimeout(t);
  }, [values, config, slug]);

  const mode = React.useMemo(() => (config ? detectMode(config.inputs ?? []) : "generic"), [config]);

  if (error && !config) {
    return (
      <Card>
        <CardBody>
          <p className="text-[14px] text-muted">{error}</p>
        </CardBody>
      </Card>
    );
  }
  if (!config) {
    return (
      <Card>
        <CardBody>
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton mt-4 h-40 w-full" />
        </CardBody>
      </Card>
    );
  }

  const setValue = (name: string, v: number) => setValues((prev) => ({ ...prev, [name]: v }));
  const applyLink = config.relatedServiceSlugs?.[0]
    ? `/services/${config.relatedServiceSlugs[0]}`
    : "/services";

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
      {/* Шапка калькулятора */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brand-green">
            <CalcIcon size={17} strokeWidth={1.9} />
            <span className="text-[12px] font-bold uppercase tracking-[0.06em]">Калькулятор</span>
          </div>
          <h3 className="mt-1.5 text-[22px] font-bold leading-tight text-ink sm:text-[26px]">
            {config.title}
          </h3>
        </div>
        <Link
          href={applyLink}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-control bg-brand-green px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-green-hover"
        >
          Подать заявку
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Левая колонка — входные параметры */}
        <div className="space-y-5">
          {config.inputs.map((input) => (
            <Field
              key={input.name}
              input={input}
              value={values[input.name] ?? 0}
              onChange={(v) => setValue(input.name, v)}
            />
          ))}
        </div>

        {/* Правая колонка — результат */}
        <div className="min-w-0">
          {mode === "subsidy" ? (
            <SubsidyResult config={config} values={values} />
          ) : mode === "loan" || mode === "leasing" ? (
            <LoanResult config={config} values={values} serverResult={serverResult} mode={mode} />
          ) : (
            <GenericResult config={config} result={serverResult} />
          )}
        </div>
      </div>

      {config.note && (
        <p className="border-t border-border px-5 py-3 text-[12px] leading-relaxed text-muted sm:px-6">
          {config.note}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

function Field({
  input,
  value,
  onChange,
}: {
  input: Input;
  value: number;
  onChange: (v: number) => void;
}) {
  const hasRange = input.min != null && input.max != null;
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const digits = raw.replace(/[^\d.-]/g, "");
    let n = Number(digits);
    if (!Number.isFinite(n)) n = input.min ?? 0;
    if (input.min != null) n = Math.max(input.min, n);
    if (input.max != null) n = Math.min(input.max, n);
    onChange(n);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-medium text-fg">{input.label}</label>
        <span className="num text-[14px] font-bold text-brand-green">
          {nf0.format(value)}
          {input.suffix ? ` ${input.suffix}` : ""}
        </span>
      </div>

      <input
        // текстовый инпут вместо number — без старых «стрелок»-спиннеров
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="mt-2 h-11 w-full rounded-control border border-border bg-bg px-3 text-[15px] font-semibold text-ink outline-none transition-colors focus:border-brand-green focus:bg-surface"
      />

      {hasRange && (
        <input
          type="range"
          min={input.min}
          max={input.max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-3 h-1.5 w-full cursor-pointer accent-brand-green"
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- results */

function ResultTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-card border border-brand-green/30 bg-st-green-bg p-4"
          : "rounded-card border border-border bg-bg p-4"
      }
    >
      <p className="text-[12px] leading-snug text-muted">{label}</p>
      <p className={`num mt-1.5 text-[22px] font-bold leading-none ${accent ? "text-brand-green" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function SubsidyResult({ config, values }: { config: CalcConfig; values: Record<string, number> }) {
  const amountName = pickName(config.inputs, ["loan", "amount", "cost"]) ?? "loan";
  const P = values[amountName] ?? 0;
  const rBank = values.bank_rate ?? 0;
  const rProgram = values.program_rate ?? 0;
  const n = Math.max(1, Math.round(values.term ?? 0));

  const bank = React.useMemo(() => schedule(P, rBank, n), [P, rBank, n]);
  const program = React.useMemo(() => schedule(P, rProgram, n), [P, rProgram, n]);
  const savings = (bank.payment - program.payment) * n;

  const data = React.useMemo(
    () =>
      bank.points.map((pt, idx) => ({
        month: pt.month,
        without: +(pt.cumInterest / 1_000_000).toFixed(3),
        withSub: +((program.points[idx]?.cumInterest ?? 0) / 1_000_000).toFixed(3),
      })),
    [bank, program]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultTile label="Платёж без субсидии" value={tenge(bank.payment)} />
        <ResultTile label="Платёж с субсидией" value={tenge(program.payment)} />
        <ResultTile label="Экономия за срок" value={tenge(savings)} accent />
      </div>

      <p className="text-[14px] leading-relaxed text-fg">
        Экономия <span className="num font-semibold text-brand-green">{tenge(savings)}</span> за {n}{" "}
        {pluralMonths(n)} при снижении ставки с {nf1.format(rBank)}% до {nf1.format(rProgram)}%.
      </p>

      <AmortChart
        data={data}
        series={[
          { key: "without", label: "Платёж без субсидии", color: AMBER },
          { key: "withSub", label: "Платёж с субсидией", color: GREEN },
        ]}
        yLabel="Накопленные проценты, млн ₸"
      />

      <RelatedLinks config={config} />
    </div>
  );
}

function LoanResult({
  config,
  values,
  serverResult,
  mode,
}: {
  config: CalcConfig;
  values: Record<string, number>;
  serverResult: number | null;
  mode: Mode;
}) {
  const amountName = pickName(config.inputs, ["amount", "loan", "cost"]) ?? "amount";
  const rateName = pickName(config.inputs, ["rate"]) ?? "rate";
  const P = values[amountName] ?? 0;
  const advancePct = mode === "leasing" ? values.advance ?? 0 : 0;
  const financed = P * (1 - advancePct / 100);
  const rate = values[rateName] ?? 0;
  const n = Math.max(1, Math.round(values.term ?? 0));

  const s = React.useMemo(() => schedule(financed, rate, n), [financed, rate, n]);
  // серверная формула — эталон ежемесячного платежа (учитывает нюансы, напр. лизинг)
  const monthly = serverResult != null && serverResult > 0 ? serverResult : s.payment;
  const totalPaid = monthly * n;
  const overpay = totalPaid - financed;

  const data = React.useMemo(
    () =>
      s.points.map((pt) => ({
        month: pt.month,
        balance: +(pt.balance / 1_000_000).toFixed(3),
      })),
    [s]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultTile label={config.resultLabel || "Ежемесячный платёж"} value={tenge(monthly)} accent />
        <ResultTile label="Переплата за срок" value={tenge(overpay)} />
        <ResultTile label="Итого к возврату" value={tenge(totalPaid)} />
      </div>

      <p className="text-[14px] leading-relaxed text-fg">
        {n} {pluralMonths(n)} · платёж{" "}
        <span className="num font-semibold text-brand-green">{tenge(monthly)}</span> в месяц.
      </p>

      <AmortChart
        data={data}
        series={[{ key: "balance", label: "Остаток долга", color: GREEN }]}
        yLabel="Остаток долга, млн ₸"
      />

      <RelatedLinks config={config} />
    </div>
  );
}

function GenericResult({ config, result }: { config: CalcConfig; result: number | null }) {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="rounded-card border border-brand-green/30 bg-st-green-bg p-6 text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.03em] text-brand-green">
          {config.resultLabel}
        </p>
        <p className="num mt-2 text-[30px] font-bold leading-tight text-ink">
          {result != null ? `${nf0.format(Math.round(result))} ${config.resultSuffix}`.trim() : "—"}
        </p>
      </div>
      <RelatedLinks config={config} />
    </div>
  );
}

function RelatedLinks({ config }: { config: CalcConfig }) {
  if (!config.relatedServiceSlugs?.length) return null;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4">
      {config.relatedServiceSlugs.map((s) => (
        <Link
          key={s}
          href={`/services/${s}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-green hover:text-brand-green-hover"
        >
          Перейти к услуге
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ chart */

type Series = { key: string; label: string; color: string };

function AmortChart({
  data,
  series,
  yLabel,
}: {
  data: Record<string, number>[];
  series: Series[];
  yLabel: string;
}) {
  return (
    <div className="rounded-card border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-muted">{yLabel}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] text-fg">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e3e6e3" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#6a7276", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#e3e6e3" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "#6a7276", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ stroke: "#9aa2a6", strokeDasharray: "3 3" }}
              content={<ChartTooltip series={series} />}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type TooltipRow = { dataKey?: string | number; value?: number };

function ChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipRow[];
  series: Series[];
}) {
  const { active, label, payload, series } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <p className="font-semibold text-ink">{label} мес.</p>
      {series.map((s) => {
        const row = payload.find((p) => p.dataKey === s.key);
        if (!row) return null;
        return (
          <p key={s.key} style={{ color: s.color }} className="mt-1 font-medium">
            {s.label}: {nf1.format(Number(row.value ?? 0))} млн ₸
          </p>
        );
      })}
    </div>
  );
}

function pluralMonths(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "месяц";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "месяца";
  return "месяцев";
}
