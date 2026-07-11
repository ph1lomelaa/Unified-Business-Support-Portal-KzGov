"use client";

import * as React from "react";
import { toast } from "sonner";
import { api, API_BASE } from "@/lib/api";
import type { OrgBrief, QueueItem, RegistryRow } from "@/lib/types";
import type { AppEvent, SlaProgress } from "@/lib/status";
import { STATUS } from "@/lib/status";
import { StatusChip } from "@/components/status-chip";
import { OrgLogo } from "@/components/org-logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateRu, dateTimeRu } from "@/lib/format";
import { Select } from "@/components/ui/select";

type QueueDetail = {
  id: string;
  number: string;
  status: string;
  answers: Record<string, unknown>;
  calc: Record<string, unknown>;
  pdfUrl: string | null;
  files: { name: string; url: string }[];
  sla: SlaProgress | null;
  company: { name: string; bin: string; director?: string } | null;
  service: { title: string; slug: string } | null;
  org: OrgBrief | null;
  nextStatuses: string[];
  events: AppEvent[];
};

const TARGET: Record<
  string,
  { label: string; variant: "accent" | "outline" | "danger"; comment?: boolean }
> = {
  in_review: { label: "Взять в работу", variant: "outline" },
  approved: { label: "Одобрить", variant: "accent" },
  needs_changes: { label: "На доработку", variant: "outline", comment: true },
  rejected: { label: "Отказать", variant: "danger", comment: true },
  contract_signed: { label: "Договор подписан", variant: "outline" },
  active: { label: "Активировать субсидирование", variant: "accent" },
  completed: { label: "Завершить", variant: "outline" },
};

export default function AdminQueuePage() {
  const [rows, setRows] = React.useState<QueueItem[] | null>(null);
  const [orgs, setOrgs] = React.useState<OrgBrief[]>([]);
  const [services, setServices] = React.useState<RegistryRow[]>([]);
  const [fStatus, setFStatus] = React.useState("");
  const [fOrg, setFOrg] = React.useState("");
  const [fService, setFService] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams();
    if (fStatus) qs.set("status", fStatus);
    if (fOrg) qs.set("org", fOrg);
    if (fService) qs.set("service", fService);
    setRows(await api<QueueItem[]>(`/api/v1/admin/applications?${qs}`));
  }, [fStatus, fOrg, fService]);

  React.useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  React.useEffect(() => {
    Promise.all([
      api<OrgBrief[]>("/api/v1/organizations"),
      api<RegistryRow[]>("/api/v1/admin/services"),
    ])
      .then(([o, s]) => {
        setOrgs(o);
        setServices(s);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">Очередь заявок</h1>
          <p className="mt-1 text-[14px] text-muted">
            Аналитик видит заявки своей организации. Решение — по кнопкам справа.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={fStatus} onValueChange={setFStatus} placeholder="Все статусы" options={Object.entries(STATUS).map(([value, status]) => ({ value, label: status.label }))} />
        <Select value={fOrg} onValueChange={setFOrg} placeholder="Все организации" options={orgs.map((org) => ({ value: org.id, label: org.shortName }))} />
        <Select value={fService} onValueChange={setFService} placeholder="Все услуги" options={services.map((service) => ({ value: service.id, label: service.title }))} />
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[14px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">ДО</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Обновлена</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="skeleton h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    Заявок по фильтрам нет
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="cursor-pointer hover:bg-bg"
                  >
                    <td className="px-4 py-3 num font-medium text-fg">
                      {r.number}
                    </td>
                    <td className="px-4 py-3 text-fg">{r.service?.title}</td>
                    <td className="px-4 py-3 text-muted">{r.company?.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <OrgLogo org={r.org} size={24} />
                        <span className="text-[13px] text-muted">
                          {r.org?.shortName}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SlaCell sla={r.sla} />
                    </td>
                    <td className="px-4 py-3 num text-muted">
                      {dateRu(r.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        {openId && (
          <QueueDrawer
            id={openId}
            onChanged={() => {
              load();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function SlaCell({ sla }: { sla: SlaProgress | null }) {
  if (!sla) return <span className="text-muted">—</span>;
  return (
    <span
      className={
        "num text-[13px] " + (sla.overdue ? "text-st-red" : "text-fg")
      }
    >
      {sla.overdue ? "просрочено" : `день ${sla.elapsed} из ${sla.total}`}
    </span>
  );
}

function QueueDrawer({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const [data, setData] = React.useState<QueueDetail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [commentFor, setCommentFor] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");

  const load = React.useCallback(async () => {
    setData(await api<QueueDetail>(`/api/v1/admin/applications/${id}`));
  }, [id]);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function doTransition(to: string, withComment?: string) {
    setBusy(true);
    try {
      await api(`/api/v1/admin/applications/${id}/transition`, {
        method: "POST",
        json: { to, comment: withComment },
      });
      toast.success(`Статус изменён: ${STATUS[to]?.label ?? to}`);
      setCommentFor(null);
      setComment("");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось изменить статус");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DrawerContent title={data ? `Заявка ${data.number}` : "Заявка"}>
      {!data ? (
        <div className="space-y-3 p-5">
          <div className="skeleton h-6 w-1/2" />
          <div className="skeleton h-40 w-full" />
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <OrgLogo org={data.org} size={36} />
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  {data.service?.title}
                </p>
                <p className="text-[12px] text-muted">{data.company?.name}</p>
              </div>
            </div>
            <StatusChip status={data.status} />
          </div>

          {/* decision panel */}
          {data.nextStatuses.length > 0 && (
            <div className="mt-5 rounded-card border border-border bg-bg p-4">
              <p className="mb-3 text-[13px] font-semibold text-ink">
                Решение по заявке
              </p>
              <div className="flex flex-wrap gap-2">
                {data.nextStatuses.map((to) => {
                  const t = TARGET[to];
                  if (!t) return null;
                  return (
                    <Button
                      key={to}
                      size="sm"
                      variant={t.variant}
                      disabled={busy}
                      onClick={() =>
                        t.comment ? setCommentFor(to) : doTransition(to)
                      }
                    >
                      {t.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* data */}
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-semibold text-ink">Данные</p>
            <dl className="divide-y divide-border overflow-hidden rounded-control border border-border">
              {Object.entries(data.answers ?? {})
                .filter(([k]) => k !== "bin")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="num text-[13px] font-medium text-fg">
                      {String(v)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>

          {/* documents */}
          {data.pdfUrl && (
            <a
              href={`${API_BASE}/api/v1/applications/${data.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 rounded-control border border-border px-3 py-2.5 text-[13px] font-medium text-ink hover:border-ink"
            >
              Заявление {data.number}.pdf
            </a>
          )}

          {/* history */}
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-semibold text-ink">История</p>
            <ol className="space-y-2">
              {[...data.events].reverse().map((e) => (
                <li key={e.id} className="text-[13px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-fg">{e.toLabel}</span>
                    <span className="num text-[12px] text-muted">
                      {dateTimeRu(e.createdAt)}
                    </span>
                  </div>
                  {e.comment && (
                    <p className="text-[12px] text-muted">{e.comment}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* comment modal */}
      <Dialog open={!!commentFor} onOpenChange={(o) => !o && setCommentFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commentFor ? TARGET[commentFor]?.label : ""} — комментарий
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Обязательный комментарий для заявителя"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCommentFor(null)}>
              Отмена
            </Button>
            <Button
              disabled={!comment.trim() || busy}
              variant={commentFor === "rejected" ? "danger" : "primary"}
              onClick={() => commentFor && doTransition(commentFor, comment.trim())}
            >
              Подтвердить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DrawerContent>
  );
}
