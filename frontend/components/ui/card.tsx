import * as React from "react";
import { cn } from "@/lib/utils";

/** Surface card: soft shadow, 14px radius, institutional portal style. */
export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-[var(--shadow-card)]",
        hover && "card-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[17px] font-semibold text-ink", className)} {...props} />
  );
}
