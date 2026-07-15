"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";

const GROUPS = [
  {
    title: "О портале",
    links: [
      { href: "/", label: "Главная" },
      { href: "/knowledge", label: "База знаний" },
      { href: "/map", label: "Карта проектов" },
      { href: "/sources", label: "Источники данных" },
      { href: "/cabinet", label: "Личный кабинет" },
    ],
  },
  {
    title: "Услуги",
    links: [
      { href: "/services", label: "Каталог мер" },
      { href: "/services?category=credit", label: "Кредитование" },
      { href: "/services?category=subsidy", label: "Субсидирование" },
      { href: "/services?category=guarantee", label: "Гарантирование" },
      { href: "/services?category=insurance", label: "Страхование" },
    ],
  },
  {
    title: "Организации",
    links: [
      { href: "/services?org=damu", label: "Фонд развития предпринимательства «Даму»" },
      { href: "/services?org=brk", label: "Банк развития Казахстана" },
      { href: "/services?org=kzhk", label: "Казахстанская жилищная компания" },
      { href: "/services?org=akk", label: "Аграрная кредитная корпорация" },
      { href: "/services?org=kazakhexport", label: "Экспортная страховая компания KazakhExport" },
      { href: "/services?org=kaf", label: "КазАгроФинанс" },
      { href: "/services?org=otbasy", label: "Отбасы банк" },
      { href: "/services?org=qic", label: "Qazaqstan Investment Corporation" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-gold bg-[#0a3a22] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="border-b border-white/12 pb-8">
          <div>
            <BrandLockup size="lg" />
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/62">
              Единая цифровая точка входа для предпринимателей: подбор мер поддержки, подача заявок и сопровождение статусов.
            </p>
          </div>
        </div>

        <div className="grid gap-10 py-8 md:grid-cols-4">
          {GROUPS.map((group) => (
            <nav key={group.title}>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-white">
                {group.title}
              </h3>
              <div className="mt-4 space-y-2">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-[14px] text-white/62 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}

          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-white">
              Контакт-центр
            </h3>
            <p className="num mt-4 text-[40px] font-bold leading-none text-white">1408</p>
            <p className="mt-3 text-[14px] leading-relaxed text-white/62">
              Единый контакт-центр поддержки предпринимателей
            </p>
            <p className="mt-5 text-[14px] font-semibold text-white">Пн-Пт: 8:30-17:30</p>
            <p className="mt-2 text-[13px] text-white/52">Сб-Вс: выходной</p>
          </div>
        </div>

        <div className="border-t border-white/12 pt-5 text-center text-[12px] text-white/45">
          © 2026 Единый портал поддержки бизнеса
        </div>
      </div>
    </footer>
  );
}
