import Link from "next/link";
import { Masthead } from "@/components/layout/masthead";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/server-data";
import { Button } from "@/components/ui/button";
import { CabinetNav } from "@/components/cabinet/cabinet-nav";

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  const notifications = user ? await getNotifications() : [];

  return (
    <>
      <Masthead />
      <Header user={user} notifications={notifications} />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-6">
        {user ? (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-5 lg:self-start">
              <CabinetNav />
            </aside>
            <section className="min-w-0">{children}</section>
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-card border border-border bg-surface p-8 text-center">
            <h1 className="text-[20px] font-semibold text-ink">
              Войдите в личный кабинет
            </h1>
            <p className="mt-2 text-[14px] text-muted">
              Заявки, статусы и уведомления доступны после входа как
              предприниматель.
            </p>
            <Button asChild className="mt-5">
              <Link href="/login">Войти</Link>
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
