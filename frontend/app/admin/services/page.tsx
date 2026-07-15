"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Search, MoreVertical, Sparkles } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { OrgBrief, RegistryRow } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { OrgLogo } from "@/components/org-logo";
import { dateRu } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GenerateServiceDialog } from "@/components/admin/generate-service-dialog";

export default function RegistryPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<RegistryRow[] | null>(null);
  const [orgs, setOrgs] = React.useState<OrgBrief[]>([]);
  const [q, setQ] = React.useState("");
  const [orgFilter, setOrgFilter] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const [r, o] = await Promise.all([
      api<RegistryRow[]>("/api/v1/admin/services"),
      api<OrgBrief[]>("/api/v1/organizations"),
    ]);
    setRows(r);
    setOrgs(o);
  }, []);

  React.useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  const filtered = (rows ?? []).filter((r) => {
    if (orgFilter && r.org?.id !== orgFilter) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function action(
    id: string,
    verb: "publish" | "duplicate" | "archive"
  ) {
    try {
      const res = await api<{ id?: string }>(
        `/api/v1/admin/services/${id}/${verb}`,
        { method: "POST", json: {} }
      );
      if (verb === "publish") toast.success("Услуга опубликована — видна в каталоге");
      if (verb === "archive") toast.success("Услуга перемещена в архив");
      if (verb === "duplicate" && res.id) {
        toast.success("Создана копия");
        router.push(`/admin/services/${res.id}`);
        return;
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось выполнить действие");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">Реестр услуг</h1>
          <p className="mt-1 text-[14px] text-muted">
            Создавайте и публикуйте услуги в конструкторе без разработчиков.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateServiceDialog orgs={orgs}>
            <Button variant="outline">
              <Sparkles size={20} strokeWidth={1.75} />
              Сгенерировать из текста
            </Button>
          </GenerateServiceDialog>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={20} strokeWidth={1.75} />
            Новая услуга
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={18}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию"
            className="pl-9"
            aria-label="Поиск услуг"
          />
        </div>
        <Select
          value={orgFilter}
          onValueChange={setOrgFilter}
          aria-label="Фильтр по организации"
          placeholder="Все организации"
          options={orgs.map((o) => ({ value: o.id, label: `${o.shortName} — ${o.name}` }))}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[840px] text-[14px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">ДО</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-center">Версия</th>
                <th className="px-4 py-3 text-center">Заявок</th>
                <th className="px-4 py-3">Обновлена</th>
                <th className="px-4 py-3 sr-only">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="skeleton h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    {rows.length === 0
                      ? "В реестре пока нет услуг. Создайте первую или сгенерируйте из текста."
                      : "Ничего не найдено по фильтрам."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-bg">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/services/${r.id}`}
                        className="font-medium text-fg hover:text-ink hover:underline"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <OrgLogo org={r.org} size={28} />
                        <span className="text-[13px] text-muted">
                          {r.org?.shortName}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </td>
                    <td className="px-4 py-3">
                      <RowStatus status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-center num">
                      v{r.formVersion}
                      {r.activeVersion && r.activeVersion !== r.formVersion ? (
                        <span className="text-[12px] text-muted">
                          {" "}
                          (акт. v{r.activeVersion})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center num">{r.applications}</td>
                    <td className="px-4 py-3 text-muted num">
                      {dateRu(r.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu row={r} onAction={action} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgs={orgs}
        onCreated={(id) => router.push(`/admin/services/${id}`)}
      />
    </div>
  );
}

function RowStatus({ status }: { status: string }) {
  if (status === "published") return <Chip tone="green">Опубликована</Chip>;
  if (status === "archived") return <Chip tone="gray">В архиве</Chip>;
  return <Chip tone="amber">Черновик</Chip>;
}

function RowMenu({
  row,
  onAction,
}: {
  row: RegistryRow;
  onAction: (id: string, verb: "publish" | "duplicate" | "archive") => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Действия"
          className="inline-flex size-8 items-center justify-center rounded-control text-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[200px] overflow-hidden rounded-card border border-border bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          <MenuLink href={`/admin/services/${row.id}`}>Редактировать</MenuLink>
          {row.status !== "published" && (
            <MenuItem onSelect={() => onAction(row.id, "publish")}>
              Опубликовать
            </MenuItem>
          )}
          <MenuItem onSelect={() => onAction(row.id, "duplicate")}>
            Дублировать
          </MenuItem>
          {row.status !== "archived" && (
            <MenuItem onSelect={() => onAction(row.id, "archive")} danger>
              Архивировать
            </MenuItem>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
  danger,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`cursor-pointer px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-bg ${
        danger ? "text-st-red" : "text-fg"
      }`}
    >
      {children}
    </DropdownMenu.Item>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="block cursor-pointer px-3 py-2 text-[14px] text-fg outline-none data-[highlighted]:bg-bg"
      >
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  orgs,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgs: OrgBrief[];
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [orgId, setOrgId] = React.useState("");
  const [preset, setPreset] = React.useState("credit");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setOrgId(orgs[0]?.id ?? "");
      setPreset("credit");
    }
  }, [open, orgs]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !orgId) return;
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/v1/admin/services", {
        method: "POST",
        json: { title: title.trim(), orgId, preset },
      });
      toast.success("Услуга создана — открываем конструктор");
      onCreated(res.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая услуга</DialogTitle>
          <DialogDescription>
            Укажите основу услуги — конструктор откроется с готовыми шагами и
            типовыми полями для бизнес-режима.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="c-title">Название услуги</Label>
            <Input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Субсидирование ставки вознаграждения"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="c-org">Организация</Label>
            <Select
              value={orgId}
              onValueChange={setOrgId}
              placeholder="Выберите организацию"
              ariaLabel="Организация"
              allowClear={false}
              className="mt-1 w-full min-w-0"
              options={orgs.map((o) => ({ value: o.id, label: `${o.shortName} — ${o.name}` }))}
            />
          </div>
          <div>
            <Label>Шаблон</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PRESETS.map((item) => {
                const selected = preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreset(item.id)}
                    className={`min-h-[96px] rounded-card border p-3 text-left transition-colors ${
                      selected
                        ? "border-brand-green bg-st-green-bg"
                        : "border-border bg-surface hover:border-ink"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block text-[14px] font-semibold text-ink">{item.title}</span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-muted">{item.description}</span>
                      </span>
                      {selected && (
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-white">
                          <Check size={15} strokeWidth={2} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? "Создаём…" : "Создать и открыть"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PRESETS = [
  {
    id: "credit",
    title: "Кредитование",
    description: "Компания, параметры кредита, проект, документы и подписание.",
  },
  {
    id: "subsidy",
    title: "Субсидирование",
    description: "Кредитный сценарий с расчётным полем экономии.",
  },
  {
    id: "guarantee",
    title: "Гарантирование",
    description: "Размер гарантии с проверкой лимита 85% от кредита.",
  },
  {
    id: "information",
    title: "Информационная услуга",
    description: "Короткое обращение: контакты и вопрос без онлайн-подачи.",
  },
];
