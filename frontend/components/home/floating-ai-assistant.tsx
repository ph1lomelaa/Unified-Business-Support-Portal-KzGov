"use client";

import * as React from "react";
import { Bot, X } from "lucide-react";
import { HeroNavigator } from "@/components/home/hero-navigator";
import { cn } from "@/lib/utils";

export function FloatingAiAssistant() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex size-[60px] items-center justify-center rounded-full bg-brand-green text-white shadow-[var(--shadow-pop)] hover:bg-brand-green-hover",
          open && "hidden"
        )}
        aria-label="Помощник по мерам поддержки"
      >
        <Bot size={28} strokeWidth={1.75} />
        <span className="absolute -top-8 right-0 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white shadow-[var(--shadow-pop)]">
          Помощник
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/45 p-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:bg-transparent">
          <div className="flex h-full flex-col bg-surface shadow-[var(--shadow-pop)] sm:max-h-[82vh] sm:rounded-card sm:border sm:border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[15px] font-bold text-ink">Помощник</p>
                <p className="text-[12px] text-muted">Подбор меры поддержки</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-10 items-center justify-center rounded-control border border-border text-muted hover:text-ink"
                aria-label="Закрыть помощника"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <HeroNavigator />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
