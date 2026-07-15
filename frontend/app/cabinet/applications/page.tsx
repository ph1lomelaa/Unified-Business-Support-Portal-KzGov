import Link from "next/link";
import { serverFetch } from "@/lib/server-data";
import type { AppListItem } from "@/lib/types";
import { ApplicationCard } from "@/components/cabinet/application-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Плоский список «все заявки» — отдельная страница /cabinet/applications
// (дашборд /cabinet группирует по статусам; здесь — единый перечень).
export default async function CabinetApplicationsPage() {
  const apps = await serverFetch<AppListItem[]>("/api/v1/applications", []);
  const sorted = [...apps].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">Мои заявки</h1>
          <p className="mt-1 text-[14px] text-muted">
            Все обращения: черновики, заявки на рассмотрении и завершённые.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/services">Подать новую заявку</Link>
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-border bg-surface p-8">
          <p className="text-[18px] font-semibold text-ink">Заявок пока нет</p>
          <p className="mt-1 max-w-xl text-[14px] text-muted">
            Начните с подбора меры поддержки — заявка появится здесь сразу после
            создания черновика.
          </p>
          <Button asChild className="mt-4">
            <Link href="/services">Подобрать меру поддержки</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {sorted.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
