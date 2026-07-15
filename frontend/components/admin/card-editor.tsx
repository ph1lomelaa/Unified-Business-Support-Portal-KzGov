"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  Condition,
  FaqItem,
  ServiceDoc,
  ServiceEditor,
} from "@/lib/types";
import { CATEGORY_LABEL, CATEGORIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

export function CardEditor({
  service,
  onSaved,
}: {
  service: ServiceEditor;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(service.title);
  const [summary, setSummary] = React.useState(service.summary);
  const [description, setDescription] = React.useState(service.description);
  const [category, setCategory] = React.useState(service.category);
  const [reviewDays, setReviewDays] = React.useState(service.reviewDays);
  const [conditions, setConditions] = React.useState<Condition[]>(
    service.conditions ?? []
  );
  const [documents, setDocuments] = React.useState<ServiceDoc[]>(
    service.documents ?? []
  );
  const [faq, setFaq] = React.useState<FaqItem[]>(service.faq ?? []);
  const [bizSize, setBizSize] = React.useState(
    (service.tags?.bizSize ?? []).join(", ")
  );
  const [industries, setIndustries] = React.useState(
    (service.tags?.industries ?? []).join(", ")
  );
  const [regions, setRegions] = React.useState(
    (service.tags?.regions ?? []).join(", ")
  );
  const [busy, setBusy] = React.useState(false);

  const splitTags = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/v1/admin/services/${service.id}`, {
        method: "PATCH",
        json: {
          title,
          summary,
          description,
          category,
          reviewDays: Number(reviewDays) || 5,
          conditions,
          documents,
          faq,
          tags: {
            bizSize: splitTags(bizSize),
            industries: splitTags(industries),
            regions: splitTags(regions),
          },
        },
      });
      toast.success("Карточка сохранена");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="e-title">Название</Label>
              <Input
                id="e-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="e-summary">Краткое описание (для карточки)</Label>
              <Textarea
                id="e-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="1–2 предложения для карточки в каталоге"
              />
            </div>
            <div>
              <Label htmlFor="e-desc">Полное описание</Label>
              <Textarea
                id="e-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="mt-1"
                placeholder="Markdown допускается"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="e-cat">Категория</Label>
                <Select
                  value={category}
                  onValueChange={setCategory}
                  placeholder="Выберите категорию"
                  ariaLabel="Категория"
                  allowClear={false}
                  className="mt-1 w-full min-w-0"
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                />
              </div>
              <div>
                <Label htmlFor="e-days">Срок рассмотрения (раб. дней)</Label>
                <Input
                  id="e-days"
                  type="number"
                  min={1}
                  value={reviewDays}
                  onChange={(e) => setReviewDays(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <ArrayEditor
          title="Условия (плашки)"
          hint="Ключевые цифры условий — ставка, сумма, срок"
          items={conditions}
          onAdd={() => setConditions([...conditions, { label: "", value: "" }])}
          onRemove={(i) => setConditions(conditions.filter((_, x) => x !== i))}
          render={(c, i) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                value={c.label}
                placeholder="Ставка"
                onChange={(e) =>
                  setConditions(
                    conditions.map((x, xi) =>
                      xi === i ? { ...x, label: e.target.value } : x
                    )
                  )
                }
              />
              <Input
                value={c.value}
                placeholder="7%"
                onChange={(e) =>
                  setConditions(
                    conditions.map((x, xi) =>
                      xi === i ? { ...x, value: e.target.value } : x
                    )
                  )
                }
              />
            </div>
          )}
        />

        <ArrayEditor
          title="Документы"
          hint="auto = получим автоматически по БИН"
          items={documents}
          onAdd={() => setDocuments([...documents, { name: "", auto: false }])}
          onRemove={(i) => setDocuments(documents.filter((_, x) => x !== i))}
          render={(d, i) => (
            <div className="flex items-center gap-2">
              <Input
                value={d.name}
                placeholder="Справка об отсутствии задолженности"
                onChange={(e) =>
                  setDocuments(
                    documents.map((x, xi) =>
                      xi === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
              />
              <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={!!d.auto}
                  onChange={(e) =>
                    setDocuments(
                      documents.map((x, xi) =>
                        xi === i ? { ...x, auto: e.target.checked } : x
                      )
                    )
                  }
                />
                авто
              </label>
            </div>
          )}
        />

        <ArrayEditor
          title="FAQ"
          items={faq}
          onAdd={() => setFaq([...faq, { q: "", a: "" }])}
          onRemove={(i) => setFaq(faq.filter((_, x) => x !== i))}
          render={(f, i) => (
            <div className="space-y-2">
              <Input
                value={f.q}
                placeholder="Вопрос"
                onChange={(e) =>
                  setFaq(faq.map((x, xi) => (xi === i ? { ...x, q: e.target.value } : x)))
                }
              />
              <Textarea
                value={f.a}
                rows={2}
                placeholder="Ответ"
                onChange={(e) =>
                  setFaq(faq.map((x, xi) => (xi === i ? { ...x, a: e.target.value } : x)))
                }
              />
            </div>
          )}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <CardBody className="space-y-3">
            <p className="text-[13px] font-semibold text-ink">
              Теги для подбора и фильтров
            </p>
            <div>
              <Label htmlFor="t-size">Размер бизнеса</Label>
              <Input
                id="t-size"
                value={bizSize}
                onChange={(e) => setBizSize(e.target.value)}
                placeholder="micro, small, medium"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="t-ind">Отрасли</Label>
              <Input
                id="t-ind"
                value={industries}
                onChange={(e) => setIndustries(e.target.value)}
                placeholder="agro, manufacturing"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="t-reg">Регионы</Label>
              <Input
                id="t-reg"
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                placeholder="Костанайская область"
                className="mt-1"
              />
            </div>
            <p className="text-[12px] text-muted">
              Через запятую. Пусто = доступно всем.
            </p>
          </CardBody>
        </Card>

        <div className="sticky top-24">
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "Сохраняем…" : "Сохранить карточку"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ArrayEditor<T>({
  title,
  hint,
  items,
  onAdd,
  onRemove,
  render,
}: {
  title: string;
  hint?: string;
  items: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-ink">{title}</p>
            {hint && <p className="text-[12px] text-muted">{hint}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus size={16} strokeWidth={1.75} />
            Добавить
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="rounded-control border border-dashed border-border py-4 text-center text-[13px] text-muted">
            Пусто
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">{render(item, i)}</div>
                <button
                  onClick={() => onRemove(i)}
                  aria-label="Удалить"
                  className="mt-1 rounded-control p-1.5 text-muted hover:bg-st-red-bg hover:text-st-red"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
