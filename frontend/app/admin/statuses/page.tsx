"use client";

import * as React from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Transition = { id: string; flow: string; toKey: string };
type Status = {
  key: string; label: string; color: string; who: string | null; sla: number | null;
  commentRequired: boolean; terminal: boolean; sortOrder: number; next: Transition[];
};
type Payload = { statuses: Status[]; flows: string[]; colors: string[] };

const ADMIN = "/api/v1/admin/statuses";

const COLOR_CLASS: Record<string, string> = {
  gray: "bg-st-gray-bg text-muted",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-gold/10 text-gold",
  green: "bg-st-green-bg text-brand-green",
  red: "bg-st-red/10 text-st-red",
};

export default function AdminStatusesPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [flow, setFlow] = React.useState("default");
  const [error, setError] = React.useState<string | null>(null);
  const [newKey, setNewKey] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");

  const load = React.useCallback(() => {
    api<Payload>(ADMIN)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ошибка загрузки"));
  }, []);

  React.useEffect(() => load(), [load]);

  const createStatus = async () => {
    if (!newKey.trim() || !newLabel.trim()) { toast.error("Заполните ключ и подпись"); return; }
    try {
      const d = await api<Payload>(ADMIN, { method: "POST", json: { key: newKey.trim(), label: newLabel.trim(), color: "gray" } });
      setData(d); setNewKey(""); setNewLabel("");
      toast.success("Статус создан");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать");
    }
  };

  if (error) return <ErrorBanner className="mt-6" message={error} onRetry={load} />;
  if (!data) return <p className="mt-6 text-muted">Загрузка…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">Workflow config</p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">Статусы и маршруты</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Статусы заявки, их метки/цвета/SLA и переходы настраиваются без кода. Изменения
            сразу применяются к рабочему процессу заявок. Разные услуги могут использовать разные маршруты.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Маршрут:
          <select value={flow} onChange={(e) => setFlow(e.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-[14px] text-ink">
            {data.flows.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>

      <Card className="mt-6 border-brand-green/40">
        <CardBody>
          <div className="grid items-end gap-3 sm:grid-cols-[200px_1fr_auto]">
            <label className="block">
              <span className="text-[12px] font-medium text-muted">Ключ (латиницей)</span>
              <input value={newKey} onChange={(e) => setNewKey(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
                placeholder="on_hold" className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px]" />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-muted">Подпись</span>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Приостановлена" className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px]" />
            </label>
            <Button size="sm" onClick={createStatus}><Plus size={16} strokeWidth={1.75} />Добавить статус</Button>
          </div>
        </CardBody>
      </Card>

      <div className="mt-5 space-y-3">
        {data.statuses.map((s) => (
          <StatusRow key={s.key} status={s} data={data} flow={flow} onData={setData} />
        ))}
      </div>
    </div>
  );
}

function StatusRow({ status, data, flow, onData }: { status: Status; data: Payload; flow: string; onData: (p: Payload) => void }) {
  const [label, setLabel] = React.useState(status.label);
  const [color, setColor] = React.useState(status.color);
  const [sla, setSla] = React.useState<string>(status.sla != null ? String(status.sla) : "");
  const [commentRequired, setCommentRequired] = React.useState(status.commentRequired);
  const [terminal, setTerminal] = React.useState(status.terminal);
  const [addTo, setAddTo] = React.useState("");

  const flowTransitions = status.next.filter((t) => t.flow === flow);

  const save = async () => {
    try {
      const d = await api<Payload>(`${ADMIN}/${status.key}`, {
        method: "PATCH",
        json: { label, color, sla: sla === "" ? null : Number(sla), commentRequired, terminal },
      });
      onData(d);
      toast.success("Сохранено");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const remove = async () => {
    if (!confirm(`Удалить статус «${status.label}» и связанные переходы?`)) return;
    try {
      const d = await api<Payload>(`${ADMIN}/${status.key}`, { method: "DELETE" });
      onData(d);
      toast.success("Удалено");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось удалить");
    }
  };

  const addTransition = async () => {
    if (!addTo) return;
    try {
      const d = await api<Payload>(`${ADMIN}/transitions`, { method: "POST", json: { flow, fromKey: status.key, toKey: addTo } });
      onData(d); setAddTo("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось добавить переход");
    }
  };

  const removeTransition = async (id: string) => {
    try {
      const d = await api<Payload>(`${ADMIN}/transitions/${id}`, { method: "DELETE" });
      onData(d);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const inp = "h-9 rounded-control border border-border bg-surface px-2 text-[13px] text-ink";
  const labelOf = (key: string) => data.statuses.find((s) => s.key === key)?.label ?? key;

  return (
    <Card>
      <CardBody>
        <div className="grid items-center gap-3 lg:grid-cols-[160px_1fr_120px_90px_auto]">
          <span className={cn("inline-flex items-center justify-center rounded-control px-2 py-1 font-mono text-[12px]", COLOR_CLASS[color] ?? COLOR_CLASS.gray)}>
            {status.key}
          </span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={cn(inp, "w-full")} />
          <select value={color} onChange={(e) => setColor(e.target.value)} className={inp}>
            {data.colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={sla} onChange={(e) => setSla(e.target.value.replace(/[^0-9]/g, ""))} placeholder="SLA дн" className={cn(inp, "w-full")} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={save} aria-label="Сохранить"><Save size={14} /></Button>
            <button onClick={remove} aria-label="Удалить" className="text-muted hover:text-st-red"><Trash2 size={16} strokeWidth={1.75} /></button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
          <label className="flex items-center gap-1.5 text-fg">
            <input type="checkbox" checked={commentRequired} onChange={(e) => setCommentRequired(e.target.checked)} /> нужен комментарий
          </label>
          <label className="flex items-center gap-1.5 text-fg">
            <input type="checkbox" checked={terminal} onChange={(e) => setTerminal(e.target.checked)} /> терминальный
          </label>
        </div>

        {/* Transitions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted">Переходы:</span>
          {flowTransitions.map((t) => (
            <span key={t.id} className="inline-flex items-center rounded-control border border-border bg-bg px-2 py-1 text-[12px] text-ink">
              {labelOf(t.toKey)}
              <button onClick={() => removeTransition(t.id)} aria-label="Убрать" className="ml-1 text-muted hover:text-st-red">×</button>
            </span>
          ))}
          {flowTransitions.length === 0 && !terminal && <span className="text-[12px] text-muted">нет</span>}
          {!terminal && (
            <span className="inline-flex items-center gap-1">
              <select value={addTo} onChange={(e) => setAddTo(e.target.value)} className="h-8 rounded-control border border-border bg-surface px-2 text-[12px]">
                <option value="">+ добавить…</option>
                {data.statuses.filter((s) => s.key !== status.key).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              {addTo && <Button size="sm" variant="ghost" onClick={addTransition}>ОК</Button>}
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
