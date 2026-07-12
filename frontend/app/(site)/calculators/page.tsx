"use client";

import * as React from "react";
import { Calculator as CalcIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CalculatorWidget } from "@/components/calculators/calculator-widget";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

type CalcBrief = { slug: string; title: string; summary: string };

export default function CalculatorsPage() {
  const [list, setList] = React.useState<CalcBrief[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api<CalcBrief[]>("/api/v1/calculators")
      .then((rows) => {
        setList(rows);
        setActive((cur) => cur ?? rows[0]?.slug ?? null);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить калькуляторы"));
  }, []);

  React.useEffect(() => load(), [load]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-brand-green">
        <CalcIcon size={22} strokeWidth={1.75} />
        <span className="text-[13px] font-semibold uppercase tracking-[0.03em]">Интерактивные инструменты</span>
      </div>
      <h1 className="mt-2 text-[32px] font-bold text-ink sm:text-[40px]">Калькуляторы поддержки</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        Оцените параметры финансирования до подачи заявки. Расчёты предварительные — точные
        условия определяет финансовый оператор.
      </p>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={load} />}

      {list.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {list.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActive(c.slug)}
                className={cn(
                  "rounded-control border px-4 py-2 text-[14px] font-medium transition-colors",
                  c.slug === active
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-border bg-surface text-fg hover:border-ink"
                )}
              >
                {c.title}
              </button>
            ))}
          </div>

          <div className="mt-5">{active && <CalculatorWidget key={active} slug={active} />}</div>
        </>
      )}
    </div>
  );
}
