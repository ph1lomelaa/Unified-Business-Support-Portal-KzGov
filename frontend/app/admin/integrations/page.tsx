"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Operation = {
  id: string;
  code: string;
  title: string;
  method: string;
  path: string;
  direction: "inbound" | "outbound";
  latencyMs: number | null;
  mockDataset: Record<string, unknown>;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
};

type IntegrationSystem = {
  id: string;
  name: string;
  owner: string;
  purpose: string;
  kind: string;
  adapterType: string;
  adapter: string;
  baseUrl: string;
  authType: string;
  timeoutMs: number;
  retryPolicy: { maxAttempts?: number; backoffMs?: number };
  status: "ready" | "mocked" | "planned" | "degraded";
  sla: string;
  latencyMs: number | null;
  nextStep: string;
  operations: number;
  operationsList: Operation[];
  lastEventAt: string | null;
};

type Exchange = {
  id: string;
  createdAt: string;
  direction: "inbound" | "outbound";
  systemId: string;
  operation: string;
  status: "success" | "retrying" | "failed";
  application: string | null;
  idempotencyKey: string;
  durationMs: number;
  attempts: number;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
};

type Contract = {
  operation: string;
  request: string;
  response: string;
  source: string;
  owner: string;
};

type Envelope = {
  ok: boolean;
  data: Record<string, unknown>;
  status: string;
  source: string;
  latencyMs: number | null;
  attempts: number;
  callId: string | null;
  error: string | null;
};

type Payload = {
  systems: IntegrationSystem[];
  exchanges: Exchange[];
  contracts: Contract[];
  adapterTypes: string[];
  summary: {
    systems: number;
    healthy: number;
    planned: number;
    retrying: number;
    operations: number;
    avgLatencyMs: number | null;
  };
};

type TestTarget = { systemId: string; operation: string };

const STATUS_LABEL: Record<string, string> = {
  ready: "Готов к ЕИШ",
  mocked: "Мок-контракт",
  planned: "Запланирован",
  degraded: "Есть ретраи",
  success: "Успешно",
  replayed: "Идемпотентный повтор",
  retrying: "Повтор",
  failed: "Ошибка",
  error: "Ошибка",
};

const STATUS_CLASS: Record<string, string> = {
  ready: "border-st-green/30 bg-st-green/10 text-st-green",
  mocked: "border-ink/20 bg-bg text-ink",
  planned: "border-border bg-bg text-muted",
  degraded: "border-st-amber/30 bg-st-amber/10 text-st-amber",
  success: "border-st-green/30 bg-st-green/10 text-st-green",
  replayed: "border-st-blue/30 bg-st-blue/10 text-st-blue",
  retrying: "border-st-amber/30 bg-st-amber/10 text-st-amber",
  failed: "border-st-red/30 bg-st-red/10 text-st-red",
  error: "border-st-red/30 bg-st-red/10 text-st-red",
};

const DEFAULT_PAYLOAD: Record<string, string> = {
  "company.prefill": '{ "bin": "123456789012" }',
  "application.submit": '{ "applicationNumber": "EPPB-2026-000999", "org": "damu" }',
  "document.sign": '{ "director": "Ахметов А." }',
  "auth.callback": '{ "iin": "900101300123" }',
  "status.callback": '{ "status": "in_review" }',
};

export default function AdminIntegrationsPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [testTarget, setTestTarget] = React.useState<TestTarget | null>(null);

  const load = React.useCallback(() => {
    api<Payload>("/api/v1/admin/integrations")
      .then((payload) => {
        setData(payload);
        setActiveId((current) => current ?? payload.systems[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Неизвестная ошибка"));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const active = data?.systems.find((item) => item.id === activeId) ?? data?.systems[0];
  const activeExchanges = active
    ? data?.exchanges.filter((item) => item.systemId === active.id) ?? []
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">
            Integration control center
          </p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">
            Интеграции и шина
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Все системы, операции и мок-данные настраиваются здесь без кода. Каждый
            вызов идёт через интеграционную шину, пишется в аудит обмена, и его
            можно проверить кнопкой «Тестовый вызов».
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink"
        >
          <RefreshCw size={16} strokeWidth={1.75} />
          Обновить
        </button>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      {data && active && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-5">
            <Metric label="систем" value={data.summary.systems} />
            <Metric label="готово/мок" value={data.summary.healthy} />
            <Metric label="в плане" value={data.summary.planned} />
            <Metric label="ретраи" value={data.summary.retrying} />
            <Metric label="операций" value={data.summary.operations} />
          </div>

          <TestPanel
            systems={data.systems}
            preset={testTarget}
            onRan={load}
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardBody>
                <CardTitle>Адаптеры</CardTitle>
                <div className="mt-4 space-y-2">
                  {data.systems.map((system) => (
                    <button
                      key={system.id}
                      onClick={() => setActiveId(system.id)}
                      className={cn(
                        "w-full rounded-control border px-3 py-3 text-left transition-colors",
                        active.id === system.id
                          ? "border-ink bg-ink text-white"
                          : "border-border bg-surface text-ink hover:border-ink"
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-[13px] font-semibold">{system.name}</span>
                          <span
                            className={cn(
                              "mt-0.5 block text-[12px]",
                              active.id === system.id ? "text-white/65" : "text-muted"
                            )}
                          >
                            {system.owner} · {system.operations} операций · {system.adapterType}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-control border px-2 py-1 text-[11px] font-medium",
                            active.id === system.id
                              ? "border-white/20 text-white"
                              : STATUS_CLASS[system.status]
                          )}
                        >
                          {STATUS_LABEL[system.status]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-6">
              <SystemEditor
                key={active.id}
                system={active}
                adapterTypes={data.adapterTypes}
                exchanges={activeExchanges}
                onSaved={load}
                onTest={setTestTarget}
              />
              <Contracts contracts={data.contracts} />
            </div>
          </div>

          <Card className="mt-6">
            <CardBody>
              <CardTitle>Последние обмены (outbox)</CardTitle>
              <ExchangeTable exchanges={data.exchanges} systems={data.systems} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="stat-figure">{value}</p>
        <p className="kicker mt-1 text-muted">{label}</p>
      </CardBody>
    </Card>
  );
}

function TestPanel({
  systems,
  preset,
  onRan,
}: {
  systems: IntegrationSystem[];
  preset: TestTarget | null;
  onRan: () => void;
}) {
  const [systemId, setSystemId] = React.useState(preset?.systemId ?? systems[0]?.id ?? "");
  const system = systems.find((s) => s.id === systemId) ?? systems[0];
  const ops = system?.operationsList ?? [];
  const [operation, setOperation] = React.useState(preset?.operation ?? ops[0]?.code ?? "");
  const [payload, setPayload] = React.useState(DEFAULT_PAYLOAD[operation] ?? "{}");
  const [idem, setIdem] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Envelope | null>(null);

  // React to a preset chosen from an operation row.
  React.useEffect(() => {
    if (!preset) return;
    setSystemId(preset.systemId);
    setOperation(preset.operation);
    setPayload(DEFAULT_PAYLOAD[preset.operation] ?? "{}");
    setResult(null);
  }, [preset]);

  function pickOperation(code: string) {
    setOperation(code);
    setPayload(DEFAULT_PAYLOAD[code] ?? "{}");
  }

  async function run() {
    let parsed: Record<string, unknown>;
    try {
      parsed = payload.trim() ? JSON.parse(payload) : {};
    } catch {
      toast.error("Payload — некорректный JSON");
      return;
    }
    setBusy(true);
    try {
      const env = await api<Envelope>("/api/v1/admin/integrations/test", {
        method: "POST",
        json: { systemId, operation, payload: parsed, idempotencyKey: idem || null },
      });
      setResult(env);
      onRan();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось выполнить вызов");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 border-brand-green/40">
      <CardBody>
        <div className="flex items-center gap-2">
          <PlayCircle size={20} strokeWidth={1.75} className="text-brand-green" />
          <CardTitle>Тестовый вызов через шину</CardTitle>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Реальный вызов адаптера: ответ, задержка, ретраи и запись в outbox — всё
          настоящее. Меняйте мок-данные операции ниже и запускайте снова.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Система</span>
            <select
              value={systemId}
              onChange={(e) => {
                const next = systems.find((s) => s.id === e.target.value);
                setSystemId(e.target.value);
                pickOperation(next?.operationsList[0]?.code ?? "");
              }}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.adapterType})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Операция</span>
            <select
              value={operation}
              onChange={(e) => pickOperation(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            >
              {ops.map((o) => (
                <option key={o.id} value={o.code}>
                  {o.code} — {o.title || o.direction}
                </option>
              ))}
              {ops.length === 0 && <option value="">нет операций</option>}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Payload (JSON)</span>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={3}
              spellCheck={false}
              className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Idempotency-key (опц.)</span>
            <input
              value={idem}
              onChange={(e) => setIdem(e.target.value)}
              placeholder="app-EPPB-...-v1"
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
            <Button onClick={run} disabled={busy || !operation} className="mt-3 w-full" size="lg">
              <PlayCircle size={18} strokeWidth={1.75} />
              {busy ? "Вызываем…" : "Выполнить"}
            </Button>
          </label>
        </div>

        {result && <EnvelopeView env={result} />}
      </CardBody>
    </Card>
  );
}

function EnvelopeView({ env }: { env: Envelope }) {
  return (
    <div className="mt-4 rounded-card border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span
          className={cn(
            "rounded-control border px-2 py-1 text-[11px] font-medium",
            STATUS_CLASS[env.status] ?? STATUS_CLASS.success
          )}
        >
          {STATUS_LABEL[env.status] ?? env.status}
        </span>
        <span className="text-muted">
          Источник: <span className="text-ink">{env.source}</span>
        </span>
        <span className="text-muted">
          Задержка: <span className="num text-ink">{env.latencyMs ?? "—"} мс</span>
        </span>
        <span className="text-muted">
          Попыток: <span className="num text-ink">{env.attempts}</span>
        </span>
        {env.callId && (
          <span className="font-mono text-[11px] text-muted">callId: {env.callId}</span>
        )}
      </div>
      <pre className="mt-3 max-h-64 overflow-auto rounded-control border border-border bg-surface p-3 font-mono text-[12px] text-ink">
        {JSON.stringify(env.error ? { error: env.error } : env.data, null, 2)}
      </pre>
    </div>
  );
}

function SystemEditor({
  system,
  adapterTypes,
  exchanges,
  onSaved,
  onTest,
}: {
  system: IntegrationSystem;
  adapterTypes: string[];
  exchanges: Exchange[];
  onSaved: () => void;
  onTest: (t: TestTarget) => void;
}) {
  const [adapterType, setAdapterType] = React.useState(system.adapterType);
  const [status, setStatus] = React.useState(system.status);
  const [latencyMs, setLatencyMs] = React.useState(String(system.latencyMs ?? ""));
  const [baseUrl, setBaseUrl] = React.useState(system.baseUrl);
  const [maxAttempts, setMaxAttempts] = React.useState(
    String(system.retryPolicy?.maxAttempts ?? 1)
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/v1/admin/integrations/systems/${system.id}`, {
        method: "PATCH",
        json: {
          adapterType,
          status,
          baseUrl,
          latencyMs: latencyMs === "" ? null : Number(latencyMs),
          retryPolicy: {
            maxAttempts: Number(maxAttempts) || 1,
            backoffMs: system.retryPolicy?.backoffMs ?? 0,
          },
        },
      });
      toast.success("Настройки системы сохранены");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-muted">{system.owner}</p>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{system.name}</h2>
            <p className="mt-2 max-w-2xl text-[14px] text-muted">{system.purpose}</p>
          </div>
          <span
            className={cn(
              "rounded-control border px-2 py-1 text-[12px] font-medium",
              STATUS_CLASS[system.status]
            )}
          >
            {STATUS_LABEL[system.status]}
          </span>
        </div>

        {/* no-code system settings */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Адаптер">
            <select
              value={adapterType}
              onChange={(e) => setAdapterType(e.target.value)}
              className="h-9 w-full rounded-control border border-border bg-surface px-2 text-[13px] text-ink"
            >
              {adapterTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Статус">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IntegrationSystem["status"])}
              className="h-9 w-full rounded-control border border-border bg-surface px-2 text-[13px] text-ink"
            >
              {["ready", "mocked", "degraded", "planned"].map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Задержка, мс">
            <input
              value={latencyMs}
              onChange={(e) => setLatencyMs(e.target.value)}
              inputMode="numeric"
              className="h-9 w-full rounded-control border border-border bg-surface px-2 font-mono text-[13px] text-ink"
            />
          </Field>
          <Field label="Ретраи (макс.)">
            <input
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              inputMode="numeric"
              className="h-9 w-full rounded-control border border-border bg-surface px-2 font-mono text-[13px] text-ink"
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Base URL (для REST-адаптера)">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://esb.baiterek.gov.kz/gbd-ul"
              className="h-9 w-full rounded-control border border-border bg-surface px-2 font-mono text-[13px] text-ink"
            />
          </Field>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving} variant="outline" size="sm" className="h-9">
              <Save size={16} strokeWidth={1.75} />
              {saving ? "Сохраняем…" : "Сохранить систему"}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <InfoTile label="SLA" value={system.sla || "—"} />
          <InfoTile label="Адаптер" value={system.adapter} />
          <InfoTile label="Событий" value={String(exchanges.length)} />
        </div>

        <div className="mt-5">
          <p className="text-[13px] font-semibold text-ink">Операции</p>
          <div className="mt-3 space-y-3">
            {system.operationsList.map((op) => (
              <OperationEditor key={op.id} systemId={system.id} op={op} onSaved={onSaved} onTest={onTest} />
            ))}
            {system.operationsList.length === 0 && (
              <p className="text-[13px] text-muted">У системы пока нет операций.</p>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-card border border-border bg-bg p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <ShieldCheck size={18} strokeWidth={1.75} />
            Следующий шаг подключения
          </div>
          <p className="mt-2 text-[13px] text-muted">{system.nextStep || "—"}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function OperationEditor({
  systemId,
  op,
  onSaved,
  onTest,
}: {
  systemId: string;
  op: Operation;
  onSaved: () => void;
  onTest: (t: TestTarget) => void;
}) {
  const [mock, setMock] = React.useState(JSON.stringify(op.mockDataset ?? {}, null, 2));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    let parsed: Record<string, unknown>;
    try {
      parsed = mock.trim() ? JSON.parse(mock) : {};
    } catch {
      toast.error("Мок-данные — некорректный JSON");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/v1/admin/integrations/operations/${op.id}`, {
        method: "PATCH",
        json: { mockDataset: parsed },
      });
      toast.success(`Операция ${op.code} сохранена`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка сохранения операции");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[12px] text-muted">
            {op.direction === "outbound" ? (
              <ArrowUpRight size={13} strokeWidth={1.75} />
            ) : (
              <ArrowDownLeft size={13} strokeWidth={1.75} />
            )}
          </span>
          <span className="font-mono text-[12px] font-semibold text-ink">{op.code}</span>
          <span className="text-[12px] text-muted">{op.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onTest({ systemId, operation: op.code })}
            variant="ghost"
            size="sm"
            className="h-8"
          >
            <PlayCircle size={15} strokeWidth={1.75} />
            Тест
          </Button>
          <Button onClick={save} disabled={saving} variant="outline" size="sm" className="h-8">
            <Save size={15} strokeWidth={1.75} />
            {saving ? "…" : "Сохранить"}
          </Button>
        </div>
      </div>
      <label className="mt-2 block">
        <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
          Мок-данные ответа (JSON) — редактируется без кода
        </span>
        <textarea
          value={mock}
          onChange={(e) => setMock(e.target.value)}
          rows={4}
          spellCheck={false}
          className="mt-1 w-full rounded-control border border-border bg-bg px-3 py-2 font-mono text-[12px] text-ink"
        />
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function Contracts({ contracts }: { contracts: Contract[] }) {
  return (
    <Card>
      <CardBody>
        <CardTitle>Ключевые контракты</CardTitle>
        <div className="mt-4 grid gap-3">
          {contracts.map((contract) => (
            <div key={contract.operation} className="rounded-card border border-border p-4">
              <p className="font-mono text-[12px] font-semibold text-ink">{contract.operation}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <p className="text-[13px] text-muted">
                  <span className="font-semibold text-ink">Request:</span> {contract.request}
                </p>
                <p className="text-[13px] text-muted">
                  <span className="font-semibold text-ink">Response:</span> {contract.response}
                </p>
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Источник: {contract.source} · Ответственный: {contract.owner}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ExchangeTable({
  exchanges,
  systems,
}: {
  exchanges: Exchange[];
  systems: IntegrationSystem[];
}) {
  const systemNames = new Map(systems.map((item) => [item.id, item.name]));
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-border">
      <table className="min-w-[920px] w-full border-collapse text-left text-[13px]">
        <thead className="bg-bg text-[11px] uppercase tracking-[0.06em] text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Направление</th>
            <th className="px-3 py-2 font-semibold">Система</th>
            <th className="px-3 py-2 font-semibold">Операция</th>
            <th className="px-3 py-2 font-semibold">Заявка</th>
            <th className="px-3 py-2 font-semibold">Статус</th>
            <th className="px-3 py-2 font-semibold">Idempotency</th>
            <th className="px-3 py-2 font-semibold">Попытки</th>
            <th className="px-3 py-2 font-semibold">Время</th>
          </tr>
        </thead>
        <tbody>
          {exchanges.map((exchange) => (
            <tr key={exchange.id} className="border-t border-border">
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  {exchange.direction === "outbound" ? (
                    <ArrowUpRight size={14} strokeWidth={1.75} />
                  ) : (
                    <ArrowDownLeft size={14} strokeWidth={1.75} />
                  )}
                  {exchange.direction === "outbound" ? "out" : "in"}
                </span>
              </td>
              <td className="px-3 py-3 text-ink">
                {systemNames.get(exchange.systemId) ?? exchange.systemId}
              </td>
              <td className="px-3 py-3 font-mono text-[12px] text-ink">{exchange.operation}</td>
              <td className="px-3 py-3 text-muted">{exchange.application ?? "—"}</td>
              <td className="px-3 py-3">
                <span
                  className={cn(
                    "rounded-control border px-2 py-1 text-[11px] font-medium",
                    STATUS_CLASS[exchange.status]
                  )}
                >
                  {STATUS_LABEL[exchange.status]}
                </span>
              </td>
              <td className="px-3 py-3 font-mono text-[12px] text-muted">{exchange.idempotencyKey}</td>
              <td className="px-3 py-3 num text-muted">{exchange.attempts}</td>
              <td className="px-3 py-3 num text-muted">{exchange.durationMs} мс</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
