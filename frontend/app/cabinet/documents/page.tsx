"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileText, Paperclip } from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { dateTimeRu } from "@/lib/format";

type CabinetDocument = {
  id: string;
  appId: string;
  appNumber: string;
  appStatus: string;
  serviceTitle: string;
  orgName: string;
  name: string;
  type: string;
  uploadedAt: string;
  url: string;
  source: "system" | "client";
};

export default function DocumentsPage() {
  const [items, setItems] = React.useState<CabinetDocument[] | null>(null);
  const [appId, setAppId] = React.useState("");
  const [type, setType] = React.useState("");

  React.useEffect(() => {
    api<CabinetDocument[]>("/api/v1/applications/documents")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const appOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items ?? []) map.set(item.appId, `${item.appNumber} · ${item.serviceTitle}`);
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  const typeOptions = React.useMemo(() => {
    return [...new Set((items ?? []).map((item) => item.type))].map((value) => ({ value, label: value }));
  }, [items]);

  const filtered = (items ?? []).filter((item) => {
    if (appId && item.appId !== appId) return false;
    if (type && item.type !== type) return false;
    return true;
  });

  return (
    <div>
      <div>
        <h1 className="text-[24px] font-semibold text-ink">Документы</h1>
        <p className="mt-1 text-[14px] text-muted">
          Все заявления PDF и загруженные файлы по вашим заявкам в одном месте.
        </p>
      </div>

      <div className="mt-6 rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Select
            value={appId}
            onValueChange={setAppId}
            placeholder="Все заявки"
            options={appOptions}
            className="min-w-[260px]"
          />
          <Select
            value={type}
            onValueChange={setType}
            placeholder="Все типы"
            options={typeOptions}
          />
        </div>

        {items === null ? (
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[14px] font-medium text-ink">Документы не найдены</p>
            <p className="mt-1 text-[13px] text-muted">
              Измените фильтры или откройте заявку, чтобы загрузить файл.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-[13px]">
              <thead className="border-b border-border bg-bg text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Документ</th>
                  <th className="px-4 py-3 font-medium">Заявка</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 text-right font-medium">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-bg/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {item.source === "system" ? (
                          <FileText size={18} strokeWidth={1.75} className="text-brand-green" />
                        ) : (
                          <Paperclip size={18} strokeWidth={1.75} className="text-muted" />
                        )}
                        <span className="font-medium text-ink">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/cabinet/applications/${item.appId}`} className="font-medium text-fg hover:underline">
                        {item.appNumber}
                      </Link>
                      <p className="mt-0.5 max-w-[260px] truncate text-[12px] text-muted">{item.serviceTitle}</p>
                      <div className="mt-1">
                        <StatusChip status={item.appStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg">{item.type}</td>
                    <td className="px-4 py-3 text-muted">{dateTimeRu(item.uploadedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={item.url.startsWith("/api") ? `${API_BASE}${item.url}` : `${API_BASE}${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-control border border-border bg-white px-3 py-2 font-medium text-ink hover:border-ink"
                      >
                        <Download size={16} strokeWidth={1.75} />
                        Скачать
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
