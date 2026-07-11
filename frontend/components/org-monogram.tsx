import { cn } from "@/lib/utils";

// Constitution: монограммы организаций — квадрат 40px радиус 2, 2-буквенная
// аббревиатура. НЕ тащим реальные логотипы (авторские права) — подпись текстом.

function initials(name: string): string {
  const cleaned = name.replace(/[«»"']/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export function OrgMonogram({
  name,
  color = "#121517",
  size = 40,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control font-semibold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.36),
        letterSpacing: "-0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}
