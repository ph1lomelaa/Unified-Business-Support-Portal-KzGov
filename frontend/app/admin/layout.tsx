import { Masthead } from "@/components/layout/masthead";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/server-data";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";

export default async function AdminLayout({
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
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <AdminNav />
          </aside>
          <section className="min-w-0 overflow-x-clip">
            <AdminBreadcrumbs />
            {children}
          </section>
        </div>
      </main>
    </>
  );
}
