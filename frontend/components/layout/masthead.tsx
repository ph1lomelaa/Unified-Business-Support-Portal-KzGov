"use client";

import { useI18n } from "@/i18n/provider";

export function Masthead() {
  const { t } = useI18n();
  return (
    <div className="h-8 bg-ink text-white/70">
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-4 text-[12px] sm:px-6">
        <span className="truncate">{t("masthead.group")}</span>
        <span className="shrink-0">{t("masthead.support")}</span>
      </div>
    </div>
  );
}
