"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock, Download } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { api, ApiError } from "@/lib/api";
import type { KnowledgeDetail, ServiceCard } from "@/lib/types";
import { MarkdownLite } from "@/lib/markdown-lite";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DictKey } from "@/i18n/dictionaries";

const TYPE_LABEL_KEY: Record<string, DictKey> = {
  article: "knowledge.type.article",
  checklist: "knowledge.type.checklist",
  template: "knowledge.type.template",
  guide: "knowledge.type.guide",
};

export default function KnowledgeDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { t } = useI18n();
  const [item, setItem] = React.useState<KnowledgeDetail | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [related, setRelated] = React.useState<ServiceCard[]>([]);

  React.useEffect(() => {
    api<KnowledgeDetail>(`/api/v1/knowledge/${slug}`)
      .then((r) => setItem(r))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setItem(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Неизвестная ошибка");
        }
      });
  }, [slug]);

  React.useEffect(() => {
    if (!item?.relatedServiceSlugs?.length) {
      setRelated([]);
      return;
    }
    Promise.all(
      item.relatedServiceSlugs.map((s) =>
        api<ServiceCard>(`/api/v1/services/${s}`).catch(() => null)
      )
    ).then((rows) => setRelated(rows.filter((r): r is ServiceCard => Boolean(r))));
  }, [item]);

  if (item === null) notFound();

  if (error) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!item) {
    return <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6" />;
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
      <BackLink
        fallback="/knowledge"
        className="text-[13px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        {t("knowledge.detail.back")}
      </BackLink>

      <div className="mt-5 flex items-center gap-3">
        <span className="rounded-control bg-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted">
          {t(TYPE_LABEL_KEY[item.type] ?? "knowledge.type.article")}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <Clock size={13} strokeWidth={1.75} />
          <span className="num">
            {item.readMinutes} {t("knowledge.card.minutes")}
          </span>
        </span>
      </div>

      <h1 className="mt-3 text-[30px] font-bold text-ink">{item.title}</h1>
      <p className="mt-2 text-[15px] text-muted">{item.summary}</p>

      {item.downloadRef && (
        <a
          href={`/bff/api/v1/knowledge/${item.slug}/download`}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-ink px-4 text-[13px] font-semibold text-white hover:bg-ink/90"
        >
          <Download size={16} strokeWidth={1.75} />
          {t("knowledge.detail.download")}
        </a>
      )}

      <div className="mt-6">
        {item.type === "checklist" ? (
          <>
            <MarkdownLite
              text={item.body}
              renderBullet={(content, index) => (
                <ChecklistItem slug={item.slug} index={index} content={content} />
              )}
            />
            <p className="mt-3 text-[12px] text-muted">{t("knowledge.checklist.saved")}</p>
          </>
        ) : (
          <MarkdownLite text={item.body} />
        )}
      </div>

      {related.length > 0 && (
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">
            {t("knowledge.detail.relatedTitle")}
          </p>
          <div className="mt-3 space-y-2">
            {related.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}/apply`}
                className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3 transition-colors hover:border-ink"
              >
                <span className="text-[14px] font-medium text-fg">
                  {t("knowledge.detail.applyCta")} {s.title}
                </span>
                <ArrowUpRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  slug,
  index,
  content,
}: {
  slug: string;
  index: number;
  content: string;
}) {
  const storageKey = `eppb-checklist-${slug}`;
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const state: Record<number, boolean> = raw ? JSON.parse(raw) : {};
      setChecked(Boolean(state[index]));
    } catch {
      // localStorage unavailable — checklist just won't persist.
    }
  }, [index, storageKey]);

  function toggle() {
    setChecked((prev) => {
      const next = !prev;
      try {
        const raw = window.localStorage.getItem(storageKey);
        const state: Record<number, boolean> = raw ? JSON.parse(raw) : {};
        state[index] = next;
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 transition-colors hover:border-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        className="mt-0.5 size-4 shrink-0 accent-brand-green"
      />
      <span
        className={cn(
          "text-[14px] leading-relaxed",
          checked ? "text-muted line-through" : "text-fg"
        )}
      >
        {content}
      </span>
    </label>
  );
}
