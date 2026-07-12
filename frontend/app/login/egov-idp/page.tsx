import Link from "next/link";
import { CheckCircle2, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function EgovIdpPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; next?: string }>;
}) {
  const params = await searchParams;
  const state = params.state ?? "";
  const next = params.next ?? "/cabinet";
  const callback = `/api/auth/egov/callback?state=${encodeURIComponent(state)}&iin=123456789012&next=${encodeURIComponent(next)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="flex size-12 items-center justify-center rounded-control bg-st-blue-bg text-st-blue">
          <Smartphone size={26} strokeWidth={1.75} />
        </div>
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-st-blue">
          eGov IDP · конкурсный мок
        </p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink">
          Подтвердите вход в eGov mobile
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Портал отправил запрос авторизации через интеграционную шину. На
          продуктивном контуре здесь будет экран eGov/mobile с одноразовым
          подтверждением.
        </p>

        <div className="mt-5 rounded-control border border-border bg-bg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={19} strokeWidth={1.75} className="mt-0.5 text-st-green" />
            <div>
              <p className="text-[14px] font-medium text-ink">Тестовый профиль</p>
              <p className="mt-1 text-[13px] text-muted">
                ИИН/БИН 123456789012 · предприниматель
              </p>
            </div>
          </div>
        </div>

        <Button asChild size="lg" className="mt-6 w-full justify-between">
          <Link href={callback}>
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} strokeWidth={1.75} />
              Подтвердить вход
            </span>
            <span>→</span>
          </Link>
        </Button>
        <p className="mt-4 text-center text-[12px] text-muted">
          <Link href="/login" className="hover:text-ink">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}
