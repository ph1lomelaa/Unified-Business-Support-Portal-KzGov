import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  seeAllHref,
  seeAllLabel = "Все",
  dark = false,
  className,
}: {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <h2
        className={cn(
          "text-[20px] font-bold uppercase tracking-[-0.01em]",
          dark ? "text-white" : "text-ink"
        )}
      >
        {title}
      </h2>
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-accent hover:text-accent-hover"
        >
          {seeAllLabel}
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
