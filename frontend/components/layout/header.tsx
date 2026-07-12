"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Search, User2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useI18n } from "@/i18n/provider";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { Button } from "@/components/ui/button";
import { LangSwitcher } from "./lang-switcher";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { AccessibilityBar } from "./accessibility-bar";
import { cn } from "@/lib/utils";
import type { DictKey } from "@/i18n/dictionaries";

export type SessionUser = {
  name: string;
  role: "entrepreneur" | "analyst" | "admin";
} | null;

const NAV: { href: string; key: DictKey }[] = [
  { href: "/services", key: "nav.services" },
  { href: "/knowledge", key: "nav.knowledge" },
  { href: "/calculators", key: "nav.calculators" },
  { href: "/map", key: "nav.map" },
  { href: "/reports", key: "nav.reports" },
  { href: "/cabinet", key: "nav.cabinetFull" },
];

export function Header({
  user = null,
  notifications = [],
}: {
  user?: SessionUser;
  notifications?: NotificationItem[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = React.useState(!overlay);

  React.useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const solid = !overlay || scrolled;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 text-white transition-colors duration-200",
        solid ? "bg-ink shadow-[var(--shadow-pop)]" : "bg-ink/55 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-[88px] max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center" aria-label={t("brand.holding")}>
          <BrandLockup size="md" />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitcher onDark />
          <button
            type="button"
            aria-label="Поиск"
            className="flex size-11 items-center justify-center rounded-control border border-white/25 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Search size={20} strokeWidth={1.75} />
          </button>
          <AccessibilityBar onDark />
          {user ? (
            <>
              <NotificationBell items={notifications} />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex h-11 items-center gap-2 rounded-control border border-white/25 px-3 text-[13px] font-medium text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
                    <User2 size={18} strokeWidth={1.75} />
                    <span className="hidden max-w-[140px] truncate lg:block">
                      {user.name}
                    </span>
                    <ChevronDown size={16} strokeWidth={1.75} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-[220px] overflow-hidden rounded-card border border-border bg-surface py-1 text-fg shadow-[var(--shadow-pop)]"
                  >
                    <DropdownMenu.Item asChild>
                      <Link href="/cabinet" className="block cursor-pointer px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-bg">
                        {t("nav.cabinet")}
                      </Link>
                    </DropdownMenu.Item>
                    {(user.role === "admin" || user.role === "analyst") && (
                      <DropdownMenu.Item asChild>
                        <Link href="/admin" className="block cursor-pointer px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-bg">
                          {t("nav.admin")}
                        </Link>
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item
                      onSelect={logout}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[14px] text-st-red outline-none data-[highlighted]:bg-bg"
                    >
                      <LogOut size={16} strokeWidth={1.75} />
                      {t("nav.logout")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-11 border-white/25 bg-transparent px-4 text-white hover:border-white hover:text-white"
            >
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10">
          {(user?.role === "admin" || user?.role === "analyst") && (
            <Link
              href="/admin"
              className={cn(
                "flex h-full items-center border-b-2 px-4 text-[15px] font-semibold text-white transition-colors",
                pathname.startsWith("/admin")
                  ? "border-accent"
                  : "border-transparent text-white/72 hover:text-white"
              )}
            >
              {t("nav.admin")}
            </Link>
          )}
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-full items-center border-b-2 px-4 text-[15px] font-semibold text-white transition-colors",
                  active
                    ? "border-accent"
                    : "border-transparent text-white/72 hover:text-white"
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
