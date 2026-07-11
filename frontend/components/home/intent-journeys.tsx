"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Coins, Factory, Ship, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

// «Я хочу…» — курируемые маршруты цель → 2–3 шага. В отличие от свободного подбора
// (свободный запрос) это детерминированные сценарии, ведущие на РЕАЛЬНЫЕ услуги
// и статьи базы знаний. Адаптировано под scope Холдинга (меры поддержки), без
// eGov-услуг (регистрация/налоги) — их у портала нет.

type Step = { n: string; title: string; desc: string; cta: string; href: string };
type Goal = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  steps: Step[];
};

const GOALS: Goal[] = [
  {
    id: "agro",
    label: "Развивать агробизнес",
    icon: Sprout,
    steps: [
      { n: "01", title: "Проверить условия", desc: "Льготное кредитование животноводства от АКК: ставка 5%, до 1,5 млрд ₸, срок до 84 месяцев.", cta: "Открыть услугу", href: "/services/akk-animal" },
      { n: "02", title: "Разобраться в правиле 70%", desc: "Не менее 70% суммы займа направляется на приобретение скота — как это учесть в заявке.", cta: "Читать в базе знаний", href: "/knowledge/rule-70-percent" },
      { n: "03", title: "Подать заявку онлайн", desc: "Заполните короткий wizard, подпишите ЭЦП и получите номер заявки.", cta: "Оформить заявку", href: "/services/akk-animal/apply" },
    ],
  },
  {
    id: "finance",
    label: "Получить финансирование",
    icon: Coins,
    steps: [
      { n: "01", title: "Подобрать меру", desc: "Опишите задачу своими словами — портал покажет подходящие меры и объяснит почему.", cta: "К подбору", href: "#navigator" },
      { n: "02", title: "Субсидия или гарантия?", desc: "Чем отличается субсидирование ставки от гарантии по кредиту и что подойдёт вам.", cta: "Сравнить в базе знаний", href: "/knowledge/subsidy-vs-guarantee" },
      { n: "03", title: "Субсидировать ставку", desc: "Государство компенсирует часть ставки — итоговая ставка для вас 7%, сумма до 7 млрд ₸.", cta: "Открыть услугу «Даму»", href: "/services/damu-subsidy" },
    ],
  },
  {
    id: "export",
    label: "Выйти на экспорт",
    icon: Ship,
    steps: [
      { n: "01", title: "Застраховать контракт", desc: "Страхование экспортного контракта от KazakhExport — покрытие коммерческих и политических рисков до 90%.", cta: "Открыть услугу", href: "/services/kazakhexport-insurance" },
      { n: "02", title: "Что приложить к заявке", desc: "Пошаговое руководство по первой заявке: документы, сроки и подписание.", cta: "Читать руководство", href: "/knowledge/first-application-guide" },
      { n: "03", title: "Оформить страхование", desc: "Заполните заявку и подпишите ЭЦП — статус отслеживается в личном кабинете.", cta: "Оформить заявку", href: "/services/kazakhexport-insurance/apply" },
    ],
  },
  {
    id: "production",
    label: "Расширить производство",
    icon: Factory,
    steps: [
      { n: "01", title: "Кредит на крупный проект", desc: "Банк развития Казахстана финансирует крупные проекты в промышленности и инфраструктуре.", cta: "Открыть услугу БРК", href: "/services/brk-loan" },
      { n: "02", title: "Лизинг вагонов и техники", desc: "Приобретение подвижного состава в финансовый лизинг: аванс от 15%, срок до 120 месяцев.", cta: "Открыть услугу", href: "/services/brk-wagons-leasing" },
      { n: "03", title: "Гарантия по кредиту", desc: "Гарантирование до 85% суммы займа решает проблему недостатка залога.", cta: "Открыть услугу «Даму»", href: "/services/damu-guarantee" },
    ],
  },
];

export function IntentJourneys() {
  const [active, setActive] = React.useState(GOALS[0].id);
  const goal = GOALS.find((g) => g.id === active) ?? GOALS[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {GOALS.map((g) => {
          const Icon = g.icon;
          const on = g.id === active;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActive(g.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-medium transition-colors",
                on
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-border bg-surface text-ink hover:border-brand-green hover:bg-st-green-bg"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {goal.steps.map((s) => (
          <div
            key={s.n}
            className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
          >
            <p className="text-[22px] font-bold text-gold">{s.n}</p>
            <h3 className="mt-2 text-[17px] font-bold leading-tight text-ink">{s.title}</h3>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{s.desc}</p>
            <Link
              href={s.href}
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-green hover:text-brand-green-hover"
            >
              {s.cta}
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
