"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { OrgLogo } from "@/components/org-logo";
import { Select } from "@/components/ui/select";

// Аналитический дашборд дочерних компаний: KPI + графики + разрезы по реальным
// агрегатам (проекты по годам / регионам / отраслям / статусам / организациям)
// с интерактивными фильтрами. Считается на клиенте — фильтры мгновенные.

type Project = {
  orgId: string;
  org: string;
  region: string;
  regionId: string;
  industry: string;
  status: string;
  year: number;
  amount: number;
  jobs: number;
};

type MapPayload = {
  projects: Project[];
  filters: { orgs: { id: string; name: string }[]; industries: string[]; years: number[] };
};

type Org = {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string;
  serviceCount: number;
};

const GREEN = "#0b7a3e";
const AMBER = "#c2872b";
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function bln(v: number): number {
  return +(v / 1_000_000_000).toFixed(1);
}

export function AnalyticsDashboard() {
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [payloadFilters, setPayloadFilters] = React.useState<MapPayload["filters"] | null>(null);
  const [orgs, setOrgs] = React.useState<Org[]>([]);

  // Фильтры
  const [region, setRegion] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [year, setYear] = React.useState("");

  React.useEffect(() => {
    api<MapPayload>("/api/v1/map/projects")
      .then((p) => {
        setProjects(p.projects ?? []);
        setPayloadFilters(p.filters ?? null);
      })
      .catch(() => setProjects([]));
    api<Org[]>("/api/v1/organizations")
      .then((rows) => setOrgs(rows.filter((o) => o.id !== "baiterek")))
      .catch(() => setOrgs([]));
  }, []);

  const regionOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (projects ?? []).forEach((p) => {
      if (p.regionId) map.set(p.regionId, p.region);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [projects]);

  const filtered = React.useMemo(() => {
    return (projects ?? []).filter(
      (p) =>
        (!region || p.regionId === region) &&
        (!org || p.orgId === org) &&
        (!industry || p.industry === industry) &&
        (!year || String(p.year) === year)
    );
  }, [projects, region, org, industry, year]);

  const agg = React.useMemo(() => {
    const byYear = new Map<number, number>();
    const byIndustry = new Map<string, number>();
    const byRegion = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byOrg = new Map<string, { count: number; amount: number; jobs: number }>();
    let totalAmount = 0;
    let totalJobs = 0;
    for (const p of filtered) {
      totalAmount += p.amount;
      totalJobs += p.jobs;
      byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.amount);
      byIndustry.set(p.industry, (byIndustry.get(p.industry) ?? 0) + 1);
      byRegion.set(p.region, (byRegion.get(p.region) ?? 0) + p.amount);
      byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
      const o = byOrg.get(p.orgId) ?? { count: 0, amount: 0, jobs: 0 };
      o.count += 1;
      o.amount += p.amount;
      o.jobs += p.jobs;
      byOrg.set(p.orgId, o);
    }
    return {
      totalAmount,
      totalJobs,
      years: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, a]) => ({ name: String(y), amount: bln(a) })),
      industries: [...byIndustry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => ({ name, count })),
      regions: [...byRegion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, a]) => ({ name, amount: bln(a) })),
      statuses: [...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byOrg,
    };
  }, [filtered]);

  const orgRows = React.useMemo(() => {
    const byId = new Map(orgs.map((o) => [o.id, o] as const));
    return [...agg.byOrg.entries()]
      .map(([orgId, v]) => {
        const o = byId.get(orgId);
        return {
          id: orgId,
          name: o?.shortName ?? o?.name ?? orgId,
          fullName: o?.name ?? orgId,
          logo: o?.logo ?? null,
          color: o?.color ?? GREEN,
          ...v,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [agg.byOrg, orgs]);

  const totalServices = orgs.reduce((s, o) => s + (o.serviceCount ?? 0), 0);
  const activeOrgs = orgs.filter((o) => o.serviceCount > 0).length;
  const count = filtered.length;
  const avgAmount = count ? agg.totalAmount / count : 0;
  const avgJobs = count ? agg.totalJobs / count : 0;
  const hasFilter = Boolean(region || org || industry || year);

  const resetFilters = () => {
    setRegion("");
    setOrg("");
    setIndustry("");
    setYear("");
  };

  if (projects === null) {
    return (
      <div className="grid gap-4">
        <div className="skeleton h-11 w-full rounded-card" />
        <div className="skeleton h-24 w-full rounded-card" />
        <div className="skeleton h-72 w-full rounded-card" />
      </div>
    );
  }

  const orgChart = orgRows.slice(0, 8).map((r) => ({ name: r.name, amount: bln(r.amount) }));

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
        <Select value={region} onValueChange={setRegion} placeholder="Все регионы" options={regionOptions} className="h-10 min-w-[180px]" />
        <Select
          value={org}
          onValueChange={setOrg}
          placeholder="Все организации"
          options={(payloadFilters?.orgs ?? []).map((o) => ({ value: o.id, label: o.name }))}
          className="h-10 min-w-[200px]"
        />
        <Select
          value={industry}
          onValueChange={setIndustry}
          placeholder="Все отрасли"
          options={(payloadFilters?.industries ?? []).map((x) => ({ value: x, label: x }))}
          className="h-10 min-w-[180px]"
        />
        <Select
          value={year}
          onValueChange={setYear}
          placeholder="Все годы"
          options={(payloadFilters?.years ?? []).map((x) => ({ value: String(x), label: String(x) }))}
          className="h-10 min-w-[130px]"
        />
        <span className="ml-auto text-[13px] text-muted">
          Найдено: <span className="font-semibold text-ink">{nf.format(count)}</span> проектов
        </span>
        {hasFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[13px] font-medium text-brand-green hover:text-brand-green-hover"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi value={nf.format(count)} label="Проектов" />
        <Kpi value={`${nf.format(Math.round(agg.totalAmount / 1_000_000_000))} млрд ₸`} label="Финансирование" />
        <Kpi value={nf.format(agg.totalJobs)} label="Рабочих мест" />
        <Kpi value={`${nf1.format(avgAmount / 1_000_000)} млн ₸`} label="Средний проект" />
        <Kpi value={nf.format(Math.round(avgJobs))} label="Раб. мест на проект" />
        <Kpi value={`${nf.format(activeOrgs)} · ${nf.format(totalServices)}`} label="Организаций · услуг" />
      </div>

      <p className="text-[12px] text-muted">
        Данные по проектам демонстрационные; количество услуг и организаций — из каталога портала.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Финансирование по годам" subtitle="млрд ₸">
          <VBars data={agg.years} dataKey="amount" color={GREEN} suffix=" млрд ₸" />
        </Panel>
        <Panel title="Топ регионов по финансированию" subtitle="млрд ₸">
          <HBars data={agg.regions} dataKey="amount" color={GREEN} width={132} suffix=" млрд ₸" />
        </Panel>
        <Panel title="Проекты по отраслям" subtitle="количество">
          <HBars data={agg.industries} dataKey="count" color={AMBER} width={150} suffix=" проектов" />
        </Panel>
        <Panel title="Статусы проектов" subtitle="количество">
          <HBars data={agg.statuses} dataKey="count" color={GREEN} width={150} suffix=" проектов" />
        </Panel>
      </div>

      {/* Аналитика дочерних компаний */}
      <Panel title="Аналитика дочерних компаний" subtitle="финансирование проектов, млрд ₸">
        <HBars data={orgChart} dataKey="amount" color={GREEN} width={120} height={280} suffix=" млрд ₸" />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[12px] uppercase tracking-[0.03em] text-muted">
                <th className="py-2 pr-3 font-semibold">Организация</th>
                <th className="py-2 px-3 text-right font-semibold">Проектов</th>
                <th className="py-2 px-3 text-right font-semibold">Финансирование</th>
                <th className="py-2 px-3 text-right font-semibold">Средний проект</th>
                <th className="py-2 pl-3 text-right font-semibold">Раб. места</th>
              </tr>
            </thead>
            <tbody>
              {orgRows.map((r) => (
                <tr key={r.id} className="border-b border-border/70 last:border-b-0">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      <OrgLogo org={{ name: r.fullName, shortName: r.name, logo: r.logo, color: r.color }} size={26} />
                      <span className="font-medium text-fg">{r.name}</span>
                    </span>
                  </td>
                  <td className="num py-2.5 px-3 text-right text-fg">{nf.format(r.count)}</td>
                  <td className="num py-2.5 px-3 text-right font-semibold text-ink">{bln(r.amount)} млрд ₸</td>
                  <td className="num py-2.5 px-3 text-right text-fg">{nf1.format(r.amount / r.count / 1_000_000)} млн ₸</td>
                  <td className="num py-2.5 pl-3 text-right text-fg">{nf.format(r.jobs)}</td>
                </tr>
              ))}
              {orgRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    Нет проектов под выбранные фильтры.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ charts */

function VBars({
  data,
  dataKey,
  color,
  suffix,
}: {
  data: { name: string }[];
  dataKey: string;
  color: string;
  suffix: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#e3e6e3" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#6a7276", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e3e6e3" }} />
          <YAxis tick={{ fill: "#6a7276", fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
          <Tooltip cursor={{ fill: "rgba(11,122,62,0.06)" }} content={<ChartTip suffix={suffix} />} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={46} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HBars({
  data,
  dataKey,
  color,
  width,
  height = 260,
  suffix,
}: {
  data: { name: string }[];
  dataKey: string;
  color: string;
  width: number;
  height?: number;
  suffix: string;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#e3e6e3" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#6a7276", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={width} tick={{ fill: "#3a4145", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(11,122,62,0.06)" }} content={<ChartTip suffix={suffix} />} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TipRow = { value?: number; payload?: { name?: string } };

function ChartTip(props: { active?: boolean; label?: string | number; payload?: TipRow[]; suffix?: string }) {
  const { active, label, payload, suffix = "" } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <p className="font-semibold text-ink">{label ?? row.payload?.name ?? ""}</p>
      <p className="mt-0.5 num text-brand-green">
        {nf1.format(Number(row.value ?? 0))}
        {suffix}
      </p>
    </div>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="num text-[22px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[12px] leading-snug text-muted">{label}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold text-ink">{title}</h3>
        {subtitle && <span className="text-[12px] text-muted">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
