"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw } from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";

type Analytics = {
  weekly: { week: string; byOrg: Record<string, number> }[];
  orgs: { id: string; shortName: string }[];
  topServices: { title: string; count: number; org: string }[];
  funnel: { created: number; submitted: number; approved: number };
  regions: { region: string; count: number; bar: number }[];
  avgDaysByOrg: { org: string; orgId: string; days: number }[];
};

const COLORS = ["#0b7a3e", "#121517", "#b89758", "#6A7276", "#A32D2D", "#8A9094"];

export default function AdminAnalyticsPage() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState(365);
  const [org, setOrg] = React.useState("");
  const [data, setData] = React.useState<Analytics | null>(null);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams({ period: String(period) });
    if (org) qs.set("org", org);
    setData(await api<Analytics>(`/api/v1/admin/analytics?${qs}`));
  }, [period, org]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const weekly = (data?.weekly ?? []).map((row) => ({
    week: row.week.slice(5),
    ...row.byOrg,
  }));
  const csvUrl = `${API_BASE}/api/v1/admin/analytics.csv?period=${period}${
    org ? `&org=${org}` : ""
  }`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[30px] font-bold uppercase tracking-[-0.01em] text-ink">{t("admin.analytics.title")}</h1>
            <Link
              href="/sources"
              className="inline-flex items-center rounded-control border border-st-amber-bg bg-st-amber-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-st-amber hover:border-st-amber"
            >
              Демо-данные
            </Link>
          </div>
          <p className="mt-1 max-w-2xl text-[14px] text-muted">
            {t("admin.analytics.sub")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={org}
            onValueChange={setOrg}
            placeholder={t("admin.analytics.org.all")}
            options={(data?.orgs ?? []).map((o) => ({ value: o.id, label: o.shortName }))}
            ariaLabel={t("catalog.filters.org")}
          />
          <Select
            value={String(period)}
            onValueChange={(value) => setPeriod(Number(value || 365))}
            placeholder={t("admin.analytics.period")}
            options={[
              { value: "30", label: t("admin.analytics.30") },
              { value: "90", label: t("admin.analytics.90") },
              { value: "365", label: t("admin.analytics.year") },
            ]}
            ariaLabel={t("admin.analytics.period")}
          />
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={18} strokeWidth={1.75} />
            {t("admin.analytics.refresh")}
          </Button>
          <Button asChild>
            <a href={csvUrl}>
              <Download size={18} strokeWidth={1.75} />
              CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={t("admin.analytics.created")} value={data?.funnel.created ?? 0} />
        <Kpi label={t("admin.analytics.submitted")} value={data?.funnel.submitted ?? 0} />
        <Kpi label={t("admin.analytics.approved")} value={data?.funnel.approved ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title={t("admin.analytics.weekly")}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              {(data?.orgs ?? []).map((o, i) => (
                <Line
                  key={o.id}
                  type="monotone"
                  dataKey={o.id}
                  name={o.shortName}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("admin.analytics.top")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.topServices ?? []} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="title" type="category" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#121517" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("admin.analytics.regions")}>
          <div className="space-y-3">
            {(data?.regions ?? []).map((r) => (
              <div key={r.region}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span>{r.region}</span>
                  <span className="num font-medium">{r.count}</span>
                </div>
                <div className="h-2 rounded-full bg-st-gray-bg">
                  <div
                    className="h-2 rounded-full bg-ink"
                    style={{ width: `${r.bar}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title={t("admin.analytics.avg")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.avgDaysByOrg ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="org" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="days" name={t("common.workDays")} fill="#121517" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="mt-2 text-[28px] font-semibold text-ink num">{value}</p>
      </CardBody>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <CardTitle>{title}</CardTitle>
        <div className="mt-4">{children}</div>
      </CardBody>
    </Card>
  );
}
