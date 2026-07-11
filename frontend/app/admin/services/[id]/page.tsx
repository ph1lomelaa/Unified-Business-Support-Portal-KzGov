"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ServiceEditor } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { OrgLogo } from "@/components/org-logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardEditor } from "@/components/admin/card-editor";
import { DocTemplateEditor } from "@/components/admin/doc-template-editor";
import { PublishPanel } from "@/components/admin/publish-panel";
import { AuditLogTable } from "@/components/admin/audit-log-table";

const FormConstructor = dynamic(
  () => import("@/components/admin/form-constructor").then((m) => m.FormConstructor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] rounded-card border border-border">
        <div className="skeleton h-full w-full opacity-60" />
      </div>
    ),
  }
);

export default function ServiceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = React.useState<ServiceEditor | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await api<ServiceEditor>(`/api/v1/admin/services/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить услугу");
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const saveForm = React.useCallback(
    async (schema: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await api<{ version: number }>(
          `/api/v1/admin/services/${id}/form`,
          { method: "PUT", json: { schema } }
        );
        toast.success(`Сохранено как версия v${res.version} (черновик)`);
        load();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения формы");
        return false;
      }
    },
    [id, load]
  );

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <p className="text-[15px] text-fg">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/services">Вернуться в реестр</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-[480px] w-full" />
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-[13px] text-muted">
        <Link href="/admin/services" className="hover:text-ink">
          Реестр услуг
        </Link>
        <ChevronRight size={14} strokeWidth={1.75} />
        <span className="text-fg">{data.title}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <OrgLogo org={data.org} size={44} />
          <div>
            <h1 className="text-[22px] font-semibold text-ink">{data.title}</h1>
            <p className="text-[13px] text-muted">
              {data.org?.name} · {CATEGORY_LABEL[data.category] ?? data.category}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={data.status} />
          {data.status === "published" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/services/${data.slug}`} target="_blank">
                <ExternalLink size={18} strokeWidth={1.75} />В каталоге
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="card" className="mt-6">
        <TabsList>
          <TabsTrigger value="card">Карточка</TabsTrigger>
          <TabsTrigger value="form">Форма заявки</TabsTrigger>
          <TabsTrigger value="doc">Шаблон документа</TabsTrigger>
          <TabsTrigger value="publish">Публикация</TabsTrigger>
          <TabsTrigger value="history">История изменений</TabsTrigger>
        </TabsList>

        <TabsContent value="card" className="pt-6">
          <CardEditor service={data} onSaved={load} />
        </TabsContent>

        <TabsContent value="form" className="pt-6">
          <div className="mb-3 rounded-control border border-border bg-bg px-4 py-2.5 text-[13px] text-muted">
            Пресеты — основа бизнес-режима: аналитик получает готовые шаги и
            типовые поля, затем правит их мышкой. Полноценный конструктор
            условий выпадающими списками — следующий этап; сейчас доступны
            ветвление во вкладке «Логика», формулы через поле «Expression» и
            сохранение новой версии черновика.
          </div>
          <FormConstructor
            initialSchema={data.schema}
            onSave={saveForm}
            serviceId={data.id}
          />
        </TabsContent>

        <TabsContent value="doc" className="pt-6">
          <DocTemplateEditor service={data} onSaved={load} />
        </TabsContent>

        <TabsContent value="publish" className="pt-6">
          <PublishPanel service={data} onChanged={load} />
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          <AuditLogTable serviceId={data.id} compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "published") return <Chip tone="green">Опубликована</Chip>;
  if (status === "archived") return <Chip tone="gray">В архиве</Chip>;
  return <Chip tone="amber">Черновик</Chip>;
}
