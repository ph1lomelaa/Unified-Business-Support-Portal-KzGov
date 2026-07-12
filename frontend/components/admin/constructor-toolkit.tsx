"use client";

import * as React from "react";
import {
  Blocks,
  GitBranch,
  Plus,
  Sigma,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { SurveyCreator } from "survey-creator-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Инструменты конструктора «для бизнес-аналитика»: условия видимости
// выпадающими списками (без ручного visibleIf), готовые пресеты полей и
// сборщик формул. Всё работает поверх того же SurveyCreator (читает/пишет
// creator.JSON), результат — стандартная схема SurveyJS (движок сменяемый).

type Choice = { value: string; text: string };
type El = {
  name?: string;
  type?: string;
  title?: string;
  choices?: unknown;
  elements?: El[];
  visibleIf?: string;
  // SurveyJS questions carry many optional props (validators, min/max,
  // expression, choicesByUrl, ...) — allow them without enumerating each.
  [key: string]: unknown;
};
type Page = { name?: string; title?: string; elements?: El[] };
type FieldInfo = { name: string; type: string; title: string; choices: Choice[] };

const NUMERICISH = new Set(["number", "expression"]);

function walk(els: El[] | undefined, fn: (el: El) => void) {
  (els ?? []).forEach((el) => {
    if (el.type === "panel") walk(el.elements, fn);
    else fn(el);
  });
}

function normChoices(raw: unknown): Choice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) =>
    c && typeof c === "object"
      ? {
          value: String((c as Choice).value ?? (c as Choice).text ?? ""),
          text: String((c as Choice).text ?? (c as Choice).value ?? ""),
        }
      : { value: String(c), text: String(c) }
  );
}

function readFields(creator: SurveyCreator): FieldInfo[] {
  const json = (creator.JSON as { pages?: Page[] }) ?? {};
  const out: FieldInfo[] = [];
  (json.pages ?? []).forEach((p) =>
    walk(p.elements, (el) => {
      if (el.name && el.type)
        out.push({
          name: el.name,
          type: el.type,
          title: el.title || el.name,
          choices: normChoices(el.choices),
        });
    })
  );
  return out;
}

function fmtVal(v: string): string {
  const t = v.trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? t : `'${t.replace(/'/g, "\\'")}'`;
}

// ------------------------------------------------------------- condition builder
type Op = "=" | "<>" | ">" | "<" | ">=" | "<=" | "contains" | "empty" | "notempty";
type Cond = { field: string; op: Op; value: string };

const OP_LABEL: Record<Op, string> = {
  "=": "равно",
  "<>": "не равно",
  ">": "больше",
  "<": "меньше",
  ">=": "больше или равно",
  "<=": "меньше или равно",
  contains: "содержит",
  empty: "не заполнено",
  notempty: "заполнено",
};

const NO_VALUE: Set<Op> = new Set(["empty", "notempty"]);

function condExpr(c: Cond): string | null {
  if (!c.field) return null;
  const f = `{${c.field}}`;
  if (c.op === "empty") return `${f} empty`;
  if (c.op === "notempty") return `${f} notempty`;
  if (!c.value.trim()) return null;
  if (c.op === "contains") return `${f} contains ${fmtVal(c.value)}`;
  return `${f} ${c.op} ${fmtVal(c.value)}`;
}

function ConditionBuilder({
  creator,
  onClose,
}: {
  creator: SurveyCreator;
  onClose: () => void;
}) {
  const fields = React.useMemo(() => readFields(creator), [creator]);
  const [target, setTarget] = React.useState("");
  const [combine, setCombine] = React.useState<"and" | "or">("and");
  const [conds, setConds] = React.useState<Cond[]>([{ field: "", op: "=", value: "" }]);

  const fieldByName = React.useMemo(
    () => new Map(fields.map((f) => [f.name, f])),
    [fields]
  );

  const expr = React.useMemo(() => {
    const parts = conds.map(condExpr).filter(Boolean) as string[];
    return parts.join(` ${combine} `);
  }, [conds, combine]);

  const setCond = (i: number, patch: Partial<Cond>) =>
    setConds((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const apply = (clear = false) => {
    if (!target) {
      toast.error("Выберите поле, для которого настраиваем видимость");
      return;
    }
    if (!clear && !expr) {
      toast.error("Добавьте хотя бы одно условие");
      return;
    }
    const json = (creator.JSON as { pages?: Page[] }) ?? {};
    let touched = false;
    (json.pages ?? []).forEach((p) =>
      walk(p.elements, (el) => {
        if (el.name === target) {
          el.visibleIf = clear ? undefined : expr;
          touched = true;
        }
      })
    );
    if (!touched) {
      toast.error("Поле не найдено в схеме");
      return;
    }
    creator.JSON = json;
    creator.setModified();
    onClose();
    toast.success(
      clear ? "Условие снято — поле показывается всегда." : "Условие видимости применено."
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent width={680}>
        <DialogHeader>
          <DialogTitle>Условие видимости поля</DialogTitle>
          <DialogDescription>
            Показывать поле только когда выполняются условия. Собирается списками — без
            ручного синтаксиса; на выходе — стандартный visibleIf.
          </DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="text-[12px] font-medium text-muted">Показывать поле</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
          >
            <option value="">— выберите поле —</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.title} ({f.name})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="text-muted">когда</span>
          <div className="inline-flex overflow-hidden rounded-control border border-border">
            {(["and", "or"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCombine(mode)}
                className={cn(
                  "px-3 py-1 text-[12px] font-medium",
                  combine === mode ? "bg-brand-green text-white" : "bg-surface text-fg"
                )}
              >
                {mode === "and" ? "все условия" : "любое условие"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {conds.map((c, i) => {
            const src = fieldByName.get(c.field);
            const showValue = !NO_VALUE.has(c.op);
            return (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_150px_1fr_auto]">
                <select
                  value={c.field}
                  onChange={(e) => setCond(i, { field: e.target.value, value: "" })}
                  className="h-10 w-full rounded-control border border-border bg-surface px-2 text-[13px] text-ink"
                >
                  <option value="">поле…</option>
                  {fields
                    .filter((f) => f.name !== target)
                    .map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.title}
                      </option>
                    ))}
                </select>
                <select
                  value={c.op}
                  onChange={(e) => setCond(i, { op: e.target.value as Op })}
                  className="h-10 w-full rounded-control border border-border bg-surface px-2 text-[13px] text-ink"
                >
                  {(Object.keys(OP_LABEL) as Op[]).map((op) => (
                    <option key={op} value={op}>
                      {OP_LABEL[op]}
                    </option>
                  ))}
                </select>
                {showValue ? (
                  src && src.choices.length ? (
                    <select
                      value={c.value}
                      onChange={(e) => setCond(i, { value: e.target.value })}
                      className="h-10 w-full rounded-control border border-border bg-surface px-2 text-[13px] text-ink"
                    >
                      <option value="">значение…</option>
                      {src.choices.map((ch) => (
                        <option key={ch.value} value={ch.value}>
                          {ch.text}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={c.value}
                      onChange={(e) => setCond(i, { value: e.target.value })}
                      placeholder="значение"
                      className="h-10 w-full rounded-control border border-border bg-surface px-3 text-[13px] text-ink"
                    />
                  )
                ) : (
                  <span className="text-[12px] text-muted">—</span>
                )}
                <button
                  onClick={() => setConds((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={conds.length === 1}
                  aria-label="Удалить условие"
                  className="text-muted hover:text-st-red disabled:opacity-30"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConds((prev) => [...prev, { field: "", op: "=", value: "" }])}
          >
            <Plus size={15} strokeWidth={1.75} />
            Добавить условие
          </Button>
        </div>

        {expr && (
          <div className="mt-3 rounded-control border border-border bg-bg p-2">
            <p className="text-[11px] uppercase tracking-[0.03em] text-muted">visibleIf</p>
            <code className="mt-1 block break-all font-mono text-[12px] text-brand-green">{expr}</code>
          </div>
        )}

        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => apply(true)}>
            Снять условие
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              <X size={18} strokeWidth={1.75} />
              Отмена
            </Button>
            <Button onClick={() => apply(false)}>Применить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- presets
type Preset = {
  id: string;
  label: string;
  hint: string;
  page?: Page; // whole page (e.g. БИН-панель)
  field?: El; // single field appended to the last page
};

const PRESETS: Preset[] = [
  {
    id: "bin-panel",
    label: "БИН-панель",
    hint: "Идентификатор заявителя с проверкой формата + название и руководитель",
    page: {
      name: "company",
      title: "О компании",
      elements: [
        {
          type: "text",
          name: "bin",
          title: "БИН/ИИН",
          isRequired: true,
          validators: [{ type: "regex", regex: "^[0-9]{12}$", text: "12 цифр" }],
        } as El,
        { type: "text", name: "company_name", title: "Наименование компании", isRequired: true } as El,
        { type: "text", name: "director", title: "Первый руководитель", isRequired: true } as El,
      ],
    },
  },
  {
    id: "loan-amount",
    label: "Сумма займа",
    hint: "Числовое поле, ₸",
    field: { type: "number", name: "loan_amount", title: "Сумма займа, ₸", isRequired: true, min: 1000000 } as El,
  },
  {
    id: "loan-term",
    label: "Срок",
    hint: "Срок в месяцах",
    field: { type: "number", name: "loan_term", title: "Срок, мес", isRequired: true, min: 1, max: 120 } as El,
  },
  {
    id: "doc-upload",
    label: "Загрузка документа",
    hint: "Поле файла",
    field: { type: "file", name: "document_upload", title: "Подтверждающий документ", storeDataAsText: false } as El,
  },
  {
    id: "region-dict",
    label: "Регион (справочник)",
    hint: "Список из справочника «Регионы» — значения подтягиваются автоматически",
    field: {
      type: "dropdown",
      name: "region",
      title: "Регион",
      isRequired: true,
      dictionaryCode: "regions",
      choicesByUrl: { url: "/bff/api/v1/dictionaries/regions/items" },
    } as El,
  },
  {
    id: "consent",
    label: "Согласие на обработку ПДн",
    hint: "Обязательный флажок согласия",
    field: {
      type: "boolean",
      name: "pdn_consent",
      title: "Согласен на обработку персональных данных",
      isRequired: true,
    } as El,
  },
];

function insertPreset(creator: SurveyCreator, preset: Preset) {
  const json = (creator.JSON as { pages?: Page[] }) ?? {};
  const pages: Page[] = Array.isArray(json.pages) ? json.pages : [];
  const taken = new Set<string>();
  pages.forEach((p) => walk(p.elements, (el) => el.name && taken.add(el.name)));

  if (preset.page) {
    const els = preset.page.elements?.filter((e) => e.name && !taken.has(e.name)) ?? [];
    if (!els.length) {
      toast.info("Поля этого пресета уже есть в форме.");
      return;
    }
    const pageName = pages.some((p) => p.name === preset.page!.name)
      ? `${preset.page.name}_2`
      : preset.page.name;
    pages.push({ name: pageName, title: preset.page.title, elements: els });
  } else if (preset.field) {
    if (preset.field.name && taken.has(preset.field.name)) {
      toast.info("Такое поле уже есть в форме.");
      return;
    }
    if (!pages.length) pages.push({ name: "application", title: "Заявка", elements: [] });
    const last = pages[pages.length - 1];
    last.elements = [...(last.elements ?? []), preset.field];
  }
  creator.JSON = { ...json, pages };
  creator.setModified();
  toast.success(`Вставлено: «${preset.label}». Проверьте и сохраните.`);
}

function PresetPicker({
  creator,
  onClose,
}: {
  creator: SurveyCreator;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent width={560}>
        <DialogHeader>
          <DialogTitle>Готовые блоки</DialogTitle>
          <DialogDescription>
            Типовые поля портала поддержки бизнеса. Вставляются в форму одним кликом — потом
            переименуйте и настройте.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => insertPreset(creator, p)}
              className="rounded-control border border-border bg-surface p-3 text-left transition-colors hover:border-brand-green"
            >
              <p className="text-[13px] font-semibold text-ink">{p.label}</p>
              <p className="mt-1 text-[12px] text-muted">{p.hint}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Готово
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- formula picker
function FormulaPicker({
  creator,
  onClose,
}: {
  creator: SurveyCreator;
  onClose: () => void;
}) {
  const fields = React.useMemo(
    () => readFields(creator).filter((f) => NUMERICISH.has(f.type)),
    [creator]
  );
  const [expr, setExpr] = React.useState("");
  const [name, setName] = React.useState("calc_result");
  const [title, setTitle] = React.useState("Расчёт");
  const [currency, setCurrency] = React.useState(true);

  const append = (t: string) => setExpr((e) => (e ? `${e} ${t}` : t));

  const insert = () => {
    if (!expr.trim()) {
      toast.error("Соберите формулу");
      return;
    }
    if (!name.trim()) {
      toast.error("Укажите имя поля результата");
      return;
    }
    const json = (creator.JSON as { pages?: Page[] }) ?? {};
    const pages: Page[] = Array.isArray(json.pages) ? json.pages : [];
    const taken = new Set<string>();
    pages.forEach((p) => walk(p.elements, (el) => el.name && taken.add(el.name)));
    if (taken.has(name)) {
      toast.error("Поле с таким именем уже есть");
      return;
    }
    if (!pages.length) pages.push({ name: "calc", title: "Расчёт", elements: [] });
    const last = pages[pages.length - 1];
    const el: El = {
      type: "expression",
      name: name.trim(),
      title: title.trim() || name.trim(),
      expression: expr.trim(),
      ...(currency ? { displayStyle: "currency", currency: "KZT" } : { displayStyle: "decimal" }),
    } as El;
    last.elements = [...(last.elements ?? []), el];
    creator.JSON = { ...json, pages };
    creator.setModified();
    onClose();
    toast.success("Расчётное поле добавлено.");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent width={620}>
        <DialogHeader>
          <DialogTitle>Расчётное поле (формула)</DialogTitle>
          <DialogDescription>
            Автоматический расчёт из других полей. Кликайте поля и операторы — на выходе
            обычное expression-поле SurveyJS.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-control border border-border bg-bg p-2">
          <code className="block min-h-[24px] break-all font-mono text-[13px] text-brand-green">
            {expr || "формула появится здесь"}
          </code>
        </div>

        <div className="mt-3">
          <p className="text-[12px] font-medium text-muted">Поля</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {fields.length === 0 && (
              <span className="text-[12px] text-muted">
                Нет числовых полей — сначала добавьте поля «число».
              </span>
            )}
            {fields.map((f) => (
              <button
                key={f.name}
                onClick={() => append(`{${f.name}}`)}
                className="rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-fg hover:border-brand-green"
              >
                {f.title}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {["+", "-", "*", "/", "(", ")"].map((op) => (
            <button
              key={op}
              onClick={() => append(op)}
              className="h-9 w-9 rounded-control border border-border bg-surface font-mono text-[14px] text-ink hover:border-brand-green"
            >
              {op}
            </button>
          ))}
          <button
            onClick={() => setExpr("")}
            className="ml-auto h-9 rounded-control border border-border bg-surface px-3 text-[12px] text-muted hover:text-st-red"
          >
            Очистить
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Имя поля (латиницей)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 font-mono text-[13px] text-ink"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Заголовок</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-ink"
            />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={currency} onChange={(e) => setCurrency(e.target.checked)} />
          Показывать как сумму в тенге (₸)
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
            Отмена
          </Button>
          <Button onClick={insert}>Добавить поле</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------- toolbar
export function ConstructorToolkit({ creator }: { creator: SurveyCreator }) {
  const [open, setOpen] = React.useState<"cond" | "preset" | "formula" | null>(null);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface px-3 py-2.5">
        <span className="text-[13px] font-medium text-ink">
          Инструменты аналитика
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen("preset")}>
          <Blocks size={16} strokeWidth={1.75} />
          Готовые блоки
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen("cond")}>
          <GitBranch size={16} strokeWidth={1.75} />
          Условие видимости
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen("formula")}>
          <Sigma size={16} strokeWidth={1.75} />
          Формула
        </Button>
      </div>

      {open === "cond" && <ConditionBuilder creator={creator} onClose={() => setOpen(null)} />}
      {open === "preset" && <PresetPicker creator={creator} onClose={() => setOpen(null)} />}
      {open === "formula" && <FormulaPicker creator={creator} onClose={() => setOpen(null)} />}
    </>
  );
}
