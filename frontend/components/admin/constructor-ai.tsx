"use client";

import * as React from "react";
import { Check, GitBranch, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { SurveyCreator } from "survey-creator-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Точечная AI-помощь ВНУТРИ конструктора (spec REQ-22 доп.). Работает поверх
// того же SurveyCreator: читает/пишет creator.JSON. Всё — только ПРЕДЛОЖЕНИЯ с
// явным Принять/Отклонить, ничего не применяется само.

type El = { name?: string; type?: string; title?: string; elements?: El[]; visibleIf?: string };
type Page = { name?: string; title?: string; elements?: El[] };
type ProposedPage = { name: string; title?: string; elements: (El & { name: string; type: string })[] };
type BranchRule = { targetField: string; targetTitle: string; visibleIf: string; reason: string };

const CHOICE_TYPES = new Set(["radiogroup", "dropdown", "checkbox", "tagbox", "imagepicker"]);

const TYPE_LABEL: Record<string, string> = {
  text: "текст", comment: "многострочный", number: "число", dropdown: "список",
  radiogroup: "переключатель", checkbox: "флажки", boolean: "да/нет",
  file: "файл", expression: "формула", html: "текст-блок",
};

function walk(els: El[] | undefined, fn: (el: El) => void) {
  (els ?? []).forEach((el) => {
    if (el.type === "panel") walk(el.elements, fn);
    else fn(el);
  });
}

function collectNames(pages: Page[]): Set<string> {
  const names = new Set<string>();
  pages.forEach((p) => walk(p.elements, (el) => el.name && names.add(el.name)));
  return names;
}

function uniqueName(base: string, taken: Set<string>): string {
  let name = base || "page";
  let i = 2;
  while (taken.has(name)) name = `${base}_${i++}`;
  taken.add(name);
  return name;
}

export function ConstructorAi({
  creator,
  serviceId,
}: {
  creator: SurveyCreator;
  serviceId: string;
}) {
  const [busy, setBusy] = React.useState<"fields" | "branch" | null>(null);
  const [fields, setFields] = React.useState<{ pages: ProposedPage[]; source: string } | null>(null);
  const [branch, setBranch] = React.useState<{ rules: BranchRule[]; source: string; field: string } | null>(null);
  const [accepted, setAccepted] = React.useState<Set<number>>(new Set());
  const [sel, setSel] = React.useState<{ name: string; type: string } | null>(null);

  // Следим за выделенным в дизайнере элементом: ветвление доступно, только когда
  // выбрано поле с вариантами ответа.
  React.useEffect(() => {
    const sync = () => {
      const el = creator.selectedElement as unknown as { getType?: () => string; name?: string } | null;
      const type = el?.getType?.();
      const name = el?.name;
      setSel(name && type && CHOICE_TYPES.has(type) ? { name, type } : null);
    };
    creator.onSelectedElementChanged.add(sync);
    sync();
    return () => creator.onSelectedElementChanged.remove(sync);
  }, [creator]);

  async function suggestFields() {
    setBusy("fields");
    try {
      const r = await api<{ pages: ProposedPage[]; source: string }>("/api/ai/suggest-fields", {
        method: "POST",
        json: { serviceId },
      });
      if (!r.pages?.length) {
        toast.info("AI не смог предложить поля для этой услуги.");
        return;
      }
      setFields(r);
    } catch {
      toast.error("Не удалось получить предложение полей.");
    } finally {
      setBusy(null);
    }
  }

  async function suggestBranching() {
    if (!sel) return;
    setBusy("branch");
    try {
      const r = await api<{ rules: BranchRule[]; source: string }>("/api/ai/suggest-branching", {
        method: "POST",
        json: { serviceId, fieldName: sel.name, schema: creator.JSON },
      });
      if (!r.rules?.length) {
        toast.info("Подходящих правил ветвления не найдено.");
        return;
      }
      setAccepted(new Set(r.rules.map((_, i) => i)));
      setBranch({ ...r, field: sel.name });
    } catch {
      toast.error("Не удалось получить предложение ветвления.");
    } finally {
      setBusy(null);
    }
  }

  function applyFields() {
    if (!fields) return;
    const json = (creator.JSON as { pages?: Page[] }) ?? {};
    const existing = Array.isArray(json.pages) ? json.pages : [];
    const takenFields = collectNames(existing);
    const takenPages = new Set(existing.map((p) => p.name ?? ""));
    const merged: Page[] = [...existing];
    let added = 0;
    fields.pages.forEach((p) => {
      const els = p.elements.filter((e) => !takenFields.has(e.name));
      els.forEach((e) => takenFields.add(e.name));
      if (els.length) {
        merged.push({ name: uniqueName(p.name, takenPages), title: p.title, elements: els });
        added += els.length;
      }
    });
    creator.JSON = { ...json, pages: merged };
    creator.setModified();
    setFields(null);
    toast.success(
      added ? `Добавлено полей: ${added}. Проверьте и сохраните.` : "Все предложенные поля уже есть в форме."
    );
  }

  function applyBranching() {
    if (!branch) return;
    const chosen = branch.rules.filter((_, i) => accepted.has(i));
    if (!chosen.length) return;
    const json = creator.JSON as { pages?: Page[] };
    const byRule = new Map(chosen.map((r) => [r.targetField, r.visibleIf]));
    (json.pages ?? []).forEach((p) =>
      walk(p.elements, (el) => {
        if (el.name && byRule.has(el.name)) el.visibleIf = byRule.get(el.name);
      })
    );
    creator.JSON = json;
    creator.setModified();
    setBranch(null);
    toast.success(`Применено правил: ${chosen.length}. Проверьте и сохраните.`);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-st-green-bg bg-st-green-bg/40 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-brand-green">
          <Sparkles size={16} strokeWidth={1.75} />
          AI-помощь конструктору
        </span>
        <Button size="sm" variant="outline" onClick={suggestFields} disabled={busy !== null}>
          {busy === "fields" ? (
            <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
          ) : (
            <Sparkles size={16} strokeWidth={1.75} />
          )}
          Предложить поля
        </Button>
        <Button size="sm" variant="outline" onClick={suggestBranching} disabled={busy !== null || !sel}>
          {busy === "branch" ? (
            <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
          ) : (
            <GitBranch size={16} strokeWidth={1.75} />
          )}
          Предложить ветвление
        </Button>
        <span className="text-[12px] text-muted">
          {sel
            ? `Ветвление для поля «${sel.name}»`
            : "Выделите поле с вариантами ответа для подсказок по ветвлению"}
        </span>
      </div>

      {/* --- Предложение полей --- */}
      <Dialog open={!!fields} onOpenChange={(o) => !o && setFields(null)}>
        <DialogContent width={640}>
          <DialogHeader>
            <DialogTitle>AI предлагает поля формы</DialogTitle>
            <DialogDescription>
              {fields?.source === "ai"
                ? "Черновой набор полей по названию и категории услуги."
                : "Типовой набор полей по категории услуги (офлайн-шаблон)."}{" "}
              Применяются только с вашего согласия — потом доработайте и сохраните.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {fields?.pages.map((p, pi) => (
              <div key={pi} className="rounded-control border border-border p-3">
                <p className="mb-2 text-[13px] font-semibold text-ink">{p.title || p.name}</p>
                <ul className="space-y-1">
                  {p.elements.map((e) => (
                    <li key={e.name} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-fg">{e.title || e.name}</span>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {TYPE_LABEL[e.type] ?? e.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFields(null)}>
              <X size={18} strokeWidth={1.75} />
              Отклонить
            </Button>
            <Button onClick={applyFields}>
              <Check size={18} strokeWidth={1.75} />
              Принять и добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Предложение ветвления --- */}
      <Dialog open={!!branch} onOpenChange={(o) => !o && setBranch(null)}>
        <DialogContent width={640}>
          <DialogHeader>
            <DialogTitle>AI предлагает ветвление</DialogTitle>
            <DialogDescription>
              Правила «Видимость» (visibleIf) для полей, связанных с «{branch?.field}».
              {branch?.source === "rules" && " Подобрано офлайн по совпадению смысла."} Отметьте
              нужные и примите.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {branch?.rules.map((r, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 hover:border-ink"
              >
                <input
                  type="checkbox"
                  checked={accepted.has(i)}
                  onChange={(e) => {
                    setAccepted((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      return next;
                    });
                  }}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    Показывать «{r.targetTitle}»
                  </p>
                  <code className="mt-0.5 block break-all rounded bg-bg px-1.5 py-0.5 font-mono text-[12px] text-brand-green">
                    {r.visibleIf}
                  </code>
                  {r.reason && <p className="mt-1 text-[12px] text-muted">{r.reason}</p>}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBranch(null)}>
              <X size={18} strokeWidth={1.75} />
              Отклонить
            </Button>
            <Button onClick={applyBranching} disabled={accepted.size === 0}>
              <Check size={18} strokeWidth={1.75} />
              Принять выбранные ({accepted.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
