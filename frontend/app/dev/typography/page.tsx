"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Textarea, Label } from "@/components/ui/input";
import { OrgMonogram } from "@/components/org-monogram";
import { tenge, percent, dateRu, dateTimeRu, groupDigits } from "@/lib/format";

const KAZ_SPECIAL = "ә ғ қ ң ө ұ ү і Ә Ғ Қ Ң Ө Ұ Ү І";
const GOLOS_GLYPH_TEST = "ә ғ қ ң ө ұ ү і Ә Ғ Қ Ң Ө Ұ Ү І Кәсіпкерлік 12 345 678 ₸";

const TOKENS: { name: string; varName: string; hex: string }[] = [
  { name: "brand-green", varName: "--color-brand-green", hex: "#0B7A3E" },
  { name: "gold", varName: "--color-gold", hex: "#B89758" },
  { name: "ink (graphite)", varName: "--color-ink", hex: "#121517" },
  { name: "ink-hover", varName: "--color-ink-hover", hex: "#23282B" },
  { name: "accent", varName: "--color-accent", hex: "#0B7A3E" },
  { name: "accent-hover", varName: "--color-accent-hover", hex: "#086633" },
  { name: "bg (paper)", varName: "--color-bg", hex: "#FAFAF8" },
  { name: "surface", varName: "--color-surface", hex: "#FFFFFF" },
  { name: "border", varName: "--color-border", hex: "#E3E5E4" },
  { name: "fg", varName: "--color-fg", hex: "#15181A" },
  { name: "muted", varName: "--color-muted", hex: "#6A7276" },
  { name: "status-blue", varName: "--color-st-blue", hex: "#4A6673" },
  { name: "status-amber", varName: "--color-st-amber", hex: "#8A5A0B" },
  { name: "status-red", varName: "--color-st-red", hex: "#A32D2D" },
  { name: "status-green", varName: "--color-st-green", hex: "#0B7A3E" },
];

const ORGS = [
  { name: "Фонд «Даму»", color: "#0F6E56" },
  { name: "Аграрная кредитная корпорация", color: "#4A5053" },
  { name: "KazakhExport", color: "#121517" },
  { name: "Банк развития Казахстана", color: "#8A5A0B" },
];

export default function TypographyPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-6 py-14">
      <p className="kicker text-ink">Дизайн-система ЕППБ</p>
      <h1 className="mt-2 text-[36px] font-bold uppercase text-ink">
        Типографика и токены
      </h1>
      <p className="mt-2 text-muted">
        Проверочная страница M0: казахские буквы, шрифт Golos Text, токены,
        числа с табличными цифрами, базовые компоненты.
      </p>

      {/* Kazakh glyphs */}
      <Section title="Казахские буквы (проверка глифов Golos Text)">
        <div className="space-y-3">
          <p className="text-[40px] font-semibold text-ink">{KAZ_SPECIAL}</p>
          <p className="text-[22px]">{KAZ_SPECIAL}</p>
          <p className="text-[15px]">{KAZ_SPECIAL}</p>
          <p className="text-[15px] leading-relaxed">
            «Бәйтерек» холдингінің даму институттарының бизнеске арналған
            мемлекеттік қолдау шаралары: субсидиялау, кепілдік, қаржыландыру.
            Өтінімді онлайн беріңіз — құжаттар БСН бойынша автоматты
            толтырылады.
          </p>
          <p className="text-[13px] text-muted">
            Если любая из букв ә ғ қ ң ө ұ ү і отображается прямоугольником —
            шрифт не подгрузил кириллический-расширенный набор.
          </p>
        </div>
      </Section>

      <Section title="Шрифт Golos Text (единственный)">
        <div className="space-y-3">
          <p className="text-[34px] font-bold uppercase leading-tight text-ink">
            {GOLOS_GLYPH_TEST}
          </p>
          <p className="text-[13px] text-muted">
            Финальная дизайн-система использует только Golos Text. Если выше
            видите прямоугольники вместо букв — шрифт не подгрузил
            cyrillic-ext.
          </p>
        </div>
      </Section>

      {/* Type scale */}
      <Section title="Шкала заголовков и текста">
        <div className="space-y-2">
          <p className="text-[42px] font-semibold text-ink leading-tight">
            Заголовок H1 42/600
          </p>
          <p className="text-[28px] font-semibold text-ink">Заголовок 28/600</p>
          <p className="text-[17px] font-semibold text-ink">Подзаголовок 17/600</p>
          <p className="text-[15px]">Основной текст 15/400 — читаемость и воздух.</p>
          <p className="text-[13px] text-muted">Вторичный текст 13/400 muted.</p>
        </div>
      </Section>

      {/* Numbers */}
      <Section title="Числа: табличные цифры, тонкие неразрывные пробелы">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumRow label="Сумма кредита" value={tenge(7000000)} />
          <NumRow label="Крупная сумма" value={tenge(1500000000)} />
          <NumRow label="Ставка программы" value={percent(7)} />
          <NumRow label="Гарантия до" value={percent(85)} />
          <NumRow label="Группировка" value={groupDigits(4314000)} />
          <NumRow label="Дата решения" value={dateRu("2026-07-15")} />
          <NumRow label="Черновик сохранён" value={dateTimeRu("2026-07-08T20:14:00")} />
          <NumRow label="Экономия за срок" value={tenge(4314000)} big />
        </div>
      </Section>

      {/* Token swatches */}
      <Section title="Цветовые токены">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TOKENS.map((tk) => (
            <div
              key={tk.name}
              className="flex items-center gap-3 rounded-control border border-border bg-surface p-3"
            >
              <span
                className="size-10 shrink-0 rounded-control border border-border"
                style={{ background: tk.hex }}
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">
                  {tk.name}
                </p>
                <p className="truncate text-[12px] text-muted num">{tk.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Status chips */}
      <Section title="Статус-чипы (точка 6px + текст)">
        <div className="flex flex-wrap gap-2">
          <Chip tone="gray">Черновик</Chip>
          <Chip tone="blue">Подана</Chip>
          <Chip tone="blue" pulse>
            На рассмотрении
          </Chip>
          <Chip tone="amber">Требует доработки</Chip>
          <Chip tone="green">Одобрена</Chip>
          <Chip tone="red">Отказ</Chip>
          <Chip tone="accent">Активна</Chip>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Кнопки (зелёный primary, радиус 10, высота 48–56)">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Подать заявку</Button>
          <Button variant="accent">Опубликовать</Button>
          <Button variant="outline">Редактировать</Button>
          <Button variant="ghost">Отменить</Button>
          <Button variant="danger">Отказать</Button>
          <Button size="sm" variant="outline">
            Маленькая
          </Button>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Graphite CTA остаётся только для тёмных/фото-поверхностей, где зелёная
          кнопка теряет контраст.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="cta">Подать заявку</Button>
          <Button variant="cta" size="lg">
            Подобрать меры поддержки
          </Button>
        </div>
      </Section>

      {/* Org monograms */}
      <Section title="Монограммы организаций (40px, радиус 10)">
        <div className="flex flex-wrap items-center gap-3">
          {ORGS.map((o) => (
            <div key={o.name} className="flex items-center gap-2">
              <OrgMonogram name={o.name} color={o.color} />
              <span className="text-[13px] text-muted">{o.name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Card + form */}
      <Section title="Карточка и поля формы">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card hover>
            <CardBody>
              <CardTitle>Субсидирование ставки</CardTitle>
              <p className="mt-1 text-[13px] text-muted">
                Наведите курсор — бордер станет ink за 150ms, без масштаба.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div>
                  <p className="text-[12px] text-muted">Ставка</p>
                  <p className="stat-figure">{percent(7)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted">До</p>
                  <p className="stat-figure">{tenge(7000000000)}</p>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              <div>
                <Label htmlFor="bin">БИН</Label>
                <Input id="bin" placeholder="123456789012" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="note">Комментарий</Label>
                <Textarea id="note" rows={3} placeholder="Опишите задачу своими словами" className="mt-1" />
              </div>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* Skeleton */}
      <Section title="Скелетоны (в списках вместо спиннеров)">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card border border-border bg-surface p-4">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 border-b border-border pb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function NumRow({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between rounded-control border border-border bg-surface px-4 py-2.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={big ? "stat-figure" : "num text-[15px] font-medium text-fg"}>
        {value}
      </span>
    </div>
  );
}
