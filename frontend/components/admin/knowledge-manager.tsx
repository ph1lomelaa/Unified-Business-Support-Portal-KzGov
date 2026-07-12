"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpenText, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";

export type AdminKnowledgeItem = {
  id: string;
  slug: string;
  type: string;
  title: string;
  summary: string;
  body: string;
  readMinutes: number;
  relatedServiceSlugs: string[];
  downloadRef: string | null;
};

const EMPTY = { type: "article", title: "", summary: "", body: "", readMinutes: 5, related: "", downloadRef: "" };

export function KnowledgeManager({ initialItems }: { initialItems: AdminKnowledgeItem[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [editing, setEditing] = React.useState<AdminKnowledgeItem | null | undefined>(undefined);

  async function remove(item: AdminKnowledgeItem) {
    if (!window.confirm(`Удалить «${item.title}»?`)) return;
    await api(`/api/v1/admin/knowledge/${item.id}`, { method: "DELETE" });
    setItems((rows) => rows.filter((row) => row.id !== item.id));
    toast.success("Материал удалён");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">База знаний</h1>
          <p className="mt-1 text-[14px] text-muted">Материалы, шаблоны и чек-листы публичного раздела.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(null)}><Plus size={17} /> Добавить</Button>
          <Link href="/knowledge" className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-[14px] font-medium text-fg hover:border-ink">
            <BookOpenText size={18} /> Публичная база <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink">Материалы</h2>
          <span className="text-[13px] text-muted">{items.length} шт.</span>
        </div>
        {items.length === 0 ? <p className="px-5 py-10 text-center text-[14px] text-muted">Материалы пока не добавлены.</p> : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-st-green-bg text-brand-green"><FileText size={19} /></span>
                <Link href={`/knowledge/${item.slug}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[14px] font-medium text-fg">{item.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">{item.type} · {item.summary}</span>
                </Link>
                <Button variant="ghost" size="sm" aria-label={`Изменить ${item.title}`} onClick={() => setEditing(item)}><Pencil size={16} /></Button>
                <Button variant="ghost" size="sm" aria-label={`Удалить ${item.title}`} onClick={() => void remove(item)}><Trash2 size={16} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <KnowledgeDialog
        item={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(saved) => {
          setItems((rows) => [...rows.filter((row) => row.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, "ru")));
          setEditing(undefined);
        }}
      />
    </div>
  );
}

function KnowledgeDialog({ item, onClose, onSaved }: { item: AdminKnowledgeItem | null | undefined; onClose: () => void; onSaved: (item: AdminKnowledgeItem) => void }) {
  const [form, setForm] = React.useState(EMPTY);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setForm(item ? {
      type: item.type, title: item.title, summary: item.summary, body: item.body,
      readMinutes: item.readMinutes, related: item.relatedServiceSlugs.join(", "), downloadRef: item.downloadRef ?? "",
    } : EMPTY);
  }, [item]);
  if (item === undefined) return null;

  async function save() {
    if (!form.title.trim() || !form.type.trim()) return toast.error("Укажите название и тип");
    setBusy(true);
    try {
      const saved = await api<AdminKnowledgeItem>(item ? `/api/v1/admin/knowledge/${item.id}` : "/api/v1/admin/knowledge", {
        method: item ? "PATCH" : "POST",
        json: {
          type: form.type.trim(), title: form.title.trim(), summary: form.summary.trim(), body: form.body,
          readMinutes: Number(form.readMinutes) || 1,
          relatedServiceSlugs: form.related.split(",").map((value) => value.trim()).filter(Boolean),
          downloadRef: form.downloadRef.trim() || null,
        },
      });
      onSaved(saved);
      toast.success(item ? "Материал обновлён" : "Материал создан");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Изменить материал" : "Новый материал"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Название" />
          <Input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="article / checklist / template" />
          <Input className="sm:col-span-2" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Краткое описание" />
          <Textarea className="min-h-52 sm:col-span-2" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Содержание" />
          <Input type="number" min={1} value={form.readMinutes} onChange={(event) => setForm({ ...form, readMinutes: Number(event.target.value) })} placeholder="Минут чтения" />
          <Input value={form.downloadRef} onChange={(event) => setForm({ ...form, downloadRef: event.target.value })} placeholder="Код PDF-шаблона" />
          <Input className="sm:col-span-2" value={form.related} onChange={(event) => setForm({ ...form, related: event.target.value })} placeholder="Связанные услуги через запятую" />
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Отмена</Button><Button disabled={busy} onClick={() => void save()}>Сохранить</Button></div>
      </DialogContent>
    </Dialog>
  );
}
