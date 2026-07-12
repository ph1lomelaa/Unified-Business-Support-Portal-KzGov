"use client";

import * as React from "react";
import { CalendarDays, ExternalLink, Maximize2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { MultiSelect } from "@/components/ui/multi-select";
import { OrgLogo } from "@/components/org-logo";
import { AnalyticsDashboard } from "@/components/reports/analytics-dashboard";
import { useI18n } from "@/i18n/provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ReportItem = {
  id: string;
  org: string;
  type: string;
  title: string;
  description: string;
  source: string;
  period: string;
  updated: string;
  url: string;
  embedUrl?: string | null;
  orgName: string;
  orgShort: string;
  orgColor: string;
  orgLogo: string | null;
  typeLabel: string;
};

type ReportOrg = {
  id: string;
  shortName: string;
  name: string;
  logo: string | null;
  color: string;
};

type ReportsResp = {
  items: ReportItem[];
  orgs: ReportOrg[];
  types: { id: string; label: string }[];
  total: number;
};

export default function ReportsPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState<ReportsResp | null>(null);
  const [orgsSelected, setOrgsSelected] = React.useState<string[]>([]);
  const [typesSelected, setTypesSelected] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [embedded, setEmbedded] = React.useState<ReportItem | null>(null);

  const load = React.useCallback(() => {
    api<ReportsResp>("/api/v1/reports")
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((requestError) => setError(
        requestError instanceof ApiError ? requestError.message : "Неизвестная ошибка"
      ));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const orgs = data?.orgs ?? [];
  const types = data?.types ?? [];
  const items = React.useMemo(
    () => (data?.items ?? []).filter((item) =>
      (orgsSelected.length === 0 || orgsSelected.includes(item.org))
      && (typesSelected.length === 0 || typesSelected.includes(item.type))
    ),
    [data, orgsSelected, typesSelected]
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <p className="font-display text-[13px] font-semibold uppercase text-ink">
          {t("reports.kicker")}
        </p>
        <h1 className="mt-3 font-display text-[40px] font-bold uppercase text-ink">
          {t("reports.title")}
        </h1>
        <p className="mt-3 text-[16px] text-muted">{t("reports.sub")}</p>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      {/* Настоящий дашборд аналитики (KPI + графики), а не только каталог ссылок */}
      <div className="mt-8">
        <AnalyticsDashboard />
      </div>

      <div className="mt-14 border-t border-border pt-8">
        <h2 className="text-[24px] font-bold text-ink">Материалы и отчёты</h2>
        <p className="mt-1 max-w-2xl text-[14px] text-muted">
          Готовые аналитические порталы, финансовая и годовая отчётность, исследования и дашборды
          дочерних организаций Холдинга.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3 border-y border-border py-4">
        <FilterSelect label={t("reports.filters.org")}>
          <MultiSelect
            values={orgsSelected}
            onValuesChange={setOrgsSelected}
            placeholder="Все организации"
            className="w-full sm:w-[440px]"
            options={orgs.map((org) => ({
              value: org.id,
              label: org.name,
              org: {
                name: org.name,
                shortName: org.shortName,
                logo: org.logo,
                color: org.color,
              },
            }))}
          />
        </FilterSelect>
        <FilterSelect label={t("reports.filters.type")}>
          <MultiSelect
            values={typesSelected}
            onValuesChange={setTypesSelected}
            placeholder="Все типы материалов"
            className="w-full sm:w-[250px]"
            options={types.map((type) => ({ value: type.id, label: type.label }))}
          />
        </FilterSelect>
        <span className="pb-2 text-[13px] text-muted">Найдено: {items.length}</span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          return (
            <Card key={item.id} hover className="flex flex-col">
              <CardBody className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <OrgLogo
                      org={{
                        name: item.orgName,
                        shortName: item.orgShort,
                        color: item.orgColor,
                        logo: item.orgLogo,
                      }}
                      size={38}
                    />
                    <span className="text-[12px] font-medium leading-4 text-fg">
                      {item.orgName}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-control bg-bg px-2 py-1 text-[11px] font-medium text-muted">
                    {item.typeLabel}
                  </span>
                </div>

                <CardTitle className="mt-4 text-[16px]">{item.title}</CardTitle>
                <p className="mt-2 flex-1 text-[13px] leading-5 text-muted">
                  {item.description}
                </p>

                <dl className="mt-4 space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("reports.source")}</dt>
                    <dd className="max-w-[70%] text-right font-medium text-fg">{item.source}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("reports.period")}</dt>
                    <dd className="text-right font-medium text-fg">{item.period}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="inline-flex items-center gap-1 text-muted">
                      <CalendarDays size={13} /> Обновлено
                    </dt>
                    <dd className="text-right font-medium text-fg">{formatIsoDate(item.updated)}</dd>
                  </div>
                </dl>

                <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} strokeWidth={1.75} />
                    {t("reports.open")}
                  </a>
                </Button>
                {item.embedUrl && (
                  <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setEmbedded(item)}>
                    <Maximize2 size={16} /> {t("reports.embed")}
                  </Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && data && (
        <p className="mt-10 rounded-card border border-dashed border-border py-12 text-center text-[14px] text-muted">
          {t("reports.empty")}
        </p>
      )}

      <Dialog open={Boolean(embedded)} onOpenChange={(open) => !open && setEmbedded(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>{embedded?.title}</DialogTitle></DialogHeader>
          {embedded?.embedUrl && (
            <iframe title={embedded.title} src={embedded.embedUrl} className="h-[70vh] w-full rounded-control border border-border" />
          )}
          <p className="mt-2 text-[12px] text-muted">
            {t("reports.embedFallback")}
          </p>
          {embedded && <Button asChild variant="outline"><a href={embedded.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />{t("reports.openSource")}</a></Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function FilterSelect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid max-w-full gap-1.5">
      <span className="text-[11px] font-semibold uppercase text-muted">{label}</span>
      {children}
    </label>
  );
}
