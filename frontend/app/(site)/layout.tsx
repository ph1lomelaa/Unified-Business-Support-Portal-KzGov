import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FloatingAiAssistant } from "@/components/home/floating-ai-assistant";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/server-data";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  const notifications = user ? await getNotifications() : [];
  return (
    <>
      <Header user={user} notifications={notifications} />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* AI-помощник закреплён в правом нижнем углу на всех страницах портала */}
      <FloatingAiAssistant />
    </>
  );
}
