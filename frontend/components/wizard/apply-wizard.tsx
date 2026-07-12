"use client";

import * as React from "react";
import Link from "next/link";
import { Model, surveyLocalization } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.css";
import "survey-core/i18n/russian";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSearch,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE } from "@/lib/api";
import type { ServiceFull } from "@/lib/types";
import {
  splitAnswers,
  pageHasField,
  stage1Pages,
  stage2Pages,
  type SurveySchema,
} from "@/lib/survey-utils";
import { Button } from "@/components/ui/button";
import { SummarySidebar, type StepState } from "./summary-sidebar";
import { EdsModal } from "./eds-modal";
import { attachWizardAiHelp } from "./wizard-ai-help";
import { dateRu } from "@/lib/format";
import { cn } from "@/lib/utils";

surveyLocalization.currentLocale = "ru";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PREFILL_MAP: Record<string, string> = {
  company_name: "name",
  director: "director",
  region: "region",
};

type SubmitResult = {
  number: string;
  statusLabel: string;
  reviewDays: number;
  multistage?: boolean;
};

type CheckIssue = {
  field: string;
  title: string;
  severity: "error" | "warn";
  message: string;
  suggestion?: string;
};

type CheckResult = {
  ok: boolean;
  summary: string;
  issues: CheckIssue[];
  advice: string[];
  filled: number;
  total: number;
  source: string;
};

export function ApplyWizard({
  service,
  userBin,
}: {
  service: ServiceFull;
  userBin?: string | null;
}) {
  const schema = (service.form ?? { pages: [] }) as SurveySchema;
  // Первичная подача проходит только по страницам I этапа; страницы stage=2
  // (расширенные данные) собираются позже из личного кабинета.
  const pages = stage1Pages(schema);
  const hasStage2 = stage2Pages(schema).length > 0;
  const slug = service.slug;
  const draftKey = `eppb_draft_${slug}`;

  const model = React.useMemo(() => {
    const m = new Model({ ...schema, pages });
    m.showNavigationButtons = false;
    m.showProgressBar = "off";
    m.showCompletedPage = false;
    m.showQuestionNumbers = "off";
    m.locale = "ru";
    m.textUpdateMode = "onBlur"; // значение текстовых полей фиксируется на потере фокуса
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Встроенные AI-помощники поля (объяснение, проактивные подсказки, onBlur-проверка).
  // Полностью асинхронны — не блокируют переходы между шагами (spec 6.6, item 5).
  React.useEffect(() => {
    return attachWizardAiHelp(model, {
      serviceId: service.id,
      serviceTitle: service.title,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewIndex = pages.length;
  const [step, setStep] = React.useState(0);
  const [economy, setEconomy] = React.useState<number | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const draftId = React.useRef<string | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // BIN prefill
  const [prefill, setPrefill] = React.useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [prefillError, setPrefillError] = React.useState<string | null>(null);

  // review / submit
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [consents, setConsents] = React.useState([false, false]);
  const [edsOpen, setEdsOpen] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);

  // ---- restore draft / prefill bin ----
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          data?: Record<string, unknown>;
          draftId?: string;
        };
        if (saved.data) model.data = saved.data;
        if (saved.draftId) draftId.current = saved.draftId;
      }
    } catch {
      /* ignore */
    }
    if (userBin && !model.getValue("bin")) model.setValue("bin", userBin);
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recompute() {
    const val = model.getValue("saving");
    setEconomy(typeof val === "number" ? val : null);
  }

  // ---- autosave (debounced 800ms) ----
  React.useEffect(() => {
    const handler = () => {
      recompute();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(persist, 800);
    };
    model.onValueChanged.add(handler);
    return () => {
      model.onValueChanged.remove(handler);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist() {
    const data = model.data as Record<string, unknown>;
    const { answers, calc } = splitAnswers(schema, data);
    const bin = String(model.getValue("bin") ?? "");
    try {
      if (!draftId.current && /^\d{12}$/.test(bin)) {
        const res = await api<{ id: string }>("/api/v1/applications", {
          method: "POST",
          json: { serviceId: service.id, companyBin: bin, answers },
        });
        draftId.current = res.id;
      }
      if (draftId.current) {
        await api(`/api/v1/applications/${draftId.current}`, {
          method: "PATCH",
          json: { answers, calc },
        });
      }
      localStorage.setItem(
        draftKey,
        JSON.stringify({ data, draftId: draftId.current })
      );
      setSavedAt(new Date());
    } catch {
      /* offline-tolerant: keep localStorage copy */
      localStorage.setItem(
        draftKey,
        JSON.stringify({ data, draftId: draftId.current })
      );
      setSavedAt(new Date());
    }
  }

  // ---- BIN prefill ----
  async function findCompany() {
    const bin = String(model.getValue("bin") ?? "").trim();
    if (!/^\d{12}$/.test(bin)) {
      setPrefill("error");
      setPrefillError("Введите БИН/ИИН из 12 цифр");
      return;
    }
    setPrefill("loading");
    setPrefillError(null);
    await sleep(1200); // имитация запроса в ГБД ЮЛ
    try {
      const c = await api<Record<string, string>>(
        `/api/v1/integrations/egov/company/${bin}`,
        { method: "POST" }
      );
      Object.entries(PREFILL_MAP).forEach(([field, src]) => {
        const q = model.getQuestionByName(field);
        if (q) {
          model.setValue(field, c[src]);
          q.readOnly = true;
        }
      });
      setPrefill("done");
      persist();
    } catch (e) {
      setPrefill("error");
      setPrefillError(
        e instanceof Error ? e.message : "Компания не найдена. Демо-БИН: 123456789012"
      );
    }
  }

  function unlockFields() {
    Object.keys(PREFILL_MAP).forEach((field) => {
      const q = model.getQuestionByName(field);
      if (q) q.readOnly = false;
    });
    setPrefill("idle");
  }

  // ---- navigation ----
  React.useEffect(() => {
    if (step < pages.length) model.currentPageNo = step;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === reviewIndex) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function next() {
    if (step < pages.length) {
      const page = model.currentPage;
      if (page && page.hasErrors(true, true)) return;
      setStep(step + 1);
    }
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }

  // AI-проверка полноты/ошибок заявки перед подписанием (spec 6.6).
  async function runCheck(): Promise<CheckResult> {
    const { answers } = splitAnswers(schema, model.data);
    return api<CheckResult>("/api/ai/check-application", {
      method: "POST",
      json: { serviceId: service.id, answers },
    });
  }

  async function loadPreview() {
    const { answers, calc } = splitAnswers(schema, model.data);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/services/${slug}/preview-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            answers,
            calc,
            bin: String(model.getValue("bin") ?? ""),
          }),
        }
      );
      const blob = await res.blob();
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setPdfUrl(null);
    }
  }

  // Called by the EDS modal after signing. Throws on failure so the modal
  // can revert and let the user retry.
  async function submit() {
    const { answers, calc } = splitAnswers(schema, model.data);
    const bin = String(model.getValue("bin") ?? "");
    try {
      if (!draftId.current) {
        const res = await api<{ id: string }>("/api/v1/applications", {
          method: "POST",
          json: { serviceId: service.id, companyBin: bin, answers },
        });
        draftId.current = res.id;
      }
      const res = await api<SubmitResult>(
        `/api/v1/applications/${draftId.current}/submit`,
        {
          method: "POST",
          json: {
            answers,
            calc,
            consents,
            signedBy: String(model.getValue("director") ?? ""),
          },
        }
      );
      localStorage.removeItem(draftKey);
      setEdsOpen(false);
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить заявку");
      throw e;
    }
  }

  if (!pages.length) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-muted">
        Для этой услуги ещё не собрана форма заявки.
      </div>
    );
  }

  if (result) return <SuccessScreen result={result} />;

  const steps: StepState[] = [
    ...pages.map((p, i) => ({
      title: p.title || p.name || `Шаг ${i + 1}`,
      done: step > i,
      active: step === i,
    })),
    { title: "Проверка и подпись", done: false, active: step === reviewIndex },
  ];
  const onBinPage = step < pages.length && pageHasField(pages[step], "bin");

  return (
    <div>
      <WizardProgress steps={steps} />
      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          {step < pages.length ? (
            <>
              {onBinPage && (
                <BinPanel
                  status={prefill}
                  error={prefillError}
                  onFind={findCompany}
                  onUnlock={unlockFields}
                />
              )}
              <div className="sjs-eppb-form rounded-card border border-border bg-surface p-2 sm:p-4">
                <Survey model={model} />
              </div>
            </>
          ) : (
            <ReviewStep
              pdfUrl={pdfUrl}
              consents={consents}
              setConsents={setConsents}
              onSign={() => setEdsOpen(true)}
              multistage={hasStage2}
              runCheck={runCheck}
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft size={20} strokeWidth={1.75} />
              Назад
            </Button>
            {step < pages.length ? (
              <Button onClick={next}>
                Далее
                <ArrowRight size={20} strokeWidth={1.75} />
              </Button>
            ) : null}
          </div>
        </div>

        <SummarySidebar
          serviceTitle={service.title}
          org={service.org}
          steps={steps}
          economy={economy}
          savedAt={savedAt}
        />
      </div>

      <EdsModal open={edsOpen} onOpenChange={setEdsOpen} onSigned={submit} />
    </div>
  );
}

function WizardProgress({ steps }: { steps: StepState[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li
          key={i}
          className={cn(
            "flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-[13px] font-medium",
            s.done
              ? "border-st-green-bg bg-st-green-bg text-st-green"
              : s.active
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-muted"
          )}
        >
          <span className={cn("tabular-nums", s.active && "text-gold")}>
            {i + 1}.
          </span>
          <span className="hidden sm:inline">{s.title}</span>
        </li>
      ))}
    </ol>
  );
}

function BinPanel({
  status,
  error,
  onFind,
  onUnlock,
}: {
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  onFind: () => void;
  onUnlock: () => void;
}) {
  return (
    <div className="mb-4 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
          <Building2 size={20} strokeWidth={1.75} />
          Автозаполнение по БИН
        </div>
        <Button size="sm" onClick={onFind} disabled={status === "loading"}>
          {status === "loading" ? (
            <>
              <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
              Запрашиваем ГБД ЮЛ…
            </>
          ) : (
            "Найти компанию"
          )}
        </Button>
      </div>
      {status === "done" && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-control bg-st-green-bg px-3 py-2 text-[13px] text-st-green">
          <span>Данные получены из госреестра. Проверьте актуальность.</span>
          <button
            onClick={onUnlock}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            Данные неверны?
          </button>
        </div>
      )}
      {status === "error" && error && (
        <p className="mt-3 rounded-control bg-st-red-bg px-3 py-2 text-[13px] text-st-red">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  pdfUrl,
  consents,
  setConsents,
  onSign,
  multistage,
  runCheck,
}: {
  pdfUrl: string | null;
  consents: boolean[];
  setConsents: (c: boolean[]) => void;
  onSign: () => void;
  multistage?: boolean;
  runCheck: () => Promise<CheckResult>;
}) {
  const both = consents[0] && consents[1];
  return (
    <div className="space-y-4">
      <AiCheckPanel runCheck={runCheck} />

      <div className="rounded-card border border-border bg-surface p-4">
        <p className="mb-3 text-[14px] font-semibold text-ink">
          Предпросмотр заявления
        </p>
        {pdfUrl ? (
          <iframe
            title="Предпросмотр PDF"
            src={pdfUrl}
            className="h-[440px] w-full rounded-control border border-border"
          />
        ) : (
          <div className="skeleton h-[440px] w-full" />
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <label className="flex cursor-pointer items-start gap-2.5 py-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={consents[0]}
            onChange={(e) => setConsents([e.target.checked, consents[1]])}
            className="mt-0.5"
          />
          <span>
            Подтверждаю достоверность указанных сведений и приложенных документов.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 py-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={consents[1]}
            onChange={(e) => setConsents([consents[0], e.target.checked])}
            className="mt-0.5"
          />
          <span>
            Согласен на сбор и обработку персональных данных для рассмотрения
            заявки.
          </span>
        </label>

        <Button
          onClick={onSign}
          disabled={!both}
          className="mt-3 w-full"
          size="lg"
        >
          <ShieldCheck size={20} strokeWidth={1.75} />
          {multistage ? "Подписать и подать первичную заявку" : "Подписать и отправить"}
        </Button>
        <p className="mt-2 text-center text-[12px] text-muted">
          {multistage
            ? "После первичной подачи в личном кабинете нужно будет добавить расширенные сведения."
            : "Подпись через NCALayer (ЭЦП). Без NCALayer — демо-подпись."}
        </p>
      </div>
    </div>
  );
}

function AiCheckPanel({ runCheck }: { runCheck: () => Promise<CheckResult> }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<CheckResult | null>(null);

  async function check() {
    setLoading(true);
    try {
      setResult(await runCheck());
    } catch {
      toast.error("Не удалось выполнить проверку");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <FileSearch size={18} strokeWidth={1.75} className="text-accent" />
          Проверка заявки
        </div>
        <Button size="sm" variant="outline" onClick={check} disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
              Проверяем…
            </>
          ) : (
            "Проверить перед отправкой"
          )}
        </Button>
      </div>
      {!result && !loading && (
        <p className="mt-2 text-[13px] text-muted">
          Проверим полноту, диапазоны значений и условия программы (например,
          правило 70%) до подписания — чтобы заявку не вернули на доработку.
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-control px-3 py-2.5 text-[13px]",
              result.ok
                ? "bg-st-green-bg text-st-green"
                : "bg-st-amber-bg text-st-amber"
            )}
          >
            {result.ok ? (
              <CheckCircle2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium">{result.summary}</p>
              <p className="mt-0.5 text-[12px] opacity-80">
                Заполнено {result.filled} из {result.total} полей.
              </p>
            </div>
          </div>

          {result.issues.length > 0 && (
            <ul className="space-y-2">
              {result.issues.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-control border border-border px-3 py-2"
                >
                  <AlertTriangle
                    size={16}
                    strokeWidth={1.75}
                    className={cn(
                      "mt-0.5 shrink-0",
                      it.severity === "error" ? "text-st-red" : "text-st-amber"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] text-fg">{it.message}</p>
                    {it.suggestion && (
                      <p className="mt-0.5 text-[12px] text-muted">
                        {it.suggestion}
                      </p>
                    )}
                    {it.field === "cattle_amount" && (
                      <Link
                        href="/knowledge/rule-70-percent"
                        target="_blank"
                        className="mt-1 inline-block text-[12px] font-medium text-brand-green underline underline-offset-2 hover:text-brand-green-hover"
                      >
                        Почему так? →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {result.advice.length > 0 && (
            <div className="rounded-control bg-st-blue-bg/50 px-3 py-2.5">
              <p className="text-[12px] font-medium text-st-blue">Рекомендации</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-fg">
                {result.advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ result }: { result: SubmitResult }) {
  const due = new Date();
  let added = 0;
  while (added < result.reviewDays) {
    due.setDate(due.getDate() + 1);
    if (due.getDay() !== 0 && due.getDay() !== 6) added++;
  }
  const multistage = result.multistage;
  return (
    <div className="mx-auto max-w-lg rounded-card border border-border bg-surface p-8 text-center">
      <div
        className={cn(
          "mx-auto flex size-16 items-center justify-center rounded-full",
          multistage ? "bg-st-amber-bg" : "bg-st-green-bg"
        )}
      >
        <CheckCircle2
          size={36}
          strokeWidth={1.75}
          className={multistage ? "text-st-amber" : "text-st-green"}
        />
      </div>
      <h2 className="mt-4 text-[22px] font-semibold text-ink">
        {multistage
          ? `Первичная заявка ${result.number} принята`
          : `Заявка ${result.number} подана`}
      </h2>
      {multistage ? (
        <p className="mt-2 text-[14px] text-muted">
          Первичная заявка сохранена. Следующий шаг —{" "}
          <span className="font-medium text-ink">
            расширенные сведения и документы
          </span>{" "}
          — доступен в личном кабинете. После него заявка уйдёт на рассмотрение.
        </p>
      ) : (
        <p className="mt-2 text-[14px] text-muted">
          Решение до {dateRu(due)} ({result.reviewDays} рабочих дней). Уведомим об
          изменении статуса.
        </p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/cabinet">
            {multistage ? "Добавить сведения" : "В личный кабинет"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
