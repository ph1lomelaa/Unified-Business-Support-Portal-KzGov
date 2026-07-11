"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { api } from "@/lib/api";

type SourceMode = "Реальный" | "Живой импорт" | "Первоисточник" | "Имитация";

type SourceRow = {
  section: string;
  source: string;
  access: string;
  mode: SourceMode;
  freshness: string;
  contractHref?: string;
};

const MODE_TONE: Record<SourceMode, ChipTone> = {
  "Реальный": "green",
  "Живой импорт": "blue",
  "Первоисточник": "blue",
  "Имитация": "gray",
};

function sourceRows(newsImportedAt: string | null): SourceRow[] {
  return [
  {
    section: "Каталог услуг",
    source: "bgov.kz",
    access: "Публичные страницы и импорт карточек",
    mode: "Живой импорт",
    freshness: "Обновляется при публикации импорта",
  },
  {
    section: "Условия услуг",
    source: "adilet.zan.kz",
    access: "Открытые нормативные правовые акты",
    mode: "Первоисточник",
    freshness: "По версии опубликованного НПА",
  },
  {
    section: "Данные по БИН",
    source: "ГБД ЮЛ через eGov",
    access: "Интеграция через защищённый контур",
    mode: "Имитация",
    freshness: "Контракт готов, подключение после доступа к ЕИШ",
    contractHref: "/api-docs#/Интеграции/bin_info_api_v1_integrations_bin__bin__get",
  },
  {
    section: "Проекты карты",
    source: "ИС Аналитического центра через ЕИШ",
    access: "Внутренняя витрина Холдинга",
    mode: "Имитация",
    freshness: "Синтетический набор для конкурса",
    contractHref: "/api-docs#/Карта/map_projects_api_v1_map_projects_get",
  },
  {
    section: "Аналитика ДО",
    source: "Публичные отчёты организаций",
    access: "Живые ссылки на опубликованные материалы",
    mode: "Живой импорт",
    freshness: "По дате публикации отчёта",
  },
  {
    section: "Новости",
    source: "Сайты организаций холдинга",
    access: "HTML-импорт",
    mode: "Живой импорт",
    freshness: newsImportedAt
      ? `Обновлено ${new Date(newsImportedAt).toLocaleString("ru-RU")}`
      : "Обновлено после первого импорта",
  },
  {
    section: "Подписание",
    source: "НУЦ РК / NCALayer",
    access: "Локальный протокол NCALayer",
    mode: "Реальный",
    freshness: "Проверка выполняется при подписании",
  },
  ];
}

export default function SourcesPage() {
  const [newsImportedAt, setNewsImportedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<{ lastImportedAt: string | null }>("/api/v1/news")
      .then((payload) => setNewsImportedAt(payload.lastImportedAt ?? null))
      .catch(() => setNewsImportedAt(null));
  }, []);

  const rows = sourceRows(newsImportedAt);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:py-14">
      <div className="max-w-3xl">
        <p className="kicker text-brand-green">Прозрачность интеграций</p>
        <h1 className="mt-2 text-[36px] font-bold uppercase text-ink sm:text-[44px]">
          Источники данных портала
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Портал спроектирован под подключение к ЕИШ и ведомственным системам
          Холдинга. На этапе конкурса часть интеграций работает в режиме
          имитации: для них описаны контракты API, чтобы после получения
          доступов заменить демо-данные без изменения пользовательских сценариев.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left text-[14px]">
            <thead className="bg-[#F4F6F4] text-[12px] uppercase tracking-[0.03em] text-muted">
              <tr>
                <Th>Раздел портала</Th>
                <Th>Источник</Th>
                <Th>Тип доступа</Th>
                <Th>Режим</Th>
                <Th>Актуальность</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.section} className="align-top">
                  <Td className="font-semibold text-ink">{row.section}</Td>
                  <Td>{row.source}</Td>
                  <Td>{row.access}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-2">
                      <Chip tone={MODE_TONE[row.mode]}>{row.mode}</Chip>
                      {row.contractHref && (
                        <Link
                          href={row.contractHref}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-green hover:text-brand-green-hover"
                        >
                          Контракт в API
                          <ExternalLink size={13} strokeWidth={1.8} />
                        </Link>
                      )}
                    </div>
                  </Td>
                  <Td className="text-muted">{row.freshness}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-4 ${className}`}>{children}</td>;
}
