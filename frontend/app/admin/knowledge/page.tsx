import Link from "next/link";
import { ArrowUpRight, BookOpenText, FileText } from "lucide-react";
import { serverFetch } from "@/lib/server-data";
import type { KnowledgeCard } from "@/lib/types";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminKnowledgePage() {
  const payload = await serverFetch<{ items: KnowledgeCard[] }>("/api/v1/knowledge", { items: [] });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">База знаний</h1>
          <p className="mt-1 text-[14px] text-muted">Материалы, которые отображаются пользователям в публичном разделе.</p>
        </div>
        <Link href="/knowledge" className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-[14px] font-medium text-fg hover:border-ink">
          <BookOpenText size={18} /> Открыть публичную базу <ArrowUpRight size={16} />
        </Link>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink">Опубликованные материалы</h2>
          <span className="text-[13px] text-muted">{payload.items.length} шт.</span>
        </div>
        {payload.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-muted">Материалы пока не добавлены.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payload.items.map((item) => (
              <li key={item.id}>
                <Link href={`/knowledge/${item.slug}`} className="flex items-center gap-3 px-5 py-4 hover:bg-bg">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-st-green-bg text-brand-green"><FileText size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-fg">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">{item.summary}</span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
