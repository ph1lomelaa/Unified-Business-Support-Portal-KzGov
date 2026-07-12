"use client";

import * as React from "react";
import { Plus, Trash2, Save, Play, Calculator as CalcIcon } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type CalcInput = { name: string; label: string; type: string; default: number; min?: number; max?: number; suffix?: string };
type Calc = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  inputs: CalcInput[];
  formula: string;
  resultLabel: string;
  resultSuffix: string;
  currency: boolean;
  note: string;
  status: string;
};

const ADMIN = "/api/v1/admin/calculators";
const field = "mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink";

export default function AdminCalculatorsPage() {
  const [items, setItems] = React.useState<Calc[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api<Calc[]>(ADMIN)
      .then((rows) => {
        setItems(rows);
        setActiveId((cur) => cur ?? rows[0]?.id ?? null);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ошибка загрузки"));
  }, []);

  React.useEffect(() => load(), [load]);

  const create = async () => {
    try {
      const r = await api<Calc>(ADMIN, {
        method: "POST",
        json: {
          title: "Новый калькулятор",
          inputs: [{ name: "amount", label: "Сумма", type: "number", default: 1000000, min: 0, suffix: "₸" }],
          formula: "amount",
          resultLabel: "Результат",
          resultSuffix: "₸",
        },
      });
      toast.success("Калькулятор создан");
      setActiveId(r.id);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать");
    }
  };

  const active = items.find((c) => c.id === activeId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">Interactive tools</p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">Калькуляторы</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Реальные инструменты из формулы, а не текст. Задайте входные поля и формулу — фронт
            отрендерит рабочий калькулятор. Формула проверяется при сохранении.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={create}>
          <Plus size={16} strokeWidth={1.75} />
          Создать калькулятор
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "w-full rounded-card border p-3 text-left transition-colors",
                c.id === activeId ? "border-brand-green bg-st-green-bg" : "border-border bg-surface hover:border-ink"
              )}
            >
              <p className="text-[13px] font-semibold text-ink">{c.title}</p>
              <p className="mt-1 font-mono text-[12px] text-muted">{c.slug} · {c.status}</p>
            </button>
          ))}
        </div>

        {active && <CalcEditor key={active.id} calc={active} onChanged={load} />}
      </div>
    </div>
  );
}

function CalcEditor({ calc, onChanged }: { calc: Calc; onChanged: () => void }) {
  const [form, setForm] = React.useState<Calc>(calc);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<number | null>(null);
  const set = (patch: Partial<Calc>) => setForm((f) => ({ ...f, ...patch }));

  const setInput = (i: number, patch: Partial<CalcInput>) =>
    setForm((f) => ({ ...f, inputs: f.inputs.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)) }));
  const addInput = () =>
    setForm((f) => ({ ...f, inputs: [...f.inputs, { name: `field${f.inputs.length + 1}`, label: "Поле", type: "number", default: 0 }] }));
  const removeInput = (i: number) => setForm((f) => ({ ...f, inputs: f.inputs.filter((_, idx) => idx !== i) }));

  const body = () => ({
    title: form.title, summary: form.summary, inputs: form.inputs, formula: form.formula,
    resultLabel: form.resultLabel, resultSuffix: form.resultSuffix, currency: form.currency,
    note: form.note, status: form.status,
  });

  const runPreview = async () => {
    try {
      const r = await api<{ result: number }>(`${ADMIN}/preview`, {
        method: "POST",
        json: { formula: form.formula, inputs: form.inputs, values: {} },
      });
      setPreview(r.result);
    } catch (e) {
      setPreview(null);
      toast.error(e instanceof ApiError ? e.message : "Ошибка расчёта");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api(`${ADMIN}/${calc.id}`, { method: "PATCH", json: body() });
      toast.success("Сохранено");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Удалить калькулятор?")) return;
    try {
      await api(`${ADMIN}/${calc.id}`, { method: "DELETE" });
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
            <CalcIcon size={18} strokeWidth={1.75} className="text-brand-green" />
            <CardTitle>{form.title}</CardTitle>
          </div>
          <Button size="sm" variant="ghost" onClick={remove} aria-label="Удалить">
            <Trash2 size={16} strokeWidth={1.75} className="text-st-red" />
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Название</span>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={field} />
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
          <span className="text-[12px] font-medium text-muted">Краткое описание</span>
          <input value={form.summary} onChange={(e) => set({ summary: e.target.value })} className={field} />
        </label>

        {/* Inputs */}
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-ink">Входные поля</p>
          <div className="mt-2 space-y-2">
            {form.inputs.map((inp, i) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1.4fr_90px_90px_80px_auto]">
                <input value={inp.name} onChange={(e) => setInput(i, { name: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase() })}
                  placeholder="name" className="h-9 rounded-control border border-border bg-surface px-2 font-mono text-[12px]" />
                <input value={inp.label} onChange={(e) => setInput(i, { label: e.target.value })}
                  placeholder="подпись" className="h-9 rounded-control border border-border bg-surface px-2 text-[13px]" />
                <input type="number" value={inp.default} onChange={(e) => setInput(i, { default: Number(e.target.value) })}
                  placeholder="по умолч." className="h-9 rounded-control border border-border bg-surface px-2 text-[12px]" />
                <input type="number" value={inp.min ?? ""} onChange={(e) => setInput(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="min" className="h-9 rounded-control border border-border bg-surface px-2 text-[12px]" />
                <input value={inp.suffix ?? ""} onChange={(e) => setInput(i, { suffix: e.target.value })}
                  placeholder="₸/%" className="h-9 rounded-control border border-border bg-surface px-2 text-[12px]" />
                <button onClick={() => removeInput(i)} aria-label="Удалить поле" className="text-muted hover:text-st-red">
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={addInput} className="mt-2">
            <Plus size={15} strokeWidth={1.75} />
            Добавить поле
          </Button>
        </div>

        {/* Formula */}
        <label className="mt-4 block">
          <span className="text-[12px] font-medium text-muted">Формула (над именами полей: + - * / , pow/min/max)</span>
          <textarea value={form.formula} onChange={(e) => set({ formula: e.target.value })} rows={2} spellCheck={false}
            className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] text-brand-green" />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Подпись результата</span>
            <input value={form.resultLabel} onChange={(e) => set({ resultLabel: e.target.value })} className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Суффикс результата</span>
            <input value={form.resultSuffix} onChange={(e) => set({ resultSuffix: e.target.value })} className={field} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-[13px] text-fg">
            <input type="checkbox" checked={form.currency} onChange={(e) => set({ currency: e.target.checked })} />
            деньги (₸)
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-muted">Примечание / дисклеймер</span>
          <input value={form.note} onChange={(e) => set({ note: e.target.value })} className={field} />
        </label>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={runPreview}>
              <Play size={15} strokeWidth={1.75} />
              Проверить расчёт
            </Button>
            {preview != null && (
              <span className="text-[14px] font-semibold text-ink">
                = {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(preview))} {form.resultSuffix}
              </span>
            )}
          </div>
          <Button size="sm" onClick={save} disabled={busy}>
            <Save size={15} strokeWidth={1.75} />
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
