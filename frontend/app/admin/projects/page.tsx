"use client";

import * as React from "react";
import { Plus, Trash2, Save, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Project = {
  id: string; title: string; orgId: string; regionId: string; regionName: string;
  industry: string; status: string; year: number; amount: number; jobs: number;
  lat: number; lon: number; city: string; description: string; url: string;
};
type Facets = {
  orgs: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  industries: string[];
  statuses: string[];
};

const ADMIN = "/api/v1/admin/projects";
const field = "mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink";
const nf = new Intl.NumberFormat("ru-RU");

export default function AdminProjectsPage() {
  const [items, setItems] = React.useState<Project[]>([]);
  const [facets, setFacets] = React.useState<Facets>({ orgs: [], regions: [], industries: [], statuses: [] });
  const [total, setTotal] = React.useState(0);
  const [region, setRegion] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    const qs = region ? `?region=${region}&limit=200` : "?limit=200";
    api<{ items: Project[]; total: number; facets: Facets }>(`${ADMIN}${qs}`)
      .then((d) => {
        setItems(d.items);
        setFacets(d.facets);
        setTotal(d.total);
        setActiveId((cur) => (d.items.some((p) => p.id === cur) ? cur : d.items[0]?.id ?? null));
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ошибка загрузки"));
  }, [region]);

  React.useEffect(() => load(), [load]);

  const create = async () => {
    try {
      const r = await api<Project>(ADMIN, {
        method: "POST",
        json: {
          title: "Новый проект", orgId: facets.orgs[0]?.id ?? "damu",
          regionId: region || facets.regions[0]?.id || "astana",
          industry: facets.industries[0] ?? "Агро", status: facets.statuses[0] ?? "Финансируется",
          year: 2026, amount: 50000000, jobs: 20,
        },
      });
      toast.success("Проект создан");
      setActiveId(r.id);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать");
    }
  };

  const active = items.find((p) => p.id === activeId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">Projects map</p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">Карта проектов</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Профинансированные проекты на карте. Всего в базе: {total}. Редактируется без кода.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-[14px] text-ink">
            <option value="">Все регионы</option>
            {facets.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={create}>
            <Plus size={16} strokeWidth={1.75} />
            Добавить
          </Button>
        </div>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={cn(
                "w-full rounded-card border p-3 text-left transition-colors",
                p.id === activeId ? "border-brand-green bg-st-green-bg" : "border-border bg-surface hover:border-ink"
              )}
            >
              <p className="line-clamp-1 text-[13px] font-semibold text-ink">{p.title}</p>
              <p className="mt-1 text-[12px] text-muted">{p.regionName} · {p.orgId} · {nf.format(p.amount)} ₸</p>
            </button>
          ))}
          {items.length === 0 && <p className="p-3 text-[13px] text-muted">Нет проектов.</p>}
        </div>

        {active && <ProjectEditor key={active.id} project={active} facets={facets} onChanged={load} />}
      </div>
    </div>
  );
}

function ProjectEditor({ project, facets, onChanged }: { project: Project; facets: Facets; onChanged: () => void }) {
  const [form, setForm] = React.useState<Project>(project);
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<Project>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await api(`${ADMIN}/${project.id}`, {
        method: "PATCH",
        json: {
          title: form.title, orgId: form.orgId, regionId: form.regionId, industry: form.industry,
          status: form.status, year: form.year, amount: form.amount, jobs: form.jobs,
          lat: form.lat, lon: form.lon, city: form.city, description: form.description,
        },
      });
      toast.success("Сохранено");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Удалить проект?")) return;
    try {
      await api(`${ADMIN}/${project.id}`, { method: "DELETE" });
      toast.success("Удалено");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось удалить");
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPinned size={18} strokeWidth={1.75} className="text-brand-green" />
            <CardTitle>{form.title}</CardTitle>
          </div>
          <Button size="sm" variant="ghost" onClick={remove} aria-label="Удалить">
            <Trash2 size={16} strokeWidth={1.75} className="text-st-red" />
          </Button>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Название</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Организация</span>
            <select value={form.orgId} onChange={(e) => set({ orgId: e.target.value })} className={field}>
              {facets.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Регион</span>
            <select value={form.regionId} onChange={(e) => set({ regionId: e.target.value })} className={field}>
              {facets.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Отрасль</span>
            <select value={form.industry} onChange={(e) => set({ industry: e.target.value })} className={field}>
              {facets.industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Статус</span>
            <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={field}>
              {facets.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Год</span>
            <input type="number" value={form.year} onChange={(e) => set({ year: Number(e.target.value) })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Сумма, ₸</span>
            <input type="number" value={form.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Рабочих мест</span>
            <input type="number" value={form.jobs} onChange={(e) => set({ jobs: Number(e.target.value) })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Широта</span>
            <input type="number" step="0.0001" value={form.lat} onChange={(e) => set({ lat: Number(e.target.value) })} className={cn(field, "font-mono text-[13px]")} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Долгота</span>
            <input type="number" step="0.0001" value={form.lon} onChange={(e) => set({ lon: Number(e.target.value) })} className={cn(field, "font-mono text-[13px]")} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Город</span>
            <input value={form.city} onChange={(e) => set({ city: e.target.value })} className={field} />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Описание</span>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2}
            className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-[14px] text-ink" />
        </label>

        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={save} disabled={busy}>
            <Save size={15} strokeWidth={1.75} />
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
