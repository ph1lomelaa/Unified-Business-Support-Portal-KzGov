"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ServiceCard } from "@/components/catalog/service-card";
import { useI18n } from "@/i18n/provider";
import type { DictKey } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import {
  loadNavSnapshot,
  saveNavSnapshot,
  type NavResult,
} from "@/lib/navigator-session";

type NavState = "idle" | "loading" | "done" | "error";

const EXAMPLES: DictKey[] = [
  "hero.ai.example.cattle",
  "hero.ai.example.export",
  "hero.ai.example.credit",
];

export type HeroNavigatorHandle = {
  /** Fills the query and runs the search — used by external entry points
   * (e.g. the "Часто ищут" tags) that want to jump straight to results. */
  runQuery: (text: string) => void;
};

function NavBody({ t, state, result }: { t: (k: DictKey) => string; state: NavState; result: NavResult | null }) {
  return (
    <>
      {state === "loading" && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card border border-border p-5">
              <div className="skeleton h-9 w-9 rounded-control" />
              <div className="skeleton mt-3 h-4 w-2/3" />
              <div className="skeleton mt-2 h-3 w-full" />
              <div className="skeleton mt-3 h-6 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="mt-5 rounded-control border border-border bg-bg p-4 text-[14px] text-muted">
          {t("hero.ai.error.prefix")}{" "}
          <Link href="/services" className="font-medium text-ink underline underline-offset-2 hover:text-muted">
            {t("hero.ai.error.link")}
          </Link>{" "}
          {t("hero.ai.error.suffix")}
        </div>
      )}

      {state === "done" && result && (
        <div className="mt-5">
          {result.recommendations.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.recommendations.map(({ service, reason }) => (
                  <div key={service.id} className="flex flex-col gap-2">
                    <ServiceCard service={service} />
                    {reason && (
                      <p className="px-1 text-[13px] text-muted">
                        <span className="font-medium text-fg">{t("hero.ai.why")} </span>
                        {reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 text-[12px] text-muted">
                <Info size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                {t("hero.ai.disclaimer")}
                {result.source === "fallback" && ` ${t("hero.ai.fallback")}`}
              </p>
            </>
          ) : (
            <div className="rounded-control border border-border bg-bg p-4 text-[14px] text-fg">
              {result.clarify ?? t("hero.ai.empty")}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export const HeroNavigator = React.forwardRef<HeroNavigatorHandle, { variant?: "full" | "bridge" }>(
  function HeroNavigator({ variant = "full" }, ref) {
    const { t } = useI18n();
    const [query, setQuery] = React.useState("");
    const [expanded, setExpanded] = React.useState(variant === "full");
    const [state, setState] = React.useState<NavState>("idle");
    const [result, setResult] = React.useState<NavResult | null>(null);

    // Восстанавливаем последний запрос + результаты из сессии, чтобы возврат из
    // карточки услуги/каталога показывал те же рекомендации, а не пустое поле.
    React.useEffect(() => {
      const snap = loadNavSnapshot();
      if (snap) {
        setQuery(snap.query);
        setResult(snap.result);
        setState("done");
        setExpanded(true);
      }
    }, []);

    const submit = React.useCallback(async (raw?: string) => {
      const q = (raw ?? query).trim();
      if (!q) return;
      setState("loading");
      setResult(null);
      try {
        const r = await api<NavResult>("/api/ai/navigate", {
          method: "POST",
          json: { query: q },
        });
        setResult(r);
        setState("done");
        saveNavSnapshot({ query: q, result: r }); // переживёт уход в карточку и «назад»
      } catch {
        setState("error");
      }
    }, [query]);

    React.useImperativeHandle(
      ref,
      () => ({
        runQuery(text: string) {
          setQuery(text);
          setExpanded(true);
          submit(text);
        },
      }),
      [submit]
    );

    if (variant === "bridge") {
      return (
        <div
          className={cn(
            "border-2 border-brand-green bg-white p-4 shadow-[0_18px_44px_rgba(11,122,62,0.18)] transition-[border-radius] duration-200 sm:p-5",
            expanded ? "rounded-card" : "rounded-card"
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-tight text-ink">{t("hero.ai.bridgeTitle")}</p>
              <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-muted">{t("hero.ai.bridgeHint")}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-medium text-muted">
              {t("hero.ai.badge")}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-control border border-border bg-[#F7F8F5] p-3 focus-within:border-brand-green focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(11,122,62,0.10)] sm:flex-row sm:items-center sm:p-4">
            <Search size={18} strokeWidth={1.75} className="hidden shrink-0 text-muted sm:block" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim()) setExpanded(true);
              }}
              onFocus={() => setExpanded(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={t("hero.ai.bridgePlaceholder")}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
            />
            <Button
              size="lg"
              className="h-11 shrink-0 px-6"
              onClick={() => submit()}
              disabled={state === "loading" || !query.trim()}
            >
              {state === "loading" ? t("hero.ai.loading") : t("hero.ai.bridgeSubmit")}
            </Button>
          </div>

          <div
            className={cn(
              "grid overflow-hidden transition-all duration-200 ease-in-out",
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 pt-4">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setQuery(t(ex));
                      setExpanded(true);
                    }}
                    className="rounded-full border border-st-green-bg bg-st-green-bg px-3 py-1.5 text-[13px] font-medium text-brand-green transition-colors hover:border-brand-green hover:bg-white"
                  >
                    {t(ex)}
                  </button>
                ))}
              </div>
              <div className="pb-5">
                <NavBody t={t} state={state} result={result} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Search size={18} strokeWidth={1.75} className="text-accent" />
            {t("hero.ai.title")}
          </div>
          <span className="shrink-0 rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-medium text-muted">
            {t("hero.ai.badge")}
          </span>
        </div>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={2}
          placeholder={t("hero.ai.placeholder")}
          className="resize-none text-[15px]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => submit()} disabled={state === "loading" || !query.trim()}>
            {state === "loading" ? t("hero.ai.loading") : t("hero.ai.submit")}
          </Button>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(t(ex))}
              className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted hover:border-ink hover:text-ink"
            >
              {t(ex)}
            </button>
          ))}
        </div>

        <NavBody t={t} state={state} result={result} />
      </div>
    );
  }
);
