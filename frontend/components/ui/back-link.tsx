"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Возврат «туда, откуда пришёл»: реальная история браузера (router.back())
 * вместо жёсткого href. Уходим на раздел-fallback, если внутри приложения
 * ещё не было переходов в этой вкладке (страницу открыли по прямой ссылке /
 * в новой вкладке / пришли с внешнего сайта) — тогда router.back() увёл бы
 * из приложения или на about:blank.
 *
 * Почему флаг, а не document.referrer / history.length:
 *  - при SPA-навигации Next.js document.referrer остаётся от первичной
 *    загрузки и не отражает предыдущий внутренний маршрут;
 *  - history.length > 1 бывает и когда предыдущая запись — внешний сайт
 *    или about:blank, тогда back() уводит из приложения.
 * Поэтому помечаем факт хотя бы одного КЛИЕНТСКОГО перехода внутри портала.
 * Модульная переменная сбрасывается при полной перезагрузке документа —
 * ровно то поведение, которое нужно.
 */
let didInAppNav = false;

/** Монтируется один раз в корневом layout: ловит смены маршрута (SPA). */
export function NavigationTracker() {
  const pathname = usePathname();
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (mounted.current) {
      didInAppNav = true;
    } else {
      mounted.current = true;
    }
  }, [pathname]);
  return null;
}

export function useBackTo(fallback: string) {
  const router = useRouter();
  return React.useCallback(() => {
    if (didInAppNav && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}

export function BackLink({
  fallback,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  fallback: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const goBack = useBackTo(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1.5 text-left", className)}
    >
      {children}
    </button>
  );
}
