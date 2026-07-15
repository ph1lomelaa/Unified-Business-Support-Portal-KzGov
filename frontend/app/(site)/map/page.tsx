"use client";

import { ProjectMapLoader } from "@/components/map/project-map-loader";
import { useI18n } from "@/i18n/provider";

export default function MapPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="mb-6 max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-brand-green">
          {t("map.kicker")}
        </p>
        <h1 className="mt-2 text-[28px] font-bold uppercase tracking-[0.02em] text-ink sm:text-[40px]">{t("map.title")}</h1>
        <p className="mt-3 text-[15px] text-muted">
          {t("map.sub")}
        </p>
      </div>
      <ProjectMapLoader />
    </div>
  );
}
