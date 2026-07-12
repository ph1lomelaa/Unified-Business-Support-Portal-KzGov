"use client";

import * as React from "react";
import Link from "next/link";
import { CircleMarker, GeoJSON, MapContainer, Pane, Popup, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression, LeafletMouseEvent, PathOptions } from "leaflet";
import { Database, ExternalLink, FileText, Network, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useI18n } from "@/i18n/provider";
import { Select } from "@/components/ui/select";

type Project = {
  id: string;
  title: string;
  orgId: string;
  org: string;
  region: string;
  regionId: string;
  city: string;
  industry: string;
  status: string;
  year: number;
  amount: number;
  jobs: number;
  lat: number | null;
  lon: number | null;
  description: string;
  url: string;
};

type Region = {
  id: string;
  name: string;
  center: [number, number];
  geoIso?: string | null;
  count: number;
  amount: number;
  jobs: number;
  topIndustries: [string, number][];
  msb?: MsbContext;
};

type MsbContext = {
  value: number;
  label: string;
  source: string;
  sourceName: string;
  sourceUrl: string;
  datasetIndex: string;
  version: string;
  updatedAt: string;
};

type Payload = {
  regions: Region[];
  projects: Project[];
  filters: {
    orgs: { id: string; name: string }[];
    industries: string[];
    years: number[];
    statuses: string[];
  };
};

type RegionFeature = {
  type: "Feature";
  properties: { shapeName: string; shapeISO: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type Adm1GeoJson = {
  type: "FeatureCollection";
  features: RegionFeature[];
};

// Bounding box for Kazakhstan (lat/lon), with a small padded outer limit so
// the choropleth fills the container on load and users can't pan/zoom the
// country out of view.
const KZ_BOUNDS: LatLngBoundsExpression = [
  [40.5, 46.5],
  [55.5, 87.5],
];
const KZ_MAX_BOUNDS: LatLngBoundsExpression = [
  [36, 38],
  [60, 96],
];

function FitKazakhstan() {
  const map = useMap();
  React.useEffect(() => {
    const fit = () => {
      // Recompute per current container size so the country fills the
      // container at every breakpoint, not just the one it mounted at.
      map.invalidateSize(false);
      map.fitBounds(KZ_BOUNDS, { padding: [0, 0] });
    };
    fit();
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(() => fit());
    ro.observe(map.getContainer());
    map.setMaxBounds(KZ_MAX_BOUNDS);
    map.on("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.off("resize", fit);
    };
  }, [map]);
  return null;
}

export function ProjectMap() {
  const { t } = useI18n();
  const [data, setData] = React.useState<Payload | null>(null);
  const [geoJson, setGeoJson] = React.useState<Adm1GeoJson | null>(null);
  const [org, setOrg] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [year, setYear] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [selected, setSelected] = React.useState<Project | null>(null);
  const [region, setRegion] = React.useState<Region | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams();
    if (org) qs.set("org", org);
    if (industry) qs.set("industry", industry);
    if (year) qs.set("year", year);
    if (status) qs.set("status", status);
    try {
      const payload = await api<Payload>(`/api/v1/map/projects?${qs}`);
      setData(payload);
      setSelected((current) =>
        current && payload.projects.some((project) => project.id === current.id)
          ? current
          : null
      );
      setError(null);
      setRegion((prev) => {
        const stillExists = prev ? payload.regions.find((r) => r.id === prev.id) : undefined;
        if (stillExists) return stillExists;
        const top = [...payload.regions].sort((a, b) => b.count - a.count)[0];
        return top ?? null;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Неизвестная ошибка");
    }
  }, [org, industry, year, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    fetch("/data/kaz-adm1.geojson")
      .then((r) => r.json())
      .then((payload: Adm1GeoJson) => setGeoJson(payload))
      .catch(() => setGeoJson(null));
  }, []);

  const regions = data?.regions ?? [];
  const projects = data?.projects ?? [];
  const max = Math.max(1, ...regions.map((r) => r.count));
  const regionByIso = new Map(regions.map((r) => [r.geoIso, r]).filter(([iso]) => Boolean(iso)) as [string, Region][]);
  const totalAmount = projects.reduce((s, p) => s + p.amount, 0);
  const totalJobs = projects.reduce((s, p) => s + p.jobs, 0);
  const hasFilters = Boolean(org || industry || year || status);

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <div className="space-y-5">
        <div className="relative z-0 isolate overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap gap-2 border-b border-border p-3">
            <Select
              value={org}
              onValueChange={setOrg}
              placeholder={t("map.filters.org")}
              options={(data?.filters.orgs ?? []).map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              value={industry}
              onValueChange={setIndustry}
              placeholder={t("map.filters.industry")}
              options={(data?.filters.industries ?? []).map((x) => ({ value: x, label: x }))}
            />
            <Select
              value={year}
              onValueChange={setYear}
              placeholder={t("map.filters.year")}
              options={(data?.filters.years ?? []).map((x) => ({ value: String(x), label: String(x) }))}
            />
            <Select
              value={status}
              onValueChange={setStatus}
              placeholder={t("map.filters.status")}
              options={(data?.filters.statuses ?? []).map((x) => ({ value: x, label: x }))}
            />
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setOrg(""); setIndustry(""); setYear(""); setStatus(""); }}
                className="h-10 rounded-control px-3 text-[13px] font-medium text-brand-green hover:bg-st-green-bg focus-visible:outline-2 focus-visible:outline-brand-green"
              >
                {t("map.filters.reset")}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 border-b border-border bg-[#F8FAF7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[15px] font-semibold text-ink">Интерактивная карта профинансированных проектов</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                Цвет региона показывает концентрацию проектов, маркеры — отдельные кейсы.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MapStat value={projects.length.toLocaleString("ru-RU")} label="проектов" />
              <MapStat value={`${Math.round(totalAmount / 1_000_000_000)} млрд ₸`} label="финансирование" />
              <MapStat value={totalJobs.toLocaleString("ru-RU")} label="раб. мест" />
            </div>
          </div>
          <div className="relative bg-[#EAF1EE]">
            <div className="pointer-events-none absolute inset-0 z-[1] opacity-70 [background-image:linear-gradient(rgba(18,21,23,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(18,21,23,0.035)_1px,transparent_1px)] [background-size:32px_32px]" />
            <MapContainer
              center={[48.0, 67.5] as LatLngExpression}
              zoom={5}
              zoomSnap={0}
              scrollWheelZoom
              maxBoundsViscosity={1.0}
              zoomControl={false}
              attributionControl={false}
              className="relative z-0 aspect-[16/9] max-h-[680px] min-h-[420px] w-full"
              style={{ background: "transparent" }}
            >
              <FitKazakhstan />
              {geoJson?.features.map((feature) => {
                const r = regionByIso.get(feature.properties.shapeISO);
                const density = r ? r.count / max : 0;
                const isSelected = Boolean(r && region?.id === r.id);
                const isDimmed = Boolean(region && r && region.id !== r.id);
                const style = regionStyle(density, Boolean(r), isSelected, isDimmed);
                return (
                  <GeoJSON
                    key={feature.properties.shapeISO}
                    data={feature}
                    eventHandlers={{
                      click: () => {
                        if (r) {
                          setRegion(r);
                          setSelected(null);
                        }
                      },
                      mouseover: (event: LeafletMouseEvent) => {
                        event.target.setStyle({
                          color: "#16332A",
                          fillOpacity: 1,
                          weight: isSelected ? 3 : 2.25,
                        });
                      },
                      mouseout: (event: LeafletMouseEvent) => {
                        event.target.setStyle(style);
                      },
                    }}
                    style={style}
                  >
                    <Tooltip sticky>
                      {r ? `${r.name}: ${r.count} ${t("map.summary.count").toLowerCase()}` : feature.properties.shapeName}
                    </Tooltip>
                  </GeoJSON>
                );
              })}
              <Pane name="project-markers" style={{ zIndex: 650 }}>
                {projects.filter((p) => p.lat !== null && p.lon !== null).map((p) => {
                  const isSelected = selected?.id === p.id;
                  return (
                    <CircleMarker
                      key={p.id}
                      center={[p.lat!, p.lon!]}
                      radius={isSelected ? 8 : 6.5}
                      pathOptions={{
                        color: "#ffffff",
                        fillColor: "#C7972E",
                        fillOpacity: isSelected ? 1 : 0.96,
                        opacity: 1,
                        weight: isSelected ? 3 : 2.25,
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelected(p);
                          setRegion(regions.find((r) => r.id === p.regionId) ?? null);
                        },
                      }}
                    >
                      <Popup>
                        <strong>{p.title}</strong>
                        <br />
                        {p.org} · {p.amount.toLocaleString("ru-RU")} ₸
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </Pane>
            </MapContainer>
          </div>
          <ChoroplethLegend />
        </div>

        <div className="space-y-3">
          {/* Итоги по выборке — надписью сверху, не отдельной колонкой */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">
                {t("map.summary.title")}
              </span>
              <SummaryInline label={t("map.summary.count")} value={projects.length.toLocaleString("ru-RU")} />
              <SummaryInline label={t("map.summary.amount")} value={`${Math.round(totalAmount / 1_000_000_000)} млрд ₸`} />
              <SummaryInline label={t("map.summary.jobs")} value={totalJobs.toLocaleString("ru-RU")} />
            </div>
            <DemoDataBadge />
          </div>

          {selected ? (
            <Card>
              <CardBody>
                <CardTitle>{selected.title}</CardTitle>
                <dl className="mt-4 space-y-2 text-[14px]">
                  <Info label={t("map.field.org")} value={selected.org} />
                  <Info label={t("map.field.region")} value={selected.region} />
                  <Info label={t("map.field.industry")} value={selected.industry} />
                  <Info label={t("map.field.amount")} value={`${selected.amount.toLocaleString("ru-RU")} ₸`} />
                  <Info label={t("map.field.period")} value={String(selected.year)} />
                  <Info label={t("map.field.status")} value={selected.status} />
                </dl>
                <p className="mt-4 text-[13px] text-muted">{selected.description}</p>
              </CardBody>
            </Card>
          ) : region ? (
            <RegionCard region={region} projects={projects.filter((p) => p.regionId === region.id).slice(0, 5)} />
          ) : (
            <Card>
              <CardBody>
                <CardTitle>{t("map.empty.title")}</CardTitle>
                <p className="mt-2 text-[14px] text-muted">{t("map.empty.hint")}</p>
              </CardBody>
            </Card>
          )}

          {/* Повтор итогов снизу — надписью */}
          <p className="text-[12px] leading-relaxed text-muted">
            Всего по выборке: {projects.length.toLocaleString("ru-RU")} проектов ·{" "}
            {Math.round(totalAmount / 1_000_000_000)} млрд ₸ финансирования ·{" "}
            {totalJobs.toLocaleString("ru-RU")} рабочих мест. Данные демонстрационные.
          </p>
        </div>
      </div>
      <DataSources />
      <ProductionFlow />
    </div>
  );
}

// Секвенциальная шкала «мало → много проектов» (magnitude → монотонная
// светлота, светлый→тёмный). ColorBrewer YlGnBu: зелёный→бирюзовый→синий —
// многотоновая, но НЕ «радуга» (светлота убывает монотонно). Стандарт для
// государственных статистических картограмм, различима при дальтонизме
// (соседние классы ΔE 19 — проверено валидатором dataviz). Синий на тёмном
// конце перекликается с национальным цветом.
const CHORO_RAMP = ["#C7E9B4", "#7FCDBB", "#41B6C4", "#1D91C0", "#225EA8"];
const CHORO_NO_DATA = "#E9ECEA";
// Границы классов по доле от максимума (count / max).
const CHORO_BREAKS = [0.12, 0.3, 0.55, 0.8];

function choroClass(v: number): number {
  let i = 0;
  while (i < CHORO_BREAKS.length && v > CHORO_BREAKS[i]) i += 1;
  return i;
}

function fillColor(v: number) {
  return CHORO_RAMP[choroClass(v)];
}

function regionStyle(density: number, hasData: boolean, isSelected: boolean, isDimmed: boolean): PathOptions {
  return {
    color: isSelected ? "#16332A" : "#ffffff",
    dashArray: isSelected ? "" : undefined,
    fillColor: hasData ? fillColor(density) : CHORO_NO_DATA,
    fillOpacity: isDimmed ? 0.46 : 0.98,
    opacity: isDimmed ? 0.7 : 1,
    weight: isSelected ? 2.75 : 1.25,
  };
}

function MapStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[96px] rounded-control border border-border bg-white px-3 py-2 text-left shadow-[0_8px_20px_rgba(18,21,23,0.04)]">
      <p className="text-[16px] font-semibold leading-none text-ink num">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.03em] text-muted">{label}</p>
    </div>
  );
}

function ChoroplethLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[11px] font-medium text-muted">Проектов в регионе:</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">меньше</span>
          <span className="flex overflow-hidden rounded-[3px] ring-1 ring-border">
            {CHORO_RAMP.map((c) => (
              <span key={c} className="block h-3 w-6" style={{ background: c }} />
            ))}
          </span>
          <span className="text-[11px] text-muted">больше</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="inline-block size-3 rounded-full ring-2 ring-white"
            style={{ background: "#C7972E", boxShadow: "0 0 0 1px #cfd4d1" }}
          />
          проект
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="inline-block size-3 rounded-[3px]"
            style={{ background: CHORO_NO_DATA }}
          />
          нет данных
        </span>
      </div>
      <span className="text-[11px] text-muted">geoBoundaries KAZ ADM1 · ODbL</span>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-bg p-3">
      <p className="text-[18px] font-semibold text-ink num">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function SummaryInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="num text-[18px] font-bold text-ink">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}

function RegionCard({ region, projects }: { region: Region; projects: Project[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{region.name}</CardTitle>
          <DemoDataBadge />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <SmallMetric label={t("map.summary.count")} value={String(region.count)} />
          <SmallMetric label={t("map.summary.amount")} value={`${Math.round(region.amount / 1_000_000_000)} млрд`} />
          <SmallMetric label={t("map.summary.jobs")} value={String(region.jobs)} />
        </div>
        {region.msb && (
          <div className="mt-4 rounded-control border border-border bg-bg p-3">
            <p className="text-[12px] text-muted">Субъектов МСБ в регионе</p>
            <p className="mt-0.5 text-[20px] font-semibold text-ink num">
              {region.msb.value.toLocaleString("ru-RU")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {region.msb.label}. Источник:{" "}
              <a href={region.msb.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
                {region.msb.source}
              </a>
              , {region.msb.sourceName}, {region.msb.version}, обновлено {region.msb.updatedAt}.
            </p>
          </div>
        )}
        <div className="mt-4">
          <p className="text-[13px] font-medium text-fg">{t("map.topIndustries")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {region.topIndustries.map(([name, count]) => (
              <span key={name} className="rounded-control bg-bg px-2.5 py-1 text-[12px] text-ink ring-1 ring-border">
                {name}: {count}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="rounded-control border border-border p-3 text-[13px]">
              <p className="font-medium text-fg">{p.title}</p>
              <p className="mt-1 text-muted">{p.org} · {p.amount.toLocaleString("ru-RU")} ₸</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function DemoDataBadge() {
  return (
    <Link href="/sources" className="group relative inline-flex shrink-0 items-center rounded-control border border-st-amber-bg bg-st-amber-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-st-amber hover:border-st-amber">
      Демо-данные
      <span className="pointer-events-none absolute right-0 top-full z-[1000] mt-2 hidden w-[320px] rounded-control border border-border bg-white p-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-fg shadow-[var(--shadow-pop)] group-hover:block">
        Финансовые данные по конкретным проектам являются коммерческой тайной
        заёмщиков и не публикуются ни одной организацией группы. Раздел
        демонстрирует архитектуру карты; в боевом контуре данные поступают из
        ИС Аналитического центра Холдинга по защищённому каналу.
      </span>
    </Link>
  );
}

function DataSources() {
  const sources = [
    {
      title: "Границы регионов",
      text: "geoBoundaries KAZ ADM1, лицензия Open Database License.",
      href: "https://www.geoboundaries.org/",
    },
    {
      title: "Проекты и финансовые показатели",
      text: "Демонстрационный набор данных ЕППБ для показа архитектуры карты.",
    },
    {
      title: "Контекст МСБ по регионам",
      text: "Официальная статистика по субъектам малого и среднего предпринимательства.",
      href: "https://stat.gov.kz/",
    },
  ];

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <FileText size={19} strokeWidth={1.75} className="text-brand-green" />
              <h2 className="text-[16px] font-semibold text-ink">Источники данных и методология</h2>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Цвет региона отражает количество проектов в выбранной фильтрации.
              Маркеры показывают отдельные проекты, а итоги справа пересчитываются
              после выбора ДО, отрасли или года.
            </p>
          </div>
          <div className="rounded-control border border-st-amber-bg bg-[#FFF8E8] px-3 py-2 text-[12px] leading-relaxed text-st-amber">
            Финансовые данные по конкретным проектам в демо-версии синтетические.
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {sources.map((source) => (
            <div key={source.title} className="rounded-control border border-border bg-bg p-4">
              <p className="text-[13px] font-semibold text-ink">{source.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{source.text}</p>
              {source.href && (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-green hover:text-brand-green-hover"
                >
                  Открыть источник
                  <ExternalLink size={13} strokeWidth={1.8} />
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-control border border-border bg-white p-4">
          <div className="flex items-start gap-3">
            <Database size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-green" />
            <p className="text-[12px] leading-relaxed text-muted">
              В боевом контуре карта подключается к ИС Аналитического центра
              Холдинга и системам дочерних организаций через защищённый канал.
              Публикация открытых витрин должна учитывать коммерческую тайну
              заёмщиков и правила обезличивания.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ProductionFlow() {
  const steps = [
    { icon: Database, title: "ИС Аналитического центра", text: "Витрина проектов, сумм, статусов и отраслей" },
    { icon: Network, title: "Единая интеграционная шина", text: "Защищённая доставка и журнал обмена" },
    { icon: ShieldCheck, title: "ЕППБ", text: "Карта, аналитика и кабинет с ролевым доступом" },
  ];
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-[16px] font-semibold text-ink">Как это будет работать в проде</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-control border border-border bg-bg p-4">
              <Icon size={22} strokeWidth={1.75} className="text-brand-green" />
              <p className="mt-3 text-[13px] font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{step.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
