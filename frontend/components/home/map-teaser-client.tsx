"use client";

import * as React from "react";
import Link from "next/link";
import { CircleMarker, GeoJSON, MapContainer, Pane, Popup, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Region = {
  id: string;
  name: string;
  center: [number, number];
  geoIso?: string | null;
  count: number;
  amount: number;
  jobs: number;
};

type Project = {
  id: string;
  title: string;
  org: string;
  regionId: string;
  amount: number;
  jobs: number;
  lat: number;
  lon: number;
};

type Payload = { regions: Region[]; projects: Project[] };

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

const KZ_BOUNDS: LatLngBoundsExpression = [
  [40.5, 46.5],
  [55.5, 87.5],
];

function FitKazakhstan() {
  const map = useMap();
  React.useEffect(() => {
    // Пересобираем размер и вписываем страну заново на КАЖДОЕ изменение размера
    // контейнера. Иначе при монтировании через dynamic() Leaflet мерит контейнер
    // до раскладки grid → низкий зум и «пустая» карта с маленьким Казахстаном.
    const fit = () => {
      map.invalidateSize(false);
      map.fitBounds(KZ_BOUNDS, { padding: [0, 0] });
    };
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    fit();
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(() => fit());
    ro.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

export function MapTeaserClient() {
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [geoJson, setGeoJson] = React.useState<Adm1GeoJson | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api<Payload>("/api/v1/map/projects")
      .then((payload) => {
        setRegions(payload.regions ?? []);
        setProjects(payload.projects ?? []);
      })
      .catch(() => {
        setRegions([]);
        setProjects([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetch("/data/kaz-adm1.geojson")
      .then((r) => r.json())
      .then((payload: Adm1GeoJson) => setGeoJson(payload))
      .catch(() => setGeoJson(null));
  }, []);

  const max = Math.max(1, ...regions.map((r) => r.count));
  const totalAmount = projects.reduce((s, p) => s + p.amount, 0);
  const totalJobs = projects.reduce((s, p) => s + p.jobs, 0);
  const regionByIso = new Map(
    regions.map((r) => [r.geoIso, r]).filter(([iso]) => Boolean(iso)) as [
      string,
      Region,
    ][]
  );

  return (
    <div className="space-y-4">
      <div className="relative z-0 isolate overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border bg-[#F8FAF7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-ink">
                Интерактивная карта профинансированных проектов
              </p>
              <DemoDataBadge />
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Цвет региона показывает концентрацию проектов, маркеры — отдельные кейсы.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MapStat value={loading ? "..." : projects.length.toLocaleString("ru-RU")} label="проектов" />
            <MapStat value={loading ? "..." : `${Math.round(totalAmount / 1_000_000_000)} млрд ₸`} label="финансирование" />
            <MapStat value={loading ? "..." : totalJobs.toLocaleString("ru-RU")} label="раб. мест" />
          </div>
        </div>
        <div className="relative bg-[#EAF1EE]">
          <div className="pointer-events-none absolute inset-0 z-[1] opacity-70 [background-image:linear-gradient(rgba(18,21,23,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(18,21,23,0.035)_1px,transparent_1px)] [background-size:32px_32px]" />
        <MapContainer
          center={[48, 67.5] as LatLngExpression}
          zoom={4}
          zoomSnap={0}
          zoomControl={false}
          attributionControl={false}
          className="relative z-0 aspect-[16/9] max-h-[680px] min-h-[240px] w-full sm:min-h-[420px]"
          style={{ background: "transparent" }}
        >
          <FitKazakhstan />
          {geoJson?.features.map((feature) => {
            const region = regionByIso.get(feature.properties.shapeISO);
            const density = region ? region.count / max : 0;
            return (
              <GeoJSON
                key={feature.properties.shapeISO}
                data={feature}
                style={{
                  color: "#ffffff",
                  weight: 1.25,
                  fillColor: region ? fillColor(density) : "#E9ECEA",
                  fillOpacity: 1,
                }}
              >
                <Tooltip sticky>
                  {region
                    ? `${region.name}: ${region.count} проектов`
                    : feature.properties.shapeName}
                </Tooltip>
              </GeoJSON>
            );
          })}
          <Pane name="project-markers" style={{ zIndex: 650 }}>
            {projects.map((project) => (
              <CircleMarker
                key={project.id}
                center={[project.lat, project.lon]}
                radius={6.5}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#C7972E",
                  fillOpacity: 0.96,
                  opacity: 1,
                  weight: 2.25,
                }}
              >
                <Popup>
                  <strong>{project.title}</strong>
                  <br />
                  {project.org} · {project.amount.toLocaleString("ru-RU")} ₸
                </Popup>
              </CircleMarker>
            ))}
          </Pane>
        </MapContainer>
        </div>
        <ChoroplethLegend />
      </div>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/map">Открыть карту проектов</Link>
        </Button>
      </div>
    </div>
  );
}

function MapStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[96px] rounded-control border border-border bg-white px-3 py-2 text-left shadow-[0_8px_20px_rgba(18,21,23,0.04)]">
      <p className="num text-[16px] font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.03em] text-muted">{label}</p>
    </div>
  );
}

function DemoDataBadge() {
  return (
    <Link
      href="/sources"
      className="group relative inline-flex shrink-0 items-center rounded-control border border-st-amber-bg bg-st-amber-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.03em] text-st-amber hover:border-st-amber"
    >
      Демо-данные
      <span className="pointer-events-none absolute left-0 top-full z-[1000] mt-2 hidden w-[300px] rounded-control border border-border bg-white p-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-fg shadow-[var(--shadow-pop)] group-hover:block">
        В демо-версии проекты карты имитируют подключение к ИС Аналитического центра через ЕИШ.
      </span>
    </Link>
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
            {CHORO_RAMP.map((color) => (
              <span key={color} className="block h-3 w-6" style={{ background: color }} />
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
          <span className="inline-block size-3 rounded-[3px]" style={{ background: "#E9ECEA" }} />
          нет данных
        </span>
      </div>
      <span className="text-[11px] text-muted">geoBoundaries KAZ ADM1 · ODbL</span>
    </div>
  );
}

// Та же секвенциальная шкала, что и на полной карте (ColorBrewer YlGnBu,
// magnitude, светлый→тёмный, многотоновая и различима при дальтонизме).
const CHORO_RAMP = ["#C7E9B4", "#7FCDBB", "#41B6C4", "#1D91C0", "#225EA8"];
const CHORO_BREAKS = [0.12, 0.3, 0.55, 0.8];

function fillColor(v: number) {
  let i = 0;
  while (i < CHORO_BREAKS.length && v > CHORO_BREAKS[i]) i += 1;
  return CHORO_RAMP[i];
}
