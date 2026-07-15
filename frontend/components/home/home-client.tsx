"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { HeroNavigator, type HeroNavigatorHandle } from "@/components/home/hero-navigator";
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
  ["03", "Подайте заявку", "Заполните короткую онлайн-форму, подпишите ЭЦП и получите номер заявки."],
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

      <div className="relative z-10 -mt-8 pb-10">
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
            {orgs.length === 0
              ? [0, 1, 2, 3].map((i) => <SupportOrgSkeleton key={i} />)
              : activeOrgs.map((org) => (
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
    </>
  );
}

function Hero() {
  return (
    <section className="relative -mt-[88px] min-h-[66vh] overflow-hidden bg-[#0a3a22] pt-[88px] text-white lg:-mt-[144px] lg:pt-[144px]">
      {/* Фирменное фото: переговорная с флагом «Байтерек» — фото читается крупнее. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero/boardroom.jpg')" }}
      />
      {/* Фирменный зелёный скрим (как на baiterek.gov) — фото видно, белый текст читается. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,55,33,0.86)_0%,rgba(8,64,38,0.60)_46%,rgba(9,70,42,0.32)_76%,rgba(7,55,33,0.54)_100%)]" />
      <OrnamentPattern className="text-white opacity-[0.05]" />
      <div className="relative mx-auto flex min-h-[calc(66vh-88px)] w-full max-w-[1600px] min-w-0 items-center px-4 py-16 sm:px-6 lg:min-h-[calc(66vh-144px)] lg:px-10">
        <div className="w-full max-w-[720px] min-w-0">
          {/* Официальный, «госсайтовый» стиль: спокойный надзаголовок + чёткий белый заголовок */}
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Институты развития Холдинга «Байтерек»
          </p>
          <h1 className="text-left text-[26px] font-bold leading-[1.16] text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.42)] sm:text-[32px] lg:text-[40px]">
            Все меры поддержки бизнеса в одном портале
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85">
            Финансирование, субсидии, гарантии и экспортная поддержка — в едином окне.
            Опишите задачу, и портал подберёт подходящую меру.
          </p>
        </div>
      </div>
    </section>
  );
}

function SupportOrgRow({ org }: { org: SupportOrg }) {
  return (
    <Link
      href={`/services?org=${org.id}`}
      className="group flex items-center gap-3 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-bg sm:gap-4 sm:p-5"
    >
      <OrgLogo org={org} size={44} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-snug text-ink sm:text-[16px]">{org.name}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          <span className="num text-[16px] font-bold text-brand-green">{org.serviceCount}</span>{" "}
          {pluralizeMeasures(org.serviceCount)}
        </p>
      </div>
      <span className="shrink-0 text-[13px] font-bold uppercase tracking-[0.03em] text-brand-green group-hover:text-brand-green-hover">
        Все →
      </span>
    </Link>
  );
}

function SupportOrgSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 last:border-b-0 sm:gap-4 sm:p-5">
      <div className="skeleton size-11 shrink-0 rounded-control" />
      <div className="min-w-0 flex-1">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton mt-2 h-3 w-1/3" />
      </div>
      <div className="skeleton h-4 w-12 shrink-0" />
    </div>
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
  if (items.length === 0) {
    return (
      <div className="mt-6 grid gap-x-8 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-b border-border py-4">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton mt-3 h-3 w-11/12" />
          </div>
        ))}
      </div>
    );
  }
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
