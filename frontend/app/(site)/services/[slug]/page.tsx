import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, GraduationCap, ArrowUpRight } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { serverFetch } from "@/lib/server-data";
import type { KnowledgeCard, ServiceCard as ServiceCardType, ServiceFull } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { OrgLogo } from "@/components/org-logo";
import { EligibilityCheck } from "@/components/service/eligibility-check";
import { ApplyCard } from "@/components/service/apply-card";
import { ServiceTabs, ConditionPills } from "@/components/service/service-tabs";
import { ServiceCard } from "@/components/catalog/service-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await serverFetch<ServiceFull | null>(`/api/v1/services/${slug}`, null);
  return { title: s?.title ?? "Услуга" };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await serverFetch<ServiceFull | null>(
    `/api/v1/services/${slug}`,
    null
  );
  if (!service) notFound();

  const related = (
    await serverFetch<ServiceCardType[]>(
      `/api/v1/services?category=${service.category}`,
      []
    )
  )
    .filter((s) => s.slug !== slug)
    .slice(0, 3);

  const knowledge = (
    await serverFetch<{ items: KnowledgeCard[] }>(
      `/api/v1/knowledge?relatedTo=${slug}`,
      { items: [] }
    )
  ).items.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-[13px] text-muted">
        <BackLink fallback="/services" className="hover:text-ink">
          Услуги
        </BackLink>
        <ChevronRight size={14} strokeWidth={1.75} />
        <span className="text-fg">{service.title}</span>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <OrgLogo org={service.org} size={44} />
            <div>
              <p className="text-[13px] text-muted">{service.org?.name}</p>
              <span className="rounded-control border border-gold/40 bg-gold/10 px-2 py-0.5 text-[12px] font-medium text-ink">
                {CATEGORY_LABEL[service.category] ?? service.category}
              </span>
            </div>
          </div>

          <h1 className="mt-4 text-[30px] font-semibold leading-tight text-ink">
            {service.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">
            {service.summary}
          </p>

          {service.conditions?.length > 0 && (
            <div className="mt-6">
              <ConditionPills conditions={service.conditions} />
            </div>
          )}

          <div className="mt-8">
            <EligibilityCheck eligibility={service.eligibility} />
          </div>

          <div className="mt-8">
            <ServiceTabs service={service} />
          </div>

          {knowledge.length > 0 && (
            <div className="mt-10 rounded-card border border-border bg-surface p-5">
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
                <GraduationCap size={18} strokeWidth={1.75} className="text-brand-green" />
                Полезное по этой услуге
              </h2>
              <div className="space-y-2">
                {knowledge.map((k) => (
                  <Link
                    key={k.slug}
                    href={`/knowledge/${k.slug}`}
                    className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg px-4 py-3 transition-colors hover:border-ink"
                  >
                    <span className="text-[13px] font-medium text-fg">{k.title}</span>
                    <ArrowUpRight size={15} strokeWidth={1.75} className="shrink-0 text-muted" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-[17px] font-semibold text-ink">
                Похожие услуги
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ApplyCard slug={service.slug} />
        </aside>
      </div>
    </div>
  );
}
