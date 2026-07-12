"use client";

import * as React from "react";
import { Plus, Trash2, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  orgId: string;
  type: string;
  title: string;
  description: string;
  source: string;
  period: string;
  updated: string;
  url: string;
  embedUrl: string | null;
  sortOrder: number;
  status: string;
};
type Facets = { orgs: { id: string; name: string; short: string }[]; types: { id: string; label: string }[] };

const ADMIN = "/api/v1/admin/reports";

export default function AdminReportsPage() {
  const [items, setItems] = React.useState<Report[]>([]);
  const [facets, setFacets] = React.useState<Facets>({ orgs: [], types: [] });
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api<{ items: Report[] } & Facets>(ADMIN)
      .then((d) => {
        setItems(d.items);
        setFacets({ orgs: d.orgs, types: d.types });
        setActiveId((cur) => cur ?? d.items[0]?.id ?? null);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ошибка загрузки"));
  }, []);

  React.useEffect(() => load(), [load]);

  const create = async () => {
    try {
      const r = await api<Report>(ADMIN, {
        method: "POST",
        json: { title: "Новый материал", orgId: facets.orgs[0]?.id ?? "baiterek", type: "review" },
      });
      toast.success("Материал создан");
      setActiveId(r.id);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать");
    }
  };

  const active = items.find((r) => r.id === activeId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">Analytics catalog</p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">Аналитика дочерних компаний</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Каталог аналитических материалов и отчётов дочерних организаций. Редактируется без кода.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={create}>
          <Plus size={16} strokeWidth={1.75} />
          Добавить материал
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {items.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={cn(
                "w-full rounded-card border p-3 text-left transition-colors",
                r.id === activeId ? "border-brand-green bg-st-green-bg" : "border-border bg-surface hover:border-ink"
              )}
            >
              <p className="line-clamp-2 text-[13px] font-semibold text-ink">{r.title}</p>
              <p className="mt-1 text-[12px] text-muted">
                {r.orgId} · {r.type} · {r.status}
              </p>
            </button>
          ))}
        </div>

        {active && (
          <ReportEditor key={active.id} report={active} facets={facets} onChanged={load} />
        )}
      </div>
    </div>
  );
}

function ReportEditor({ report, facets, onChanged }: { report: Report; facets: Facets; onChanged: () => void }) {
  const [form, setForm] = React.useState(report);
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<Report>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await api(`${ADMIN}/${report.id}`, {
        method: "PATCH",
        json: {
          title: form.title, orgId: form.orgId, type: form.type, description: form.description,
          source: form.source, period: form.period, updated: form.updated, url: form.url,
          status: form.status, sortOrder: form.sortOrder,
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
    if (!confirm("Удалить материал?")) return;
    try {
      await api(`${ADMIN}/${report.id}`, { method: "DELETE" });
      toast.success("Удалено");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось удалить");
    }
  };

  const field = "mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink";

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Материал</CardTitle>
          <div className="flex gap-2">
            {form.url && (
              <a href={form.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-control border border-border px-3 text-[13px] text-brand-green hover:border-brand-green">
                <ExternalLink size={14} /> Открыть
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={remove} aria-label="Удалить">
              <Trash2 size={16} strokeWidth={1.75} className="text-st-red" />
            </Button>
          </div>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Заголовок</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Организация</span>
            <select value={form.orgId} onChange={(e) => set({ orgId: e.target.value })} className={field}>
              {facets.orgs.map((o) => <option key={o.id} value={o.id}>{o.short}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Тип</span>
            <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={field}>
              {facets.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Статус</span>
            <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={field}>
              <option value="published">опубликован</option>
              <option value="draft">черновик</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Описание</span>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3}
            className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-[14px] text-ink" />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Источник</span>
            <input value={form.source} onChange={(e) => set({ source: e.target.value })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Период актуальности</span>
            <input value={form.period} onChange={(e) => set({ period: e.target.value })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Обновлено</span>
            <input value={form.updated} onChange={(e) => set({ updated: e.target.value })} placeholder="2026-07-11" className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Порядок</span>
            <input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} className={field} />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Ссылка (URL)</span>
          <input value={form.url} onChange={(e) => set({ url: e.target.value })} className={cn(field, "font-mono text-[13px]")} />
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
