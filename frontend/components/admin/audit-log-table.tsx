"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type AuditLog = {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

type Payload = {
  events: AuditLog[];
  actions: string[];
  summary: {
    events: number;
    aiEvents: number;
    serviceEvents: number;
    applicationEvents: number;
  };
};

const ROLE_TONE: Record<string, ChipTone> = {
  admin: "green",
  analyst: "blue",
  entrepreneur: "amber",
  system: "gray",
};

const ACTION_LABEL: Record<string, string> = {
  "service.published": "Услуга опубликована",
  "form_schema.version_created": "Версия формы создана",
  "doc_template.updated": "Шаблон документа обновлён",
  "application.status_changed": "Статус заявки изменён",
  "ai.generation_used": "AI-генерация использована",
  "import.published": "Импорт опубликован",
};

export function AuditLogTable({
  serviceId,
  compact = false,
}: {
  serviceId?: string;
  compact?: boolean;
}) {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [actor, setActor] = React.useState("");
  const [action, setAction] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    if (actor) qs.set("actor", actor);
    if (action) qs.set("action", action);
    if (fromDate) qs.set("fromDate", new Date(fromDate).toISOString());
    if (toDate) qs.set("toDate", new Date(`${toDate}T23:59:59`).toISOString());
    try {
      setData(await api<Payload>(`/api/v1/admin/audit?${qs}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить аудит");
    }
  }, [actor, action, fromDate, serviceId, toDate]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      {!compact && (
        <div className="mb-5 grid gap-4 sm:grid-cols-4">
          <Metric label="событий" value={data?.summary.events ?? 0} />
          <Metric label="AI" value={data?.summary.aiEvents ?? 0} />
          <Metric label="услуг" value={data?.summary.serviceEvents ?? 0} />
          <Metric label="заявок" value={data?.summary.applicationEvents ?? 0} />
        </div>
      )}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle>{compact ? "История изменений" : "Лента аудита"}</CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              {!serviceId && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-medium text-muted">Актор</span>
                    <input
                      value={actor}
                      onChange={(event) => setActor(event.target.value)}
                      className="mt-1 h-10 w-[180px] rounded-control border border-border bg-surface px-3 text-[14px]"
                      placeholder="Имя"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-muted">Действие</span>
                    <select
                      value={action}
                      onChange={(event) => setAction(event.target.value)}
                      className="mt-1 h-10 w-[220px] rounded-control border border-border bg-surface px-3 text-[14px]"
                    >
                      <option value="">Все действия</option>
                      {(data?.actions ?? []).map((item) => (
                        <option key={item} value={item}>
                          {ACTION_LABEL[item] ?? item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <DateInput label="С" value={fromDate} onChange={setFromDate} />
                  <DateInput label="По" value={toDate} onChange={setToDate} />
                </>
              )}
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw size={18} strokeWidth={1.75} />
                Обновить
              </Button>
            </div>
          </div>

          {error && <ErrorBanner className="mt-4" message={error} onRetry={() => void load()} />}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[880px] w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.03em] text-muted">
                <tr>
                  <Th>Дата</Th>
                  <Th>Актор</Th>
                  <Th>Действие</Th>
                  <Th>Сущность</Th>
                  <Th>Детали</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.events ?? []).map((event) => {
                  const isAi = event.action === "ai.generation_used";
                  const open = expanded === event.id;
                  return (
                    <React.Fragment key={event.id}>
                      <tr className="align-top">
                        <Td className="whitespace-nowrap text-muted">
                          {new Date(event.createdAt).toLocaleString("ru-RU")}
                        </Td>
                        <Td>
                          <div className="space-y-1">
                            <p className="font-medium text-ink">{event.actor}</p>
                            <Chip tone={ROLE_TONE[event.actorRole] ?? "gray"}>
                              {event.actorRole}
                            </Chip>
                          </div>
                        </Td>
                        <Td>
                          <p className="font-mono text-[12px] text-ink">{event.action}</p>
                          <p className="mt-1 text-muted">{ACTION_LABEL[event.action] ?? event.action}</p>
                        </Td>
                        <Td>
                          <p className="text-ink">{event.entityType}</p>
                          <p className="font-mono text-[11px] text-muted">{event.entityId}</p>
                        </Td>
                        <Td>
                          <button
                            type="button"
                            disabled={!isAi}
                            onClick={() => setExpanded(open ? null : event.id)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-control px-2 py-1 text-[12px] font-medium",
                              isAi ? "bg-bg text-ink hover:bg-st-blue-bg" : "cursor-default text-muted"
                            )}
                          >
                            {summary(event)}
                            {isAi && <ChevronDown size={14} className={cn(open && "rotate-180")} />}
                          </button>
                        </Td>
                      </tr>
                      {isAi && open && (
                        <tr>
                          <td colSpan={5} className="bg-bg px-4 py-3">
                            <div className="grid gap-3 text-[13px] md:grid-cols-4">
                              <Detail label="Сгенерировано" value={stringMeta(event, "generated")} />
                              <Detail label="Источник" value={stringMeta(event, "source")} />
                              <Detail label="Тип промпта" value={stringMeta(event, "promptType")} />
                              <Detail label="Confidence" value={String(event.meta.confidence ?? "0")} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {data && data.events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      Событий аудита пока нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
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

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 rounded-control border border-border bg-surface px-3 text-[14px]"
      />
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-4 ${className}`}>{children}</td>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.03em] text-muted">{label}</p>
      <p className="mt-1 text-ink">{value}</p>
    </div>
  );
}

function stringMeta(event: AuditLog, key: string): string {
  const value = event.meta[key];
  return typeof value === "string" ? value : "—";
}

function summary(event: AuditLog): string {
  if (event.action === "ai.generation_used") {
    return `${event.meta.sources ?? 0} источн. · ${event.meta.confidence ?? 0}`;
  }
  if (event.action === "application.status_changed") {
    return `${event.meta.fromStatus ?? "—"} → ${event.meta.toStatus ?? "—"}`;
  }
  if (event.action === "form_schema.version_created") {
    return `v${event.meta.version ?? "?"}`;
  }
  return typeof event.meta.title === "string" ? event.meta.title : "Подробнее";
}
