import * as React from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "blue" | "amber" | "red" | "green" | "gray" | "accent";

const TONE: Record<ChipTone, { bg: string; fg: string; dot: string }> = {
  blue: { bg: "bg-st-blue-bg", fg: "text-st-blue", dot: "bg-st-blue" },
  amber: { bg: "bg-st-amber-bg", fg: "text-st-amber", dot: "bg-st-amber" },
  red: { bg: "bg-st-red-bg", fg: "text-st-red", dot: "bg-st-red" },
  green: { bg: "bg-st-green-bg", fg: "text-st-green", dot: "bg-st-green" },
  gray: { bg: "bg-st-gray-bg", fg: "text-st-gray", dot: "bg-st-gray" },
  accent: { bg: "bg-st-green-bg", fg: "text-st-green", dot: "bg-accent" },
};

/** Status chip: dot 6px + text (constitution). */
export function Chip({
  tone = "gray",
  children,
  pulse = false,
  className,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control px-2 py-0.5 text-[12px] font-medium leading-5",
        t.bg,
        t.fg,
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          t.dot,
          pulse && "pulse-dot"
        )}
      />
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
