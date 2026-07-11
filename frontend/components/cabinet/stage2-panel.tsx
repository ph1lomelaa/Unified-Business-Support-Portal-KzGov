"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Model, surveyLocalization } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.css";
import "survey-core/i18n/russian";
import { Layers, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AppDetail } from "@/lib/types";
import { splitAnswers, walkElements, type SurveySchema } from "@/lib/survey-utils";
import { Button } from "@/components/ui/button";

surveyLocalization.currentLocale = "ru";

/**
 * II этап: заявитель дозаполняет расширенные данные/документы после первичной
 * подачи. Форма собирается из stage-2 страниц схемы (data-driven, без спец-кода
 * под конкретную услугу) и отправляется на /applications/{id}/stage2.
 */
export function Stage2Panel({ app }: { app: AppDetail }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const subschema = React.useMemo<SurveySchema>(
    () => ({ pages: app.stage2?.pages ?? [] }),
    [app.stage2]
  );
  const checklist = React.useMemo(
    () =>
      walkElements(subschema)
        .filter((item) => item.name && !["html", "comment", "expression"].includes(item.type ?? ""))
        .map((item) => item.title || item.name)
        .slice(0, 6),
    [subschema]
  );

  const model = React.useMemo(() => {
    const m = new Model(subschema);
    m.showNavigationButtons = false;
    m.showProgressBar = "off";
    m.showCompletedPage = false;
    m.showQuestionNumbers = "off";
    m.locale = "ru";
    return m;
  }, [subschema]);

  async function submit() {
    if (!model.validate(true, true)) {
      toast.error("Заполните обязательные поля этапа 2");
      return;
    }
    setSubmitting(true);
    const { answers, calc } = splitAnswers(subschema, model.data);
    try {
      await api(`/api/v1/applications/${app.id}/stage2`, {
        method: "POST",
        json: { answers, calc, signedBy: app.company?.director ?? null },
      });
      toast.success("Этап 2 завершён — заявка отправлена на рассмотрение");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить этап 2");
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 rounded-card border border-st-amber bg-st-amber-bg/40 p-4">
      <div className="flex items-start gap-2.5">
        <Layers
          size={20}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-st-amber"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-st-amber">
            Этап 2 · Расширенные данные и документы
          </p>
          <p className="mt-1 text-[13px] text-fg">
            Первичная заявка принята. Дозаполните расширенные сведения — после
            этого заявка уйдёт на рассмотрение.
          </p>
          {checklist.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {checklist.map((title) => (
                <div
                  key={title}
                  className="rounded-control border border-st-amber/30 bg-surface px-3 py-2 text-[12px] text-fg"
                >
                  {title}
                </div>
              ))}
            </div>
          )}

          <div className="sjs-eppb-form mt-4 rounded-card border border-border bg-surface p-2 sm:p-4">
            <Survey model={model} />
          </div>

          <Button onClick={submit} disabled={submitting} className="mt-4">
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
                Отправка…
              </>
            ) : (
              <>
                <ShieldCheck size={20} strokeWidth={1.75} />
                Отправить этап 2 на рассмотрение
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
