import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileInput,
  Inbox,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { serverFetch } from "@/lib/server-data";
import type { QueueItem, RegistryRow } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { OrgLogo } from "@/components/org-logo";
import { StatusChip } from "@/components/status-chip";
import { dateRu } from "@/lib/format";

export const dynamic = "force-dynamic";

const ATTENTION_STATUSES = new Set(["in_review", "stage2_submitted", "resubmitted"]);

export default async function AdminOverviewPage() {
  const [services, applications] = await Promise.all([
    serverFetch<RegistryRow[]>("/api/v1/admin/services", []),
    serverFetch<QueueItem[]>("/api/v1/admin/applications", []),
  ]);

  const published = services.filter((service) => service.status === "published").length;
  const today = new Date().toDateString();
  const submittedToday = applications.filter(
    (application) => new Date(application.createdAt).toDateString() === today
  ).length;
  const needsAttention = applications.filter(
    (application) => ATTENTION_STATUSES.has(application.status) && application.sla?.overdue
  ).length;
  const reviewed = applications.filter((application) => application.sla?.elapsed !== undefined);
  const averageDays = reviewed.length
    ? (reviewed.reduce((sum, application) => sum + (application.sla?.elapsed ?? 0), 0) / reviewed.length).toFixed(1)
    : "-";
  const attentionRows = applications
    .filter((application) => ATTENTION_STATUSES.has(application.status))
    .sort((a, b) => Number(Boolean(b.sla?.overdue)) - Number(Boolean(a.sla?.overdue)))
    .slice(0, 5);
  const recentServices = [...services]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 4);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">Обзор</h1>
          <p className="mt-1 text-[14px] text-muted">
            Рабочая сводка по реестру мер поддержки и очереди заявок.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/services">
            <Plus size={20} strokeWidth={1.75} />
            Создать услугу
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile figure={published} label="услуг опубликовано" icon={ClipboardCheck} />
        <StatTile figure={submittedToday} label="заявок поступило сегодня" icon={Inbox} />
        <StatTile figure={needsAttention} label="требуют внимания" icon={TriangleAlert} tone="attention" />
        <StatTile figure={averageDays} label="средний срок обработки, дней" icon={Clock3} />
      </div>

      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-ink">Быстрые действия</h2>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <QuickAction
            href="/admin/services"
            icon={Plus}
            title="Создать услугу"
            description="Открыть конструктор новой меры поддержки."
          />
          <QuickAction
            href="/admin/imports"
            icon={FileInput}
            title="Проверить импорт"
            description="Посмотреть источники и записи, ожидающие проверки."
          />
          <QuickAction
            href="/admin/applications"
            icon={Inbox}
            title="Очередь заявок"
            description="Перейти к рассмотрению поступивших заявок."
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">Очередь требует внимания</h2>
              <p className="mt-0.5 text-[13px] text-muted">Заявки на рассмотрении и повторно поданные.</p>
            </div>
            <Link href="/admin/applications" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-green hover:underline">
              Вся очередь <ArrowRight size={16} />
            </Link>
          </div>
          {attentionRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-muted">
              В очереди нет заявок, требующих действий.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {attentionRows.map((application) => (
                <li key={application.id}>
                  <Link href="/admin/applications" className="flex items-center gap-3 px-5 py-3.5 hover:bg-bg">
                    <OrgLogo org={application.org} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">{application.service?.title ?? "Услуга не указана"}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{application.number} · {application.company?.name ?? "Компания не указана"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip status={application.status} />
                      {application.sla && (
                        <p className={application.sla.overdue ? "mt-1 text-[12px] font-medium text-st-red" : "mt-1 text-[12px] text-muted"}>
                          {application.sla.overdue ? "SLA просрочен" : `осталось ${application.sla.remaining} дн.`}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[16px] font-semibold text-ink">Изменения в реестре</h2>
            <Link href="/admin/services" className="text-[13px] font-medium text-brand-green hover:underline">Реестр</Link>
          </div>
          <ul className="divide-y divide-border">
            {recentServices.map((service) => (
              <li key={service.id}>
                <Link href={`/admin/services/${service.id}`} className="block px-5 py-3.5 hover:bg-bg">
                  <p className="truncate text-[14px] font-medium text-fg">{service.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[12px] text-muted">{dateRu(service.updatedAt)}</span>
                    <ServiceStatus status={service.status} />
                  </div>
                </Link>
              </li>
            ))}
            {recentServices.length === 0 && (
              <li className="px-5 py-10 text-center text-[14px] text-muted">В реестре пока нет услуг.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  figure,
  label,
  icon: Icon,
  tone,
}: {
  figure: number | string;
  label: string;
  icon: typeof Inbox;
  tone?: "attention";
}) {
  return (
    <Card className={tone === "attention" ? "border-st-amber/40 bg-st-amber-bg" : ""}>
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="stat-figure">{figure}</p>
          <p className="mt-1 text-[13px] text-muted">{label}</p>
        </div>
        <Icon size={20} className={tone === "attention" ? "text-st-amber" : "text-muted"} strokeWidth={1.75} />
      </div>
    </Card>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Inbox;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-ink">
      <Icon size={20} className="text-brand-green" strokeWidth={1.75} />
      <p className="mt-4 flex items-center justify-between text-[15px] font-semibold text-ink">
        {title} <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
      </p>
      <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>
    </Link>
  );
}

function ServiceStatus({ status }: { status: string }) {
  if (status === "published") return <Chip tone="green">Опубликована</Chip>;
  if (status === "archived") return <Chip tone="gray">В архиве</Chip>;
  return <Chip tone="amber">Черновик</Chip>;
}
