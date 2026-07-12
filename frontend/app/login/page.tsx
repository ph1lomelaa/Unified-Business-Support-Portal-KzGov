"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  User2,
  Building2,
  Settings2,
  Loader2,
  ArrowRight,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signCmsBase64, NCALAYER_NOT_FOUND } from "@/lib/ncalayer";

const ROLE_DEST: Record<string, string> = {
  entrepreneur: "/cabinet",
  analyst: "/admin",
  admin: "/admin",
};

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [edsMsg, setEdsMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("next");
    setNext(p);
  }, []);

  function go(role: string) {
    router.push(next || ROLE_DEST[role] || "/cabinet");
    router.refresh();
  }

  async function signEds() {
    setBusy("eds");
    setEdsMsg(null);
    try {
      const { nonce } = await fetch("/bff/api/auth/nonce").then((r) => r.json());
      const cms = await signCmsBase64(nonce);
      const res = await fetch("/api/auth/eds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cms, nonce }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Ошибка проверки подписи");
      }
      go("entrepreneur");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setEdsMsg(
        msg === NCALAYER_NOT_FOUND
          ? "NCALayer не найден. Установите и запустите NCALayer, либо войдите демо-ролью ниже."
          : `Подпись не выполнена: ${msg}`
      );
    } finally {
      setBusy(null);
    }
  }

  function egovLogin() {
    const target = `/api/auth/egov/start?next=${encodeURIComponent(next || "/cabinet")}`;
    window.location.href = target;
  }

  async function demo(role: string) {
    setBusy(role);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Ошибка входа");
      go(role);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      {/* Единственная карточка входа, по центру экрана */}
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
            Вход
          </p>
          <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-ink">
            Войдите в личный кабинет
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            Через eGov mobile, ЭЦП NCALayer или демо-ролью для конкурсного просмотра.
          </p>

          <Button
            onClick={egovLogin}
            disabled={busy !== null}
            size="lg"
            className="mt-7 w-full justify-between px-5 text-[14px] font-semibold"
          >
            <span className="flex items-center gap-2">
              <Smartphone size={18} strokeWidth={1.75} />
              Войти через eGov / mobile
            </span>
            <ArrowRight size={18} strokeWidth={2} />
          </Button>

          <Button
            onClick={signEds}
            disabled={busy !== null}
            size="lg"
            variant="outline"
            className="mt-3 w-full justify-between px-5 text-[14px] font-semibold"
          >
            {busy === "eds" ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
                Подключаемся к NCALayer…
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <ShieldCheck size={18} strokeWidth={1.75} />
                  Войти через ЭЦП
                </span>
                <ArrowRight size={18} strokeWidth={2} />
              </>
            )}
          </Button>
          {edsMsg && (
            <p className="mt-3 rounded-control border border-st-amber-bg bg-st-amber-bg px-3 py-2 text-[13px] text-st-amber">
              {edsMsg}
            </p>
          )}

          <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            <span className="h-px flex-1 bg-border" />
            демо-доступ
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <DemoButton
              onClick={() => demo("entrepreneur")}
              busy={busy === "entrepreneur"}
              icon={<User2 size={18} strokeWidth={1.75} />}
              title="Предприниматель"
              sub="ТОО «AgroDala», БИН 123456789012"
            />
            <DemoButton
              onClick={() => demo("analyst")}
              busy={busy === "analyst"}
              icon={<Building2 size={18} strokeWidth={1.75} />}
              title="Аналитик ДО"
              sub="Фонд «Даму» — очередь заявок"
            />
            <DemoButton
              onClick={() => demo("admin")}
              busy={busy === "admin"}
              icon={<Settings2 size={18} strokeWidth={1.75} />}
              title="Администратор"
              sub="Конструктор услуг и аналитика"
            />
          </div>

          <p className="mt-6 text-center text-[12px] text-muted">
            <Link href="/" className="hover:text-ink">
              ← На главную
            </Link>
          </p>
        </div>
    </div>
  );
}

function DemoButton({
  onClick,
  busy,
  icon,
  title,
  sub,
}: {
  onClick: () => void;
  busy: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-brand-green hover:shadow-[var(--shadow-card)] disabled:opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-green/10 text-brand-green">
        {busy ? <Loader2 size={18} className="animate-spin" strokeWidth={1.75} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-fg">{title}</span>
        <span className="block text-[12px] text-muted">{sub}</span>
      </span>
    </button>
  );
}
