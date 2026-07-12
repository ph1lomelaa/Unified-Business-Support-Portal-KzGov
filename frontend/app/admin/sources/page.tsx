"use client";

import * as React from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  PlugZap,
  PlayCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Source = {
  id: string;
  name: string;
  baseUrl: string;
  kind: string;
  adapterType: string;
  status: string;
  scheduleCron: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  runnable: boolean;
  scheduled: boolean;
};

type TestResult = {
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  contentType: string | null;
  robotsAllowed: boolean | null;
  crawlDelay: number | null;
  error: string | null;
};

type Payload = { sources: Source[]; adapterTypes: string[]; kinds: string[] };

const ADMIN = "/api/v1/admin/sources";
const STATUSES = ["ready", "degraded", "blocked", "planned"];

const STATUS_CLASS: Record<string, string> = {
  ready: "border-brand-green/40 bg-st-green-bg text-brand-green",
  degraded: "border-gold/40 bg-gold/10 text-gold",
  blocked: "border-st-red/40 bg-st-red/10 text-st-red",
  planned: "border-border bg-bg text-muted",
};

const KIND_LABEL: Record<string, string> = {
  service_registry: "Реестр услуг",
  subsidiary_site: "Сайт дочки",
  open_data: "Открытые данные",
};

export default function AdminSourcesPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    api<Payload>(ADMIN)
      .then((p) => {
        setData(p);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить источники"));
  }, []);

  React.useEffect(() => load(), [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">
            External data sources
          </p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">
            Источники
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Внешние источники услуг и новостей: адрес, тип адаптера, расписание и статус —
            всё настраивается без кода. «Проверить» делает реальный запрос к сайту и robots.txt;
            разбор карточек — в разделе «Импорт из источников».
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink"
          >
            <RefreshCw size={16} strokeWidth={1.75} />
            Обновить
          </button>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={1.75} />
            Добавить источник
          </Button>
        </div>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      {creating && data && (
        <CreateSourceCard
          adapterTypes={data.adapterTypes}
          kinds={data.kinds}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      <div className="mt-6 space-y-4">
        {data?.sources.map((s) => (
          <SourceCard key={s.id} source={s} adapterTypes={data.adapterTypes} kinds={data.kinds} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function CreateSourceCard({
  adapterTypes,
  kinds,
  onCancel,
  onCreated,
}: {
  adapterTypes: string[];
  kinds: string[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("https://");
  const [kind, setKind] = React.useState(kinds[0] ?? "subsidiary_site");
  const [adapterType, setAdapterType] = React.useState(adapterTypes[0] ?? "html_scrape");
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error("Заполните название и адрес");
      return;
    }
    setBusy(true);
    try {
      await api(ADMIN, { method: "POST", json: { name: name.trim(), baseUrl: baseUrl.trim(), kind, adapterType } });
      toast.success("Источник добавлен");
      onCreated();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось добавить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6 border-brand-green/40">
      <CardBody>
        <CardTitle>Новый источник</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Название</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Сайт дочерней организации"
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Адрес (baseUrl)</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.kz"
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Тип источника</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Адаптер</span>
            <select
              value={adapterType}
              onChange={(e) => setAdapterType(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {adapterTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button size="sm" onClick={create} disabled={busy}>
            {busy ? "Добавляем…" : "Добавить"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function SourceCard({
  source,
  adapterTypes,
  kinds,
  onChanged,
}: {
  source: Source;
  adapterTypes: string[];
  kinds: string[];
  onChanged: () => void;
}) {
  const [status, setStatus] = React.useState(source.status);
  const [adapterType, setAdapterType] = React.useState(source.adapterType);
  const [kind, setKind] = React.useState(source.kind);
  const [baseUrl, setBaseUrl] = React.useState(source.baseUrl);
  const [scheduleCron, setScheduleCron] = React.useState(source.scheduleCron);
  const [busy, setBusy] = React.useState<"save" | "test" | "run" | null>(null);
  const [test, setTest] = React.useState<TestResult | null>(null);

  const dirty =
    status !== source.status ||
    adapterType !== source.adapterType ||
    kind !== source.kind ||
    baseUrl !== source.baseUrl ||
    scheduleCron !== source.scheduleCron;

  const save = async () => {
    setBusy("save");
    try {
      await api(`${ADMIN}/${source.id}`, {
        method: "PATCH",
        json: { status, adapterType, kind, baseUrl, scheduleCron },
      });
      toast.success("Источник сохранён");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const r = await api<TestResult>(`${ADMIN}/${source.id}/test`, { method: "POST" });
      setTest(r);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Проверка не удалась");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setBusy("run");
    try {
      const r = await api<{ status: string; found: number; changed: number }>(`${ADMIN}/${source.id}/run`, {
        method: "POST",
      });
      toast.success(`Импорт: ${r.status}, найдено ${r.found}, изменено ${r.changed}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Запуск не удался");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Удалить источник «${source.name}»?`)) return;
    try {
      await api(`${ADMIN}/${source.id}`, { method: "DELETE" });
      toast.success("Источник удалён");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось удалить");
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{source.name}</CardTitle>
              <span className={cn("rounded-control border px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[status] ?? STATUS_CLASS.planned)}>
                {status}
              </span>
              {source.scheduled && (
                <span className="rounded-control border border-border bg-bg px-2 py-0.5 text-[11px] text-muted">
                  по расписанию
                </span>
              )}
              {!source.runnable && (
                <span className="rounded-control border border-border bg-bg px-2 py-0.5 text-[11px] text-muted">
                  адаптер в разработке
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[12px] text-muted">{source.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runTest} disabled={busy !== null}>
              <PlugZap size={15} strokeWidth={1.75} className={cn(busy === "test" && "animate-pulse")} />
              {busy === "test" ? "Проверка…" : "Проверить"}
            </Button>
            {source.runnable && (
              <Button size="sm" variant="outline" onClick={run} disabled={busy !== null}>
                <PlayCircle size={15} strokeWidth={1.75} />
                {busy === "run" ? "Запуск…" : "Запустить"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={remove} aria-label="Удалить источник">
              <Trash2 size={16} strokeWidth={1.75} className="text-st-red" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_170px_180px]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Адрес (baseUrl)</span>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Статус</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Расписание (cron)</span>
            <input
              value={scheduleCron}
              onChange={(e) => setScheduleCron(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[170px_180px_1fr]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Тип источника</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Адаптер</span>
            <select
              value={adapterType}
              onChange={(e) => setAdapterType(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {adapterTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end">
            <Button size="sm" onClick={save} disabled={!dirty || busy !== null}>
              <Save size={15} strokeWidth={1.75} />
              {busy === "save" ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>

        {test && (
          <div className="mt-3 rounded-control border border-border bg-bg p-3">
            <div className="flex flex-wrap items-center gap-4 text-[13px]">
              <span>
                <span className="font-medium text-ink">
                  {test.reachable ? "Доступен" : "Недоступен"}
                </span>
              </span>
              {test.statusCode != null && <span className="text-muted">HTTP {test.statusCode}</span>}
              {test.latencyMs != null && <span className="text-muted">{test.latencyMs} мс</span>}
              {test.robotsAllowed != null && (
                <span className={cn(test.robotsAllowed ? "text-brand-green" : "text-st-red")}>
                  robots: {test.robotsAllowed ? "разрешено" : "запрещено"}
                  {test.crawlDelay ? ` · задержка ${test.crawlDelay}с` : ""}
                </span>
              )}
              {test.contentType && <span className="text-muted">{test.contentType}</span>}
            </div>
            {test.error && <p className="mt-1 text-[12px] text-st-red">{test.error}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
