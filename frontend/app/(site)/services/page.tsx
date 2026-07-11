import { serverFetch } from "@/lib/server-data";
import { getT } from "@/i18n/server";
import type { OrgBrief, Region, ServiceCard as ServiceCardType } from "@/lib/types";
import { ServiceCard } from "@/components/catalog/service-card";
import { SupportNavigator } from "@/components/catalog/support-navigator";
import { SearchX } from "lucide-react";

export const dynamic = "force-dynamic";

const ALLOWED = ["category", "org", "bizSize", "industry", "region", "q"];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  ALLOWED.forEach((k) => {
    const v = sp[k];
    if (typeof v === "string" && v) qs.set(k, v);
  });

  const [services, orgs, regions, t] = await Promise.all([
    serverFetch<ServiceCardType[]>(`/api/v1/services?${qs.toString()}`, []),
    serverFetch<OrgBrief[]>("/api/v1/organizations", []),
    serverFetch<Region[]>("/api/v1/map/regions", []),
    getT(),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-ink">{t("catalog.title")}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {services.length} {t("catalog.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <SupportNavigator orgs={orgs} regions={regions} />

        {services.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-surface p-12 text-center">
            <SearchX
              size={40}
              strokeWidth={1.5}
              className="mx-auto text-muted"
            />
            <p className="mt-3 text-[15px] font-medium text-ink">
              {t("catalog.empty")}
            </p>
            <p className="mt-1 text-[14px] text-muted">
              {t("catalog.empty.hint")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
