import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { serverFetch } from "@/lib/server-data";
import type { AppDetail } from "@/lib/types";
import { StatusChip } from "@/components/status-chip";
import { StatusTimeline } from "@/components/cabinet/status-timeline";
import { AppDetailView } from "@/components/cabinet/app-detail-view";
import { OrgLogo } from "@/components/org-logo";
import { dateRu } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await serverFetch<AppDetail | null>(
    `/api/v1/applications/${id}`,
    null
  );
  if (!app) notFound();

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-[13px] text-muted">
        <BackLink fallback="/cabinet" className="hover:text-ink">
          Кабинет
        </BackLink>
        <ChevronRight size={14} strokeWidth={1.75} />
        <span className="num text-fg">{app.number}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <OrgLogo org={app.org} size={44} />
          <div>
            <h1 className="text-[22px] font-semibold text-ink">
              {app.service?.title}
            </h1>
            <p className="num text-[13px] text-muted">
              {app.number} · подана {dateRu(app.createdAt)}
            </p>
          </div>
        </div>
        <StatusChip status={app.status} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 lg:order-1">
          <AppDetailView app={app} />
        </div>
        <aside className="lg:order-2">
          <div className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-ink">
              Ход рассмотрения
            </h2>
            <StatusTimeline
              events={app.events}
              status={app.status}
              sla={app.sla}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
