"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  FileText,
  Upload,
  Loader2,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE } from "@/lib/api";
import type { AppDetail } from "@/lib/types";
import { walkElements, type SurveySchema } from "@/lib/survey-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Stage2Panel } from "@/components/cabinet/stage2-panel";
import { dateTimeRu } from "@/lib/format";

function titleMap(schema: SurveySchema): Record<string, string> {
  const map: Record<string, string> = {};
  walkElements(schema ?? {}).forEach((el) => {
    if (el.name) map[el.name] = el.title || el.name;
  });
  return map;
}

function fmt(v: unknown): string {
  if (typeof v === "boolean") return v ? "Да" : "Нет";
  if (typeof v === "number")
    return v >= 1000 ? v.toLocaleString("ru-RU").replace(/,/g, " ") : String(v);
  return String(v ?? "—");
}

export function AppDetailView({ app }: { app: AppDetail }) {
  const router = useRouter();
  const titles = React.useMemo(() => titleMap(app.schema ?? {}), [app.schema]);
  const [files, setFiles] = React.useState(app.files ?? []);
  const [uploading, setUploading] = React.useState(false);
  const [resubmitting, setResubmitting] = React.useState(false);
  const isNeedsChanges = app.status === "needs_changes";

  const managerComment = [...app.events]
    .reverse()
    .find((e) => e.toStatus === "needs_changes")?.comment;

  const answerEntries = Object.entries(app.answers ?? {}).filter(
    ([k]) => k !== "bin"
  );
  const calcEntries = Object.entries(app.calc ?? {});

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/v1/applications/${app.id}/files`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Не удалось загрузить файл");
      const entry = await res.json();
      setFiles((f) => [...f, entry]);
      toast.success("Файл загружен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function resubmit() {
    setResubmitting(true);
    try {
      await api(`/api/v1/applications/${app.id}/resubmit`, {
        method: "POST",
        json: { comment: "Документы обновлены" },
      });
      toast.success("Заявка отправлена на повторное рассмотрение");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
      setResubmitting(false);
    }
  }

  return (
    <div>
      {app.stage2?.pending && <Stage2Panel app={app} />}

      {isNeedsChanges && (
        <div className="mb-6 rounded-card border border-st-amber bg-st-amber-bg p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={20}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-st-amber"
            />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-st-amber">
                Заявка требует доработки
              </p>
              {managerComment && (
                <p className="mt-1 text-[13px] text-fg">{managerComment}</p>
              )}
              <Link
                href="/knowledge/why-needs-changes"
                className="mt-2 inline-block text-[12px] font-medium text-st-amber underline underline-offset-2 hover:text-st-amber/80"
              >
                Почему так бывает →
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <UploadButton uploading={uploading} onFile={upload} />
                <Button
                  onClick={resubmit}
                  disabled={resubmitting}
                  size="sm"
                >
                  {resubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                      Отправка…
                    </>
                  ) : (
                    "Отправить на повторное рассмотрение"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">Данные</TabsTrigger>
          <TabsTrigger value="docs">Документы</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="pt-5">
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {answerEntries.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-muted">
                Данные ещё не заполнены
              </p>
            ) : (
              <dl className="divide-y divide-border">
                {answerEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-[13px] text-muted">{titles[k] ?? k}</dt>
                    <dd className="num text-[14px] font-medium text-fg">
                      {fmt(v)}
                    </dd>
                  </div>
                ))}
                {calcEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-4 bg-st-green-bg/40 px-4 py-2.5"
                  >
                    <dt className="text-[13px] text-st-green">
                      {titles[k] ?? k} (расчёт)
                    </dt>
                    <dd className="num text-[14px] font-semibold text-st-green">
                      {fmt(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="pt-5">
          <div className="space-y-2">
            {app.pdfUrl && (
              <a
                href={`${API_BASE}/api/v1/applications/${app.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 hover:border-ink"
              >
                <FileText size={20} strokeWidth={1.75} className="text-ink" />
                <span className="flex-1 text-[14px] font-medium text-fg">
                  Заявление {app.number}.pdf
                </span>
                <Download size={18} strokeWidth={1.75} className="text-muted" />
              </a>
            )}
            {files.map((f, i) => (
              <a
                key={i}
                href={`${API_BASE}${f.url}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 hover:border-ink"
              >
                <Paperclip size={20} strokeWidth={1.75} className="text-muted" />
                <span className="flex-1 text-[14px] text-fg">{f.name}</span>
                <span className="text-[12px] text-muted">
                  {dateTimeRu(f.uploadedAt)}
                </span>
              </a>
            ))}
            {!app.pdfUrl && files.length === 0 && (
              <p className="rounded-control border border-dashed border-border py-8 text-center text-[14px] text-muted">
                Документов пока нет
              </p>
            )}
            <div className="pt-2">
              <UploadButton uploading={uploading} onFile={upload} variant="outline" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-5">
          <ol className="space-y-3">
            {[...app.events].reverse().map((e) => (
              <li
                key={e.id}
                className="flex gap-3 rounded-control border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[14px] font-medium text-fg">{e.toLabel}</p>
                    <span className="num text-[12px] text-muted">
                      {dateTimeRu(e.createdAt)}
                    </span>
                  </div>
                  {e.comment && (
                    <p className="mt-1 text-[13px] text-muted">{e.comment}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UploadButton({
  uploading,
  onFile,
  variant = "primary",
}: {
  uploading: boolean;
  onFile: (f: File) => void;
  variant?: "primary" | "outline";
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant={variant}
        disabled={uploading}
        onClick={() => ref.current?.click()}
      >
        {uploading ? (
          <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
        ) : (
          <Upload size={16} strokeWidth={1.75} />
        )}
        Загрузить документ
      </Button>
    </>
  );
}
