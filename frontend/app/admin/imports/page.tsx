"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileInput,
  FileSearch,
  Files,
  FormInput,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";
import { dateTimeRu } from "@/lib/format";

type Source = {
  id: string;
  name: string;
  kind: string;
  url: string;
  status: "ready" | "planned" | "connected" | "degraded" | "blocked";
  found: number;
  updated: number;
  needsReview: number;
  aiExtracted: number;
  published: number;
  lastRunAt: string | null;
  method: string;
  nextStep: string;
};

type Evidence = {
  kind: string;
  label: string;
  value: string;
  sourceQuote: string;
  mappedTo: string;
  confidence: number;
};

type ImportedService = {
  id: string;
  sourceId: string;
  serviceId?: string;
  serviceSlug: string;
  title: string;
  organization: string;
  sourceUrl: string;
  status: string;
  confidence: number;
  updatedAt: string;
  coverage: Record<string, boolean>;
  form: { pages: Array<{ title?: string; elements?: Array<Record<string, unknown>> }> };
  applicationExample: { summary: string; answers: Array<{ name: string; label?: string; value: string }> };
  evidence: Evidence[];
};

type Payload = {
  sources: Source[];
  services: ImportedService[];
  summary: { sources: number; found: number; updated: number; needsReview: number; published: number };
  pagination: { offset: number; limit: number; total: number; hasMore: boolean };
};

type ImportedNews = {
  id: string;
  sourceOrg: string;
  title: string;
  summary: string;
  publishedAt: string;
  sourceUrl: string;
  imageUrl?: string | null;
  importedAt: string;
  status: "draft" | "published";
};

type NewsPayload = {
  items: ImportedNews[];
  summary: { total: number; draft: number; published: number; lastImportedAt: string | null };
};

const STATUS_LABEL: Record<string, string> = {
  ready: "Готов",
  planned: "Запланирован",
  connected: "Подключен",
  degraded: "Ограничен",
  imported: "Импортировано",
  normalized: "Нормализовано",
  ai_extracted: "AI-обработано",
  needs_review: "Требует проверки",
  analyst_review: "Проверка аналитика",
  draft_form: "Черновик формы",
  published: "Опубликовано",
};

const PAGE_SIZE = 20;

export default function AdminImportsPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [selectedSource, setSelectedSource] = React.useState("all");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [runningSource, setRunningSource] = React.useState<string | null>(null);
  const [runningNews, setRunningNews] = React.useState(false);
  const [draftingId, setDraftingId] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [newsData, setNewsData] = React.useState<NewsPayload | null>(null);
  const [selectedNews, setSelectedNews] = React.useState<string[]>([]);
  const [view, setView] = React.useState<"services" | "news">("services");

  const load = React.useCallback((sourceId = selectedSource, nextOffset = offset) => {
    const qs = new URLSearchParams({ offset: String(nextOffset), limit: String(PAGE_SIZE) });
    if (sourceId !== "all") qs.set("sourceId", sourceId);
    return api<Payload>(`/api/v1/admin/imports?${qs}`)
      .then((payload) => {
        setData(payload);
        setActiveId((current) => payload.services.some((service) => service.id === current) ? current : payload.services[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Не удалось загрузить импорт"));
  }, [offset, selectedSource]);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadNews = React.useCallback(() => {
    return api<NewsPayload>("/api/v1/admin/imports/news")
      .then((payload) => {
        setNewsData(payload);
        setSelectedNews((current) => current.filter((id) => payload.items.some((item) => item.id === id && item.status === "draft")));
      })
      .catch(() => setNewsData({ items: [], summary: { total: 0, draft: 0, published: 0, lastImportedAt: null } }));
  }, []);

  React.useEffect(() => {
    loadNews();
  }, [loadNews]);

  const active = data?.services.find((item) => item.id === activeId) ?? null;
  const currentSource = data?.sources.find((source) => source.id === selectedSource) ?? null;

  function selectSource(sourceId: string) {
    setSelectedSource(sourceId);
    setOffset(0);
    setActiveId(null);
  }

  async function runSource(sourceId: string) {
    setRunningSource(sourceId);
    try {
      await api(`/api/v1/admin/imports/${sourceId}/run`, { method: "POST", json: {} });
      toast.success("Импорт завершён, список обновлён");
      await load(sourceId, 0);
      setOffset(0);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось запустить импорт");
    } finally {
      setRunningSource(null);
    }
  }

  async function createDraft(importedId: string) {
    setDraftingId(importedId);
    try {
      const res = await api<{ id: string }>(`/api/v1/admin/imports/services/${importedId}/draft`, { method: "POST", json: {} });
      window.location.assign(`/admin/services/${res.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось создать черновик");
    } finally {
      setDraftingId(null);
    }
  }

  async function runNewsImport() {
    setRunningNews(true);
    try {
      const res = await api<{ sources: Record<string, { found: number; changed: number; errors: string[] }> }>(
        "/api/v1/admin/imports/news/run",
        { method: "POST", json: {} }
      );
      const text = Object.entries(res.sources)
        .map(([id, row]) => `${id}: ${row.found} найдено, ${row.changed} обновлено`)
        .join(" · ");
      toast.success(`Импорт новостей завершён: ${text}`);
      await loadNews();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось импортировать новости");
    } finally {
      setRunningNews(false);
    }
  }

  async function publishNews() {
    try {
      const res = await api<{ published: number }>("/api/v1/admin/imports/news/publish", {
        method: "POST",
        json: { ids: selectedNews },
      });
      toast.success(`Опубликовано новостей: ${res.published}`);
      setSelectedNews([]);
      await loadNews();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось опубликовать новости");
    }
  }

  function changePage(nextOffset: number) {
    setOffset(nextOffset);
    setActiveId(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-brand-green">Конвейер официальных источников</p>
          <h1 className="mt-2 text-[28px] font-semibold text-ink">Импорт мер поддержки</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">Источник, AI-извлечение, проверка аналитика и черновик услуги в одном рабочем потоке.</p>
        </div>
        <button onClick={() => load()} className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink">
          <RotateCw size={16} strokeWidth={1.75} /> Обновить список
        </button>
      </div>

      {error && <ErrorBanner className="mt-6" message={error} onRetry={() => load()} />}

      {/* Отдельные вкладки: услуги (по умолчанию, слева) и новости — импорт услуг больше не под новостями */}
      <div className="mt-6 inline-flex rounded-control border border-border bg-surface p-1">
        <ViewTab active={view === "services"} onClick={() => setView("services")}>
          Услуги из источников
        </ViewTab>
        <ViewTab active={view === "news"} onClick={() => setView("news")}>
          Новости{newsData?.summary.draft ? ` · ${newsData.summary.draft} черновиков` : ""}
        </ViewTab>
      </div>

      {view === "news" && (
        <NewsImportPanel
          data={newsData}
          selected={selectedNews}
          running={runningNews}
          onRun={runNewsImport}
          onPublish={publishNews}
          onToggle={(id) =>
            setSelectedNews((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            )
          }
        />
      )}

      {view === "services" && data && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-5 xl:self-start">
            <SourceNavigation
              sources={data.sources}
              selected={selectedSource}
              summary={data.summary}
              runningSource={runningSource}
              onSelect={selectSource}
              onRun={runSource}
            />
          </aside>

          <section className="min-w-0">
            {/* Панель просмотра выбранной услуги — сверху, чтобы открывалась сразу
                при клике «Просмотреть / обработать», а не в самом низу под списком. */}
            {active && (
              <ServiceReview service={active} drafting={draftingId === active.id} onDraft={() => createDraft(active.id)} />
            )}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-semibold text-ink">{currentSource?.name ?? "Все источники"}</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {data.pagination.total} {pluralServices(data.pagination.total)} · показано {data.services.length} из {PAGE_SIZE}
                </p>
              </div>
              {currentSource && (
                <a href={currentSource.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink">
                  Открыть источник <ExternalLink size={15} />
                </a>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              {data.services.length === 0 ? (
                <Card><CardBody className="py-12 text-center text-[14px] text-muted">По этому источнику пока нет импортированных услуг.</CardBody></Card>
              ) : data.services.map((service) => (
                <ServiceRow key={service.id} service={service} active={active?.id === service.id} onOpen={() => setActiveId(service.id)} />
              ))}
            </div>

            <Pagination pagination={data.pagination} onChange={changePage} />
          </section>
        </div>
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-brand-green text-white" : "text-fg hover:bg-bg"
      )}
    >
      {children}
    </button>
  );
}

function NewsImportPanel({
  data,
  selected,
  running,
  onRun,
  onPublish,
  onToggle,
}: {
  data: NewsPayload | null;
  selected: string[];
  running: boolean;
  onRun: () => void;
  onPublish: () => void;
  onToggle: (id: string) => void;
}) {
  const items = data?.items ?? [];
  const drafts = items.filter((item) => item.status === "draft");
  return (
    <Card className="mt-6">
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-brand-green">Новости организаций</p>
            <h2 className="mt-1 text-[20px] font-semibold text-ink">HTML-импорт новостей</h2>
            <p className="mt-1 text-[13px] text-muted">
              Черновики проходят ручную модерацию перед выводом на главной.
              {data?.summary.lastImportedAt ? ` Последний импорт: ${dateTimeRu(data.summary.lastImportedAt)}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink disabled:opacity-50"
            >
              <RotateCw size={16} className={cn(running && "animate-spin")} />
              Обновить новости
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={selected.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-green px-3 text-[13px] font-medium text-white hover:bg-brand-green-hover disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              Опубликовать ({selected.length})
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-border text-[11px] uppercase tracking-[0.03em] text-muted">
              <tr>
                <th className="px-3 py-2">Выбор</th>
                <th className="px-3 py-2">Новость</th>
                <th className="px-3 py-2">Источник</th>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted">
                    Новостей в БД пока нет. Запустите импорт.
                  </td>
                </tr>
              ) : (
                items.slice(0, 12).map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        disabled={item.status !== "draft"}
                        checked={selected.includes(item.id)}
                        onChange={() => onToggle(item.id)}
                        aria-label={`Выбрать ${item.title}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">
                        {item.title}
                      </a>
                      <p className="mt-1 line-clamp-2 text-muted">{item.summary}</p>
                    </td>
                    <td className="px-3 py-3 text-muted">{item.sourceOrg}</td>
                    <td className="px-3 py-3 text-muted">{dateTimeRu(item.publishedAt)}</td>
                    <td className="px-3 py-3">
                      <Status status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {drafts.length > 8 && (
          <p className="mt-3 text-[12px] text-muted">
            Рекомендуется выбрать 6-8 новостей для главной страницы.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function SourceNavigation({ sources, selected, summary, runningSource, onSelect, onRun }: {
  sources: Source[]; selected: string; summary: Payload["summary"]; runningSource: string | null; onSelect: (id: string) => void; onRun: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-4"><p className="text-[13px] font-semibold text-ink">Источники</p></div>
      <div className="p-2">
        <SourceNavItem active={selected === "all"} name="Все источники" stats={`${summary.sources} источника · ${summary.found} найдено`} icon={Files} onClick={() => onSelect("all")} />
        <div className="mx-2 my-2 border-t border-border" />
        {sources.map((source) => (
          <div key={source.id} className="mb-1">
            <SourceNavItem active={selected === source.id} name={source.name} stats={`${source.found} найдено · ${source.aiExtracted} AI · ${source.published} опубл.`} icon={FileInput} onClick={() => onSelect(source.id)} />
            {selected === source.id && (
              <button type="button" disabled={runningSource === source.id || source.status === "planned"} onClick={() => onRun(source.id)} className="ml-10 mt-1 inline-flex h-8 items-center gap-1.5 text-[12px] font-medium text-brand-green disabled:cursor-not-allowed disabled:opacity-40">
                <RotateCw size={13} className={cn(runningSource === source.id && "animate-spin")} /> Обновить сейчас
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SourceNavItem({ active, name, stats, icon: Icon, onClick }: { active: boolean; name: string; stats: string; icon: typeof FileInput; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("w-full rounded-control px-3 py-2.5 text-left transition-colors", active ? "bg-st-green-bg text-brand-green" : "text-fg hover:bg-bg")}>
    <span className="flex items-center gap-2.5 text-[13px] font-semibold"><Icon size={16} strokeWidth={1.75} />{name}</span>
    <span className={cn("mt-1 block pl-[26px] text-[11px]", active ? "text-brand-green/75" : "text-muted")}>{stats}</span>
  </button>;
}

function ServiceRow({ service, active, onOpen }: { service: ImportedService; active: boolean; onOpen: () => void }) {
  return <Card className={cn("transition-colors", active && "border-brand-green")}> <CardBody className="flex flex-wrap items-center gap-4 p-4">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-st-green-bg text-brand-green"><Bot size={19} /></span>
    <div className="min-w-[220px] flex-1"><p className="text-[15px] font-semibold text-ink">{service.title}</p><p className="mt-1 text-[12px] text-muted">{service.organization} · {dateTimeRu(service.updatedAt)}</p></div>
    <Status status={service.status} />
    <button type="button" onClick={onOpen} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-control border border-border px-3 text-[13px] font-medium text-ink hover:border-ink"><Eye size={16} />Просмотреть / обработать</button>
  </CardBody></Card>;
}

function Pagination({ pagination, onChange }: { pagination: Payload["pagination"]; onChange: (offset: number) => void }) {
  if (pagination.total <= pagination.limit) return null;
  return <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[13px] text-muted"><span>Показаны {pagination.offset + 1}–{pagination.offset + Math.min(pagination.limit, pagination.total - pagination.offset)} из {pagination.total}</span><span className="flex gap-2"><button type="button" disabled={pagination.offset === 0} onClick={() => onChange(Math.max(0, pagination.offset - pagination.limit))} className="inline-flex size-9 items-center justify-center rounded-control border border-border bg-surface text-ink disabled:opacity-40"><ArrowLeft size={16} /></button><button type="button" disabled={!pagination.hasMore} onClick={() => onChange(pagination.offset + pagination.limit)} className="inline-flex size-9 items-center justify-center rounded-control border border-border bg-surface text-ink disabled:opacity-40"><ArrowRight size={16} /></button></span></div>;
}

function ServiceReview({ service, drafting, onDraft }: { service: ImportedService; drafting: boolean; onDraft: () => void }) {
  const [tab, setTab] = React.useState<"evidence" | "form" | "example">("evidence");
  return <Card className="mb-7 overflow-hidden"><CardBody>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[13px] font-semibold text-muted">{service.organization}</p><h2 className="mt-1 text-[21px] font-semibold text-ink">{service.title}</h2><p className="mt-1 text-[13px] text-muted">AI confidence {Math.round(service.confidence * 100)}%</p></div><div className="flex flex-wrap gap-2">{service.serviceId ? <Link href={`/admin/services/${service.serviceId}`} className="inline-flex h-10 items-center gap-2 rounded-control border border-border px-3 text-[13px] font-medium text-ink hover:border-ink">Открыть черновик <ArrowRight size={15} /></Link> : <button type="button" disabled={drafting} onClick={onDraft} className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"><Sparkles size={16} />Создать черновик</button>}<a href={service.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-control border border-border px-3 text-[13px] font-medium text-ink hover:border-ink"><ExternalLink size={15} />Источник</a></div></div>

    {/* Ключевые извлечённые параметры (Сумма, срок, ставка …) — отдельным разделом слева */}
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-5 lg:self-start">
        <KeyFacts evidence={service.evidence} />
      </aside>
      <div className="min-w-0">
        <div className="flex gap-1 border-b border-border"><ReviewTab active={tab === "evidence"} onClick={() => setTab("evidence")} icon={FileSearch}>Доказательства</ReviewTab><ReviewTab active={tab === "form"} onClick={() => setTab("form")} icon={FormInput}>Форма</ReviewTab><ReviewTab active={tab === "example"} onClick={() => setTab("example")} icon={CheckCircle2}>Пример заявки</ReviewTab></div>
        {tab === "evidence" && <EvidenceTable evidence={service.evidence} />}
        {tab === "form" && <FormPreview form={service.form} />}
        {tab === "example" && <ApplicationExample example={service.applicationExample} />}
      </div>
    </div>
  </CardBody></Card>;
}

function KeyFacts({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) {
    return (
      <div className="rounded-card border border-border bg-bg p-4 text-[13px] text-muted">
        Ключевые параметры появятся после AI-извлечения.
      </div>
    );
  }
  return (
    <div className="rounded-card border border-border bg-bg p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-brand-green">Ключевые параметры</p>
      <dl className="mt-3 space-y-3">
        {evidence.map((item) => (
          <div key={`${item.kind}-${item.label}`} className="border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
            <dt className="text-[12px] text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-[14px] font-semibold leading-snug text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReviewTab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof FileSearch; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("flex h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-medium", active ? "border-brand-green text-brand-green" : "border-transparent text-muted hover:text-ink")}><Icon size={15} />{children}</button>; }

function EvidenceTable({ evidence }: { evidence: Evidence[] }) { if (!evidence.length) return <p className="py-8 text-[13px] text-muted">Для этой карточки пока нет извлечённых цитат.</p>; return <div className="mt-5 overflow-x-auto rounded-card border border-border"><div className="min-w-[680px] divide-y divide-border">{evidence.map((item) => <div key={`${item.kind}-${item.label}`} className="grid grid-cols-[150px_1fr_1fr] gap-4 p-3 text-[13px]"><div><p className="font-semibold text-ink">{item.label}</p><p className="mt-1 text-muted">{item.value}</p></div><p className="text-muted">«{item.sourceQuote}»</p><code className="h-fit rounded-control bg-bg px-2 py-1 text-[11px] text-ink">{item.mappedTo}</code></div>)}</div></div>; }

function FormPreview({ form }: { form: ImportedService["form"] }) { const fields = form.pages.flatMap((page) => (page.elements ?? []).map((field) => ({ page: page.title ?? "Раздел", field }))); if (!fields.length) return <p className="py-8 text-[13px] text-muted">AI ещё не сформировал схему формы для этой карточки.</p>; return <div className="mt-5 space-y-2">{fields.map(({ page, field }, index) => <div key={`${String(field.name)}-${index}`} className="grid grid-cols-[160px_1fr_120px] gap-3 rounded-control border border-border p-3 text-[13px]"><span className="text-muted">{page}</span><span className="font-medium text-ink">{String(field.title ?? field.name ?? "Поле")}</span><span className="text-muted">{String(field.type ?? "text")}</span></div>)}</div>; }

function ApplicationExample({ example }: { example: ImportedService["applicationExample"] }) { return <div className="mt-5"><div className="flex items-start gap-3 rounded-control border border-st-green/30 bg-st-green-bg p-3"><Sparkles size={18} className="mt-0.5 text-brand-green" /><p className="text-[13px] text-fg">{example.summary}</p></div>{example.answers.length ? <div className="mt-4 divide-y divide-border rounded-card border border-border">{example.answers.map((answer) => <div key={answer.name} className="grid grid-cols-[minmax(160px,0.45fr)_1fr] gap-4 p-3 text-[13px]"><span className="font-medium text-ink">{answer.label ?? answer.name}</span><span className="text-muted">{answer.value}</span></div>)}</div> : <p className="py-7 text-[13px] text-muted">Пример появится после формирования схемы формы.</p>}</div>; }

function Status({ status }: { status: string }) { const color = status === "published" ? "bg-st-green-bg text-st-green" : status === "imported" ? "bg-bg text-muted" : "bg-st-amber-bg text-st-amber"; return <span className={cn("rounded-control px-2.5 py-1 text-[12px] font-medium", color)}>{STATUS_LABEL[status] ?? status}</span>; }
function pluralServices(value: number) { return value === 1 ? "услуга" : value > 1 && value < 5 ? "услуги" : "услуг"; }
