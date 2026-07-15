import Link from "next/link";
import { serverFetch } from "@/lib/server-data";
import { getSession } from "@/lib/session";
import type { AppListItem, ServiceCard as ServiceCardType } from "@/lib/types";
import { ApplicationCard } from "@/components/cabinet/application-card";
import { ServiceCard } from "@/components/catalog/service-card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ACTION_STATUSES = new Set(["needs_changes", "draft", "stage2_required"]);
const ACTIVE_STATUSES = new Set(["submitted", "stage2_submitted", "in_review", "resubmitted", "approved", "contract_signed", "active"]);
const DONE_STATUSES = new Set(["completed", "rejected"]);

export default async function CabinetPage() {
  const user = await getSession();
  const [apps, popular] = await Promise.all([
    serverFetch<AppListItem[]>("/api/v1/applications", []),
    serverFetch<ServiceCardType[]>("/api/v1/services", []),
  ]);
  const byUpdated = (a: AppListItem, b: AppListItem) => +new Date(b.updatedAt) - +new Date(a.updatedAt);
  const actionApps = apps.filter((a) => ACTION_STATUSES.has(a.status)).sort(byUpdated);
  const activeApps = apps.filter((a) => ACTIVE_STATUSES.has(a.status)).sort(byUpdated);
  const doneApps = apps.filter((a) => DONE_STATUSES.has(a.status)).sort(byUpdated);
  const pending = apps.filter((a) => ACTION_STATUSES.has(a.status)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">
            Здравствуйте, {user?.name?.split(" ")[0] ?? "предприниматель"}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            Ваши заявки, статусы и уведомления.
          </p>
        </div>
        {pending > 0 && (
          <Chip tone="amber">
            {pending} требуют вашего действия
          </Chip>
        )}
      </div>

      {apps.length === 0 ? (
        <EmptyApplications popular={popular} />
      ) : (
        <div className="mt-6 space-y-7">
          {actionApps.length > 0 && (
            <ApplicationGroup
              title="Требуют действия"
              hint="Завершите черновики или загрузите запрошенные документы."
              tone="amber"
              apps={actionApps}
            />
          )}
          <ApplicationGroup
            title="Активные"
            hint="Заявки на рассмотрении, одобренные решения и действующие договоры."
            apps={activeApps}
            empty="Активных заявок сейчас нет."
          />
          {doneApps.length > 0 && (
            <details className="group rounded-card border border-border bg-surface p-4" open={doneApps.length <= 2}>
              <summary className="cursor-pointer list-none text-[17px] font-semibold text-ink">
                Завершённые
                <span className="ml-2 text-[13px] font-medium text-muted group-open:hidden">показать</span>
                <span className="ml-2 hidden text-[13px] font-medium text-muted group-open:inline">скрыть</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {doneApps.map((a) => (
                  <ApplicationCard key={a.id} app={a} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationGroup({
  title,
  hint,
  apps,
  tone,
  empty,
}: {
  title: string;
  hint: string;
  apps: AppListItem[];
  tone?: "amber";
  empty?: string;
}) {
  return (
    <section
      className={
        tone === "amber"
          ? "rounded-card border border-st-amber bg-[#FFF8E8] p-4"
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
        </div>
        <span className="text-[12px] font-medium text-muted">{apps.length}</span>
      </div>
      {apps.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {apps.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </div>
      ) : (
        <p className="rounded-control border border-dashed border-border bg-surface px-4 py-6 text-center text-[14px] text-muted">
          {empty}
        </p>
      )}
    </section>
  );
}

function EmptyApplications({ popular }: { popular: ServiceCardType[] }) {
  return (
    <div className="mt-8">
      <div className="rounded-card border border-dashed border-border bg-surface p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[18px] font-semibold text-ink">Заявок пока нет</p>
            <p className="mt-1 max-w-xl text-[14px] text-muted">
              Начните с подбора меры поддержки или выберите одну из рекомендованных услуг.
            </p>
          </div>
          <Button asChild>
            <Link href="/services">Подобрать меру поддержки</Link>
          </Button>
        </div>
      </div>
      {popular.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">
            Рекомендованные услуги
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {popular.slice(0, 3).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
