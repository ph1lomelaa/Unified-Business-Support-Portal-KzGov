"use client";

import * as React from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ServiceEditor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

type SchemaEl = { name?: string; type?: string; elements?: SchemaEl[]; title?: string };
type Schema = { pages?: { elements?: SchemaEl[] }[] };

function collect(schema: Schema): { answers: string[]; calc: string[] } {
  const answers: string[] = [];
  const calc: string[] = [];
  const walk = (els?: SchemaEl[]) => {
    (els ?? []).forEach((el) => {
      if (el.type === "panel") return walk(el.elements);
      if (!el.name) return;
      if (el.type === "expression") calc.push(el.name);
      else answers.push(el.name);
    });
  };
  (schema.pages ?? []).forEach((p) => walk(p.elements));
  return { answers, calc };
}

export function DocTemplateEditor({
  service,
  onSaved,
}: {
  service: ServiceEditor;
  onSaved: () => void;
}) {
  const [tpl, setTpl] = React.useState(service.docTemplate || "");
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const { answers, calc } = React.useMemo(
    () => collect(service.schema ?? {}),
    [service.schema]
  );

  const groups: { label: string; items: string[] }[] = [
    { label: "Ответы формы", items: answers.map((n) => `answers.${n}`) },
    { label: "Расчёты", items: calc.map((n) => `calc.${n}`) },
    {
      label: "Компания",
      items: ["company.name", "company.bin", "company.director", "company.address"],
    },
    { label: "Заявка", items: ["app.number", "app.date"] },
  ];

  function insert(ph: string) {
    const token = `{{${ph}}}`;
    const el = ref.current;
    if (!el) {
      setTpl((t) => t + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setTpl((t) => t.slice(0, start) + token + t.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/v1/admin/services/${service.id}`, {
        method: "PATCH",
        json: { docTemplate: tpl },
      });
      toast.success("Шаблон документа сохранён");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-semibold text-ink">
              Шаблон заявления
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Тестовый PDF — модуль M2 (генерация с фейковыми данными)")}
              >
                Тестовый PDF
              </Button>
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </div>
          <Textarea
            ref={ref}
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            rows={22}
            className="font-mono text-[13px] leading-relaxed"
            placeholder={
              "ЗАЯВЛЕНИЕ №{{app.number}} от {{app.date}}\n\nЗаявитель: {{company.name}} (БИН {{company.bin}})\nв лице директора {{company.director}}\n\nпросит предоставить субсидирование на сумму {{answers.loan_amount}} тенге.\nОжидаемая экономия: {{calc.saving}} тенге."
            }
          />
          <p className="mt-2 text-[12px] text-muted">
            Плейсхолдеры <code className="text-fg">{"{{...}}"}</code>{" "}
            подставляются из ответов заявки при генерации PDF.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="mb-3 text-[14px] font-semibold text-ink">
            Доступные плейсхолдеры
          </p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">
                  {g.label}
                </p>
                {g.items.length === 0 ? (
                  <p className="text-[12px] text-muted">
                    Нет полей — добавьте их на вкладке «Форма заявки».
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((ph) => (
                      <button
                        key={ph}
                        onClick={() => insert(ph)}
                        className="rounded-control border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg hover:border-ink hover:text-ink"
                      >
                        {`{{${ph}}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
