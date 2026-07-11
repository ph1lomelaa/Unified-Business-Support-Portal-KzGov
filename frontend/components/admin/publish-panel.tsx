"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ServiceEditor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { dateTimeRu } from "@/lib/format";

export function PublishPanel({
  service,
  onChanged,
}: {
  service: ServiceEditor;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const hasUnpublished =
    service.latestVersion > 0 &&
    service.activeVersion !== service.latestVersion;

  async function publish(version?: number) {
    setBusy(true);
    try {
      const res = await api<{ activeVersion: number }>(
        `/api/v1/admin/services/${service.id}/publish`,
        { method: "POST", json: version ? { version } : {} }
      );
      toast.success(
        `Опубликовано: версия v${res.activeVersion} видна клиентам`
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Статус</span>
              {service.status === "published" ? (
                <Chip tone="green">Опубликована</Chip>
              ) : service.status === "archived" ? (
                <Chip tone="gray">В архиве</Chip>
              ) : (
                <Chip tone="amber">Черновик</Chip>
              )}
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted">Активная версия формы</span>
              <span className="num font-medium text-fg">
                {service.activeVersion ? `v${service.activeVersion}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted">Последняя версия (черновик)</span>
              <span className="num font-medium text-fg">
                v{service.latestVersion}
              </span>
            </div>

            <Button
              onClick={() => publish()}
              disabled={busy || service.latestVersion === 0}
              className="w-full"
            >
              {busy
                ? "Публикуем…"
                : hasUnpublished
                  ? `Опубликовать изменения (v${service.latestVersion})`
                  : "Опубликовать услугу"}
            </Button>

            {hasUnpublished ? (
              <div className="flex gap-2 rounded-control border border-st-amber-bg bg-st-amber-bg px-3 py-2 text-[13px] text-st-amber">
                <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0" />
                <span>
                  Опубликованные изменения сразу видны клиентам. Поданные заявки
                  сохраняют свою версию схемы и не ломаются.
                </span>
              </div>
            ) : service.status === "published" ? (
              <div className="flex gap-2 rounded-control border border-st-green-bg bg-st-green-bg px-3 py-2 text-[13px] text-st-green">
                <CheckCircle2 size={18} strokeWidth={1.75} className="shrink-0" />
                <span>Актуальная версия опубликована и видна в каталоге.</span>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <p className="mb-3 text-[14px] font-semibold text-ink">
            История версий формы
          </p>
          <div className="overflow-hidden rounded-control border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-[12px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Версия</th>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Автор</th>
                  <th className="px-3 py-2">Активна</th>
                  <th className="px-3 py-2 sr-only">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {service.versions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted">
                      Нет сохранённых версий формы
                    </td>
                  </tr>
                ) : (
                  service.versions.map((v) => (
                    <tr key={v.version} className="hover:bg-bg">
                      <td className="px-3 py-2 num font-medium">v{v.version}</td>
                      <td className="px-3 py-2 num text-muted">
                        {dateTimeRu(v.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-muted">{v.author}</td>
                      <td className="px-3 py-2">
                        {v.isActive ? (
                          <Chip tone="green">Активна</Chip>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!v.isActive && (
                          <button
                            onClick={() => publish(v.version)}
                            disabled={busy}
                            className="text-[13px] font-medium text-ink hover:underline disabled:opacity-50"
                          >
                            Активировать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
