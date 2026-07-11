// Formatting helpers — constitution: суммы «5 000 000 ₸» с тонкими
// неразрывными пробелами, tabular-nums (класс .num на контейнере).

const THIN_NBSP = " "; // narrow no-break space

/** 5000000 -> "5 000 000" (thin non-breaking grouping) */
export function groupDigits(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.round(n)).toString();
  const parts: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    parts.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return sign + parts.join(THIN_NBSP);
}

/** 5000000 -> "5 000 000 ₸" */
export function tenge(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${groupDigits(n)}${THIN_NBSP}₸`;
}

/** 7 -> "7 %" */
export function percent(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${THIN_NBSP}%`;
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** ISO -> "15 июля 2026" */
export function dateRu(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()}${THIN_NBSP}${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO -> "08.07.2026, 20:14" */
export function dateTimeRu(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const p = (x: number) => x.toString().padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** relative-ish "2 часа назад" for feeds */
export function timeAgoRu(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min}${THIN_NBSP}мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}${THIN_NBSP}ч назад`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}${THIN_NBSP}дн назад`;
  return dateRu(d);
}
