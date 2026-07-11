"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { HeroNavigator, type HeroNavigatorHandle } from "@/components/home/hero-navigator";
import { FloatingAiAssistant } from "@/components/home/floating-ai-assistant";
import { IntentJourneys } from "@/components/home/intent-journeys";
import { FeaturedServices } from "@/components/home/featured-services";
import { MapTeaser } from "@/components/home/map-teaser";
import { OrnamentPattern } from "@/components/brand/ornament-pattern";
import { SectionHeader } from "@/components/common/section-header";
import { OrgLogo } from "@/components/org-logo";
import { Badge } from "@/components/ui/chip";
import { api } from "@/lib/api";
import type { OrgBrief, PortalFaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type NewsItem = {
  id: string;
  sourceOrg?: OrgBrief | null;
  publishedAt: string;
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl?: string | null;
  importedAt: string;
};

type SupportOrg = OrgBrief & { serviceCount: number };

// The holding itself is not a service operator — it sits above its
// subsidiaries and should never show up next to them as "0 measures".
const HOLDING_ORG_ID = "baiterek";

const STEPS = [
  ["01", "Подберите меру", "Опишите задачу или выберите параметры бизнеса в каталоге."],
  ["02", "Проверьте условия", "Система покажет требования, документы и предварительную пригодность."],
  ["03", "Подайте заявку", "Заполните короткий wizard, подпишите ЭЦП и получите номер заявки."],
  ["04", "Отследите статус", "Кабинет показывает документы, уведомления и историю действий."],
];

function pluralizeMeasures(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "мера поддержки";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "меры поддержки";
  return "мер поддержки";
}

function pluralizeInstitutes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "институт развития";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "института развития";
  return "институтов развития";
}

export function HomeClient() {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [newsImportedAt, setNewsImportedAt] = React.useState<string | null>(null);
  const [orgs, setOrgs] = React.useState<SupportOrg[]>([]);
  const [faq, setFaq] = React.useState<PortalFaqItem[]>([]);
  const navigatorRef = React.useRef<HeroNavigatorHandle>(null);

  React.useEffect(() => {
    api<{ items: NewsItem[]; lastImportedAt: string | null }>("/api/v1/news")
      .then((payload) => {
        setNews(payload.items ?? []);
        setNewsImportedAt(payload.lastImportedAt ?? null);
      })
      .catch(() => {
        setNews([]);
        setNewsImportedAt(null);
      });
  }, []);

  React.useEffect(() => {
    api<{ items: PortalFaqItem[] }>("/api/v1/knowledge/faq")
      .then((payload) => setFaq(payload.items ?? []))
      .catch(() => setFaq([]));
  }, []);

  React.useEffect(() => {
    api<SupportOrg[]>("/api/v1/organizations")
      .then((rows) =>
        setOrgs(
          rows
            .filter((o) => o.id !== HOLDING_ORG_ID)
            .sort((a, b) => b.serviceCount - a.serviceCount || a.name.localeCompare(b.name, "ru"))
        )
      )
      .catch(() => setOrgs([]));
  }, []);

  const activeOrgs = orgs.filter((o) => o.serviceCount > 0);
  const dormantOrgs = orgs.filter((o) => o.serviceCount === 0);

  return (
    <>
      <Hero />

      <div className="relative z-10 -mt-20 pb-10">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <div id="navigator" className="scroll-mt-[150px]">
            <HeroNavigator ref={navigatorRef} variant="bridge" />
          </div>
        </div>
      </div>

      <section className="bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Я хочу…" />
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Ваша траектория начинается здесь. Выберите цель — покажем короткий путь
            из мер поддержки группы «Байтерек».
          </p>
          <div className="mt-6">
            <IntentJourneys />
          </div>
        </div>
      </section>

      <section className="bg-bg py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Как получить поддержку" />
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {STEPS.map(([n, title, desc]) => (
              <Step key={n} n={n} title={title} desc={desc} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Популярные услуги" href="/services" action="Каталог услуг" />
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Сервисы, которыми предприниматели пользуются чаще всего.
          </p>
          <div className="mt-6">
            <FeaturedServices />
          </div>
        </div>
      </section>

      <section className="bg-bg py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Институты развития группы «Байтерек»" href="/services" action="Все меры поддержки" />
          <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
            {activeOrgs.map((org) => (
              <SupportOrgRow key={org.id} org={org} />
            ))}
          </div>
          {dormantOrgs.length > 0 && <DormantOrgs orgs={dormantOrgs} />}
        </div>
      </section>

      <section id="map" className="scroll-mt-[150px] bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Карта проектов" href="/map" action="Открыть карту проектов" />
          <div className="mt-6">
            <MapTeaser />
          </div>
        </div>
      </section>

      {news.length > 0 && (
        <section className="bg-bg py-14 sm:py-16">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
            <SectionHeader title="Новости и события" />
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
              Новости организаций холдинга
              {newsImportedAt ? ` · Обновлено: ${new Date(newsImportedAt).toLocaleString("ru-RU")}` : ""}
            </p>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <NewsCard item={news[0]} large />
              <div className="grid gap-5">
                {news.slice(1, 3).map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          <SectionHeader title="Часто задаваемые вопросы" href="/knowledge" />
          <Faq items={faq} />
        </div>
      </section>

      <FloatingAiAssistant />
    </>
  );
}

function Hero() {
  return (
    <section className="relative -mt-[144px] min-h-[60vh] overflow-hidden bg-[#e7f1ea] pt-[144px] text-ink">
      {/* Мягкий фирменный градиент — светлый, но не белый и не тёмный. */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#d9ece1_0%,#e8f3ec_48%,#f1f7f3_100%)]" />
      <OrnamentPattern className="text-brand-green opacity-[0.06]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
      <div className="relative mx-auto flex min-h-[calc(60vh-144px)] w-full max-w-[1600px] min-w-0 items-center px-4 py-16 sm:px-6 lg:px-10">
        <div className="max-w-[760px] min-w-0">
          <h1 className="max-w-full text-[36px] font-extrabold uppercase leading-[1.08] text-ink sm:text-[58px] sm:leading-[1.05] lg:text-[72px]">
            <span className="block">Все меры поддержки бизнеса</span>
            <span className="block text-brand-green">— в одном портале</span>
          </h1>
          
        </div>
      </div>
    </section>
  );
}

function SupportOrgRow({ org }: { org: SupportOrg }) {
  return (
    <Link
      href={`/services?org=${org.id}`}
      className="group grid gap-4 border-b border-border p-5 transition-colors last:border-b-0 hover:bg-bg sm:grid-cols-[56px_1fr_auto_auto] sm:items-center"
    >
      <OrgLogo org={org} size={44} />
      <div className="min-w-0">
        <p className="text-[16px] font-bold leading-snug text-ink">{org.name}</p>
      </div>
      <div className="num text-[22px] font-bold text-brand-green sm:text-right">
        {org.serviceCount}
        <span className="ml-2 align-middle text-[13px] font-medium text-muted">
          {pluralizeMeasures(org.serviceCount)}
        </span>
      </div>
      <div className="text-[13px] font-bold uppercase tracking-[0.03em] text-brand-green group-hover:text-brand-green-hover">
        Все →
      </div>
    </Link>
  );
}

function DormantOrgs({ orgs }: { orgs: SupportOrg[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-card border border-dashed border-border bg-bg px-5 py-4 text-left transition-colors hover:border-ink"
      >
        <span className="text-[14px] font-medium text-muted">
          + {orgs.length} {pluralizeInstitutes(orgs.length)} без активных мер в каталоге
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.02em] text-brand-green">
          Показать все
          <ChevronDown size={16} strokeWidth={2} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <OrgLogo org={org} size={32} />
                <span className="truncate text-[14px] font-medium text-ink">{org.name}</span>
              </div>
              <Badge>скоро</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div>
      <p className="text-[28px] font-bold text-gold">{n}</p>
      <h3 className="mt-3 text-[18px] font-bold text-ink">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{desc}</p>
    </div>
  );
}

function NewsCard({ item, large = false }: { item: NewsItem; large?: boolean }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "photo-card group relative overflow-hidden rounded-card bg-[#0E3B24] shadow-[var(--shadow-card)]",
        large ? "min-h-[420px]" : "min-h-[200px]"
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0E3B24,#122016)]" />
      {item.imageUrl && (
        <div className="photo-layer absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${item.imageUrl}')` }} />
      )}
      <OrnamentPattern className="text-white opacity-[0.08]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/20 to-transparent" />
      <span className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full bg-white/16 text-white backdrop-blur transition-colors group-hover:bg-white/24">
        <ExternalLink size={17} strokeWidth={1.8} />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/14 px-3 py-1 text-[12px] font-semibold backdrop-blur">
            {item.sourceOrg?.shortName ?? "Источник"}
          </span>
          <span className="num text-[12px] text-white/68">
            {new Date(item.publishedAt).toLocaleDateString("ru-RU")}
          </span>
        </div>
        <h3 className={cn("mt-3 font-bold text-white", large ? "text-[26px]" : "text-[18px]")}>
          {item.title}
        </h3>
        {large && <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-white/76">{item.summary}</p>}
      </div>
    </a>
  );
}

function Faq({ items }: { items: PortalFaqItem[] }) {
  const [open, setOpen] = React.useState("");
  return (
    <div className="mt-6 grid gap-x-8 md:grid-cols-2">
      {items.map(({ question, answer }, i) => {
        const n = String(i + 1).padStart(2, "0");
        const active = open === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => setOpen(active ? "" : n)}
            className={cn(
              "border-b border-border px-0 py-4 text-left",
              active && "bg-[#FAF7F0] px-4"
            )}
          >
            <span className="flex items-center gap-4">
              <span className="text-[18px] font-bold text-gold">{n}</span>
              <span className="flex-1 text-[16px] font-semibold text-ink">{question}</span>
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                className={cn("text-muted transition-transform", active && "rotate-180")}
              />
            </span>
            {active && <span className="mt-3 block pl-12 text-[14px] leading-relaxed text-muted">{answer}</span>}
          </button>
        );
      })}
    </div>
  );
}
