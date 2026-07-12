"use client";

import * as React from "react";
import {
  Library,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  value: string;
  label: string;
  parentValue: string | null;
  sortOrder: number;
  isActive: boolean;
};

type DictMeta = {
  id: string;
  code: string;
  title: string;
  description: string;
  source: "manual" | "external";
  systemId: string | null;
  operation: string | null;
  hierarchical: boolean;
  status: string;
  lastSyncedAt: string | null;
  itemCount: number;
};

type DictDetail = DictMeta & { items: Item[] };

const ADMIN = "/api/v1/admin/dictionaries";

function SourceBadge({ source }: { source: string }) {
  const external = source === "external";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control border px-2 py-0.5 text-[11px] font-medium",
        external
          ? "border-brand-green/40 bg-st-green-bg text-brand-green"
          : "border-border bg-bg text-muted"
      )}
    >
      {external ? "внешний" : "ручной"}
    </span>
  );
}

export default function AdminDictionariesPage() {
  const [list, setList] = React.useState<DictMeta[]>([]);
  const [activeCode, setActiveCode] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<DictDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const loadList = React.useCallback(() => {
    api<DictMeta[]>(ADMIN)
      .then((rows) => {
        setList(rows);
        setActiveCode((cur) => cur ?? rows[0]?.code ?? null);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить справочники"));
  }, []);

  const loadDetail = React.useCallback((code: string) => {
    api<DictDetail>(`${ADMIN}/${code}`)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Ошибка загрузки"));
  }, []);

  React.useEffect(() => loadList(), [loadList]);
  React.useEffect(() => {
    if (activeCode) loadDetail(activeCode);
  }, [activeCode, loadDetail]);

  const refreshBoth = React.useCallback(() => {
    loadList();
    if (activeCode) loadDetail(activeCode);
  }, [loadList, loadDetail, activeCode]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[-0.01em] text-ink">
            No-code reference data
          </p>
          <h1 className="mt-2 font-display text-[34px] font-bold uppercase tracking-[-0.01em] text-ink">
            Справочники
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Единые справочники (регионы, ОКЭД, категории) настраиваются здесь без кода.
            Поля-списки в конструкторе форм ссылаются на справочник и подтягивают значения
            автоматически. Внешние справочники синхронизируются через интеграционную шину.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus size={16} strokeWidth={1.75} />
          Создать справочник
        </Button>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={loadList} />}

      {creating && (
        <CreateDictionaryCard
          onCancel={() => setCreating(false)}
          onCreated={(code) => {
            setCreating(false);
            setActiveCode(code);
            loadList();
          }}
        />
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {list.map((d) => (
            <button
              key={d.code}
              onClick={() => setActiveCode(d.code)}
              className={cn(
                "w-full rounded-card border p-3 text-left transition-colors",
                d.code === activeCode
                  ? "border-brand-green bg-st-green-bg"
                  : "border-border bg-surface hover:border-ink"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink">{d.title}</span>
                <SourceBadge source={d.source} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                <span className="font-mono">{d.code}</span>
                <span>{d.itemCount} эл.</span>
              </div>
            </button>
          ))}
        </div>

        {detail && (
          <DictionaryDetail key={detail.code} detail={detail} onChanged={refreshBoth} />
        )}
      </div>
    </div>
  );
}

function CreateDictionaryCard({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (code: string) => void;
}) {
  const [code, setCode] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    if (!code.trim() || !title.trim()) {
      toast.error("Заполните код и название");
      return;
    }
    setBusy(true);
    try {
      await api(`${ADMIN}`, { method: "POST", json: { code: code.trim(), title: title.trim() } });
      toast.success("Справочник создан");
      onCreated(code.trim());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6 border-brand-green/40">
      <CardBody>
        <CardTitle>Новый справочник</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Код (латиницей)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
              placeholder="regions"
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Название</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Регионы Казахстана"
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={create} disabled={busy}>
              {busy ? "Создаём…" : "Создать"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function DictionaryDetail({
  detail,
  onChanged,
}: {
  detail: DictDetail;
  onChanged: () => void;
}) {
  const [syncing, setSyncing] = React.useState(false);
  const external = detail.source === "external";

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api<{ applied: number; latencyMs: number | null; source: string | null }>(
        `${ADMIN}/${detail.code}/sync`,
        { method: "POST" }
      );
      toast.success(
        `Синхронизировано: ${res.applied} эл. из «${res.source ?? "реестра"}» за ${res.latencyMs ?? "?"} мс`
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Синхронизация не удалась");
    } finally {
      setSyncing(false);
    }
  };

  const deleteDictionary = async () => {
    if (!confirm(`Удалить справочник «${detail.title}» и все его значения?`)) return;
    try {
      await api(`${ADMIN}/${detail.code}`, { method: "DELETE" });
      toast.success("Справочник удалён");
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
            <div className="flex items-center gap-2">
              <Library size={18} strokeWidth={1.75} className="text-brand-green" />
              <CardTitle>{detail.title}</CardTitle>
              <SourceBadge source={detail.source} />
            </div>
            <p className="mt-1 font-mono text-[12px] text-muted">{detail.code}</p>
            {detail.description && (
              <p className="mt-2 max-w-2xl text-[13px] text-muted">{detail.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {external && (
              <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
                <RefreshCw size={15} strokeWidth={1.75} className={cn(syncing && "animate-spin")} />
                {syncing ? "Синхронизация…" : "Синхронизировать"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={deleteDictionary} aria-label="Удалить справочник">
              <Trash2 size={16} strokeWidth={1.75} className="text-st-red" />
            </Button>
          </div>
        </div>

        {external && (
          <div className="mt-3 rounded-control border border-border bg-bg px-3 py-2 text-[12px] text-muted">
            Источник: система <span className="font-mono text-ink">{detail.systemId}</span>, операция{" "}
            <span className="font-mono text-ink">{detail.operation}</span>
            {detail.lastSyncedAt && (
              <> · синхронизирован {new Date(detail.lastSyncedAt).toLocaleString("ru-RU")}</>
            )}
          </div>
        )}

        <ItemsTable detail={detail} onChanged={onChanged} />

        <div className="mt-4 rounded-control border border-dashed border-border bg-bg px-3 py-2 text-[12px] text-muted">
          В конструкторе форм: добавьте поле-список, в его свойствах выберите
          «Справочник (ЕППБ)» = <span className="font-mono text-ink">{detail.code}</span> — значения
          подтянутся автоматически и в предпросмотре, и в мастере заявки.
        </div>
      </CardBody>
    </Card>
  );
}

function ItemsTable({ detail, onChanged }: { detail: DictDetail; onChanged: () => void }) {
  const [newValue, setNewValue] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");
  const [newParent, setNewParent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState("");

  const addItem = async () => {
    if (!newValue.trim() || !newLabel.trim()) {
      toast.error("Заполните значение и подпись");
      return;
    }
    setBusy(true);
    try {
      await api(`${ADMIN}/${detail.code}/items`, {
        method: "POST",
        json: {
          value: newValue.trim(),
          label: newLabel.trim(),
          parentValue: detail.hierarchical && newParent.trim() ? newParent.trim() : null,
        },
      });
      setNewValue("");
      setNewLabel("");
      setNewParent("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось добавить");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (item: Item) => {
    try {
      await api(`${ADMIN}/items/${item.id}`, { method: "PATCH", json: { label: editLabel } });
      setEditId(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  };

  const toggleActive = async (item: Item) => {
    try {
      await api(`${ADMIN}/items/${item.id}`, { method: "PATCH", json: { isActive: !item.isActive } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const removeItem = async (item: Item) => {
    try {
      await api(`${ADMIN}/items/${item.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось удалить");
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Значения ({detail.items.length})</p>
      </div>

      <div className="overflow-hidden rounded-card border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-bg text-[11px] uppercase tracking-[0.03em] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Значение</th>
              <th className="px-3 py-2 font-medium">Подпись</th>
              {detail.hierarchical && <th className="px-3 py-2 font-medium">Родитель</th>}
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-ink">{item.value}</td>
                <td className="px-3 py-2 text-ink">
                  {editId === item.id ? (
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-8 w-full rounded-control border border-border bg-surface px-2 text-[13px]"
                      autoFocus
                    />
                  ) : (
                    item.label
                  )}
                </td>
                {detail.hierarchical && (
                  <td className="px-3 py-2 font-mono text-muted">{item.parentValue ?? "—"}</td>
                )}
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(item)}
                    className={cn(
                      "rounded-control border px-2 py-0.5 text-[11px] font-medium",
                      item.isActive
                        ? "border-brand-green/40 bg-st-green-bg text-brand-green"
                        : "border-border bg-bg text-muted"
                    )}
                  >
                    {item.isActive ? "активен" : "скрыт"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {editId === item.id ? (
                      <>
                        <button onClick={() => saveEdit(item)} aria-label="Сохранить" className="text-brand-green">
                          <Check size={16} strokeWidth={2} />
                        </button>
                        <button onClick={() => setEditId(null)} aria-label="Отмена" className="text-muted">
                          <X size={16} strokeWidth={2} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditId(item.id);
                            setEditLabel(item.label);
                          }}
                          aria-label="Изменить"
                          className="text-muted hover:text-ink"
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => removeItem(item)}
                          aria-label="Удалить"
                          className="text-muted hover:text-st-red"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {detail.items.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={detail.hierarchical ? 5 : 4} className="px-3 py-6 text-center text-muted">
                  Пусто.{" "}
                  {detail.source === "external"
                    ? "Нажмите «Синхронизировать», чтобы загрузить из внешнего реестра."
                    : "Добавьте первое значение ниже."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inline add-row */}
      <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="text-[12px] font-medium text-muted">Значение (код)</span>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="almaty"
            className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-muted">Подпись</span>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="г. Алматы"
            className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
          />
        </label>
        <Button size="sm" onClick={addItem} disabled={busy}>
          <Plus size={16} strokeWidth={1.75} />
          Добавить
        </Button>
      </div>
      {detail.hierarchical && (
        <label className="mt-2 block max-w-xs">
          <span className="text-[12px] font-medium text-muted">Родитель (для каскада)</span>
          <input
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            placeholder="код родительского значения"
            className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
          />
        </label>
      )}
    </div>
  );
}
