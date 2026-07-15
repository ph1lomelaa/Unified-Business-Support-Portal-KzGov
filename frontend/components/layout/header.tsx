"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Search, User2, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
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
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Закрываем мобильное меню при переходе на другую страницу.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isAdmin = user?.role === "admin" || user?.role === "analyst";

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
        solid ? "bg-[#0a3a22] shadow-[var(--shadow-pop)]" : "bg-[#0a3a22]/60 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-[88px] max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center" aria-label={t("brand.holding")}>
          <BrandLockup size="md" />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitcher onDark />

          {/* Десктоп: поиск, спецверсия и меню пользователя. На мобиле всё это — в выезжающей панели ниже. */}
          <div className="hidden items-center gap-2 lg:flex">
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

          {/* Мобильный бургер — открывает выезжающую панель навигации */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Меню"
            aria-expanded={menuOpen}
            className="flex size-11 items-center justify-center rounded-control border border-white/25 text-white/90 hover:bg-white/10 lg:hidden"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="hidden border-t border-white/15 lg:block">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10">
          {(user?.role === "admin" || user?.role === "analyst") && (
            <Link
              href="/admin"
              className={cn(
                "flex h-full items-center border-b-2 px-4 text-[15px] font-semibold text-white transition-colors",
                pathname.startsWith("/admin")
                  ? "border-white"
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
                    ? "border-white"
                    : "border-transparent text-white/72 hover:text-white"
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Мобильная навигация — выезжающая панель (только < lg) */}
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col bg-[#0a3a22] text-white shadow-[var(--shadow-pop)] outline-none lg:hidden">
            <Dialog.Title className="sr-only">Навигация</Dialog.Title>
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/15 px-4">
              <span className="text-[15px] font-semibold text-white/90">{t("brand.portal")}</span>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Закрыть меню"
                  className="flex size-11 items-center justify-center rounded-control border border-white/25 text-white/90 hover:bg-white/10"
                >
                  <X size={20} strokeWidth={1.75} />
                </button>
              </Dialog.Close>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center rounded-control px-4 py-3 text-[16px] font-semibold transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
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
                      "flex items-center rounded-control px-4 py-3 text-[16px] font-semibold transition-colors",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-white/15 p-3">
              <div className="flex items-center gap-2">
                <AccessibilityBar onDark />
                {user ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-white/25 px-4 text-[15px] font-semibold text-white hover:bg-white/10"
                  >
                    <LogOut size={18} strokeWidth={1.75} />
                    {t("nav.logout")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="flex h-11 flex-1 items-center justify-center rounded-control border border-white/25 px-4 text-[15px] font-semibold text-white hover:bg-white/10"
                  >
                    {t("nav.login")}
                  </Link>
                )}
              </div>
              {user && (
                <p className="mt-3 flex items-center gap-2 px-1 text-[13px] text-white/60">
                  <User2 size={16} strokeWidth={1.75} />
                  <span className="truncate">{user.name}</span>
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
