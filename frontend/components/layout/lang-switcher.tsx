"use client";

import { useI18n } from "@/i18n/provider";
import { Select } from "@/components/ui/select";

const LABEL = {
  ru: "Рус",
  kk: "Қаз",
} as const;

export function LangSwitcher({ onDark = false }: { onDark?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Select
      value={locale}
      onValueChange={(value) => setLocale(value as keyof typeof LABEL)}
      placeholder={t("lang.switch")}
      ariaLabel={t("lang.switch")}
      allowClear={false}
      options={(["ru", "kk"] as const).map((item) => ({ value: item, label: LABEL[item] }))}
      className={onDark ? "h-11 min-w-20 border-white/25 bg-white text-ink" : "h-11 min-w-20"}
    />
  );
}
