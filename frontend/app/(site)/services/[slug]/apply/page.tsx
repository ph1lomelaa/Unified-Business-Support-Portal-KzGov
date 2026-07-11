import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { serverFetch } from "@/lib/server-data";
import { getSession } from "@/lib/session";
import type { ServiceFull } from "@/lib/types";
import { ApplyWizardLoader } from "@/components/wizard/apply-wizard-loader";
import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
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

  await getSession();
  const store = await cookies();
  let userBin: string | null = null;
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    userBin = decodeSession(raw)?.bin ?? null;
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6">
      <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-muted">
        <BackLink fallback="/services" className="hover:text-ink">
          Услуги
        </BackLink>
        <ChevronRight size={14} strokeWidth={1.75} />
        <Link href={`/services/${slug}`} className="hover:text-ink">
          {service.title}
        </Link>
        <ChevronRight size={14} strokeWidth={1.75} />
        <span className="text-fg">Заявка</span>
      </nav>
      <h1 className="mb-1 text-[24px] font-semibold text-ink">
        Подача заявки
      </h1>
      <p className="mb-6 text-[14px] text-muted">
        {service.title} · {service.org?.name}
      </p>
      <ApplyWizardLoader service={service} userBin={userBin} />
    </div>
  );
}
