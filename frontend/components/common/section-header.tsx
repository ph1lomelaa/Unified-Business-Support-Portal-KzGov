import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  href,
  action = "Все",
  className,
}: {
  title: string;
  href?: string;
  action?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h2 className="text-[20px] font-bold uppercase tracking-[0.02em] text-ink">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.02em] text-brand-green hover:text-brand-green-hover"
          >
            {action}
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

