"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

// Единый брендовый блок портала: эмблема Холдинга «Байтерек» + название.
// Портал принадлежит холдингу целиком — Даму остаётся лишь одной из
// организаций в каталоге, а не владельцем портала. Общий компонент для
// Header и Footer, чтобы шапка/подвал были одинаковыми на всех страницах.
//
// TODO: когда подложат фирменный горизонтальный логотип
// /public/brand/baiterek-logo.svg — заменить эмблему+текст на одну <Image>.
// Пока используем чистую белую эмблему, вырезанную из мастер-лого.

const SIZES = {
  sm: { emblem: 40, title: "text-[15px]", sub: "text-[11px]" },
  md: { emblem: 52, title: "text-[17px]", sub: "text-[12px]" },
  lg: { emblem: 64, title: "text-[20px]", sub: "text-[13px]" },
} as const;

export function BrandLockup({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { t } = useI18n();
  const s = SIZES[size];
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <Image
        src="/brand/baiterek-emblem-white.png"
        alt={t("brand.holding")}
        width={s.emblem}
        height={s.emblem}
        priority
        className="h-auto w-auto shrink-0 object-contain"
        style={{ width: s.emblem, height: s.emblem }}
      />
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate font-bold uppercase tracking-[0.02em] text-white", s.title)}>
          {t("brand.holding")}
        </span>
        <span className={cn("mt-0.5 block truncate font-medium text-white/60", s.sub)}>
          {t("brand.portal")}
        </span>
      </span>
    </span>
  );
}
