import Link from "next/link";
import { Clock, FileCheck2, Phone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApplyCard({ slug }: { slug: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <Button asChild size="lg" className="h-14 w-full justify-between px-5 text-[15px] font-semibold">
        <Link href={`/services/${slug}/apply`}>
          Подать заявку
          <span aria-hidden>→</span>
        </Link>
      </Button>

      <ul className="mt-4 space-y-2.5 text-[13px] text-muted">
        <li className="flex items-center gap-2">
          <Clock size={18} strokeWidth={1.75} className="text-accent" />≈ 15 минут
          на подачу
        </li>
        <li className="flex items-center gap-2">
          <FileCheck2 size={18} strokeWidth={1.75} className="text-accent" />
          12 полей — остальное заполним по БИН
        </li>
      </ul>

      <div className="mt-4 border-t border-border pt-4">
        <a
          href="tel:1408"
          className="flex items-center gap-2 text-[13px] font-medium text-fg hover:text-ink"
        >
          <Phone size={18} strokeWidth={1.75} />
          Поддержка предпринимателей — 1408
        </a>
        <Link
          href="/#navigator"
          className="mt-2 flex items-center gap-2 text-[13px] font-medium text-ink hover:underline"
        >
          <Search size={18} strokeWidth={1.75} />
          Подобрать другую меру поддержки
        </Link>
      </div>
    </div>
  );
}
