import * as React from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "blue" | "amber" | "red" | "green" | "gray" | "accent";

const TONE: Record<ChipTone, { bg: string; fg: string }> = {
  blue: { bg: "bg-st-blue-bg", fg: "text-st-blue" },
  amber: { bg: "bg-st-amber-bg", fg: "text-st-amber" },
  red: { bg: "bg-st-red-bg", fg: "text-st-red" },
  green: { bg: "bg-st-green-bg", fg: "text-st-green" },
  gray: { bg: "bg-st-gray-bg", fg: "text-st-gray" },
  accent: { bg: "bg-st-green-bg", fg: "text-st-green" },
};

/** Status chip: text-only label. */
export function Chip({
  tone = "gray",
  children,
  className,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control px-2 py-0.5 text-[12px] font-medium leading-5",
        t.bg,
        t.fg,
        className
      )}
    >
      {children}
    </span>
  );
}

/** Plain label badge without a dot (e.g. category). */
export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
