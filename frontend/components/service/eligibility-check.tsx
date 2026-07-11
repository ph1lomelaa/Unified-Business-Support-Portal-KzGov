"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import type { Eligibility } from "@/lib/types";
import { evaluateEligibility, type EligibilityVerdict } from "@/lib/eligibility";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n/dictionaries";

const OPT_LABELS: Record<string, DictKey> = {
  micro: "service.opt.micro",
  small: "service.opt.small",
  medium: "service.opt.medium",
  large: "service.opt.large",
  manufacturing: "service.opt.manufacturing",
  agro: "service.opt.agro",
  trade: "service.opt.trade",
  services: "service.opt.services",
};

export function EligibilityCheck({
  eligibility,
}: {
  eligibility: Eligibility;
}) {
  const { t } = useI18n();
  const questions = eligibility?.questions ?? [];
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [verdict, setVerdict] = React.useState<EligibilityVerdict | null>(null);

  if (questions.length === 0) return null;

  const allAnswered = questions.every((q) => answers[q.id]);

  function evaluate() {
    setVerdict(evaluateEligibility(eligibility, answers));
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={20} strokeWidth={1.75} className="text-ink" />
        <h3 className="text-[15px] font-semibold text-ink">
          {t("service.eligibility.title")}
        </h3>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {t("service.eligibility.hint")}
      </p>

      <div className="mt-4 space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="mb-2 text-[13px] font-medium text-fg">{q.q}</p>
            <div className="flex flex-wrap gap-2">
              {q.opts.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.id]: opt }));
                    setVerdict(null);
                  }}
                  className={
                    "rounded-control border px-3 py-1.5 text-[13px] transition-colors " +
                    (answers[q.id] === opt
                      ? "border-ink bg-ink text-white"
                      : "border-border text-fg hover:border-ink")
                  }
                >
                  {OPT_LABELS[opt] ? t(OPT_LABELS[opt]) : opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={evaluate}
        disabled={!allAnswered}
        variant="outline"
        className="mt-4"
      >
        {t("service.eligibility.cta")}
      </Button>

      {verdict?.kind === "yes" && (
        <div className="mt-4 flex items-start gap-2 rounded-control border border-st-green-bg bg-st-green-bg p-3 text-[13px] text-st-green">
          <CheckCircle2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t("service.eligibility.yesStrong")}</p>
            <p className="text-st-green/80">
              {t("service.eligibility.final")}
            </p>
          </div>
        </div>
      )}
      {verdict?.kind === "no" && (
        <div className="mt-4 flex items-start gap-2 rounded-control border border-st-red-bg bg-st-red-bg p-3 text-[13px] text-st-red">
          <XCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {verdict.why ?? t("service.eligibility.maybeNo")}
            </p>
            {verdict.alt && (
              <Link
                href={`/services/${verdict.alt}`}
                className="mt-1 inline-block font-medium underline underline-offset-2"
              >
                {t("service.eligibility.alt")}
              </Link>
            )}
            <p className="mt-1 text-st-red/80">{t("service.eligibility.final")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
