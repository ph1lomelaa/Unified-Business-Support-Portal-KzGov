import Image from "next/image";
import { OrgMonogram } from "@/components/org-monogram";
import { cn } from "@/lib/utils";

// Иконка организации: реальный логотип на белом чипе, если он есть; иначе —
// буквенная монограмма (запасной вариант для орг без файла логотипа).
// Единый компонент, чтобы во всех местах портала (каталог, услуга, заявки,
// кабинет, админка) логотипы показывались одинаково и без «букв в иконках».

type OrgLike =
  | {
      name?: string | null;
      shortName?: string | null;
      color?: string | null;
      logo?: string | null;
    }
  | null
  | undefined;

export function OrgLogo({
  org,
  size = 40,
  className,
}: {
  org: OrgLike;
  size?: number;
  className?: string;
}) {
  const label = org?.shortName || org?.name || "?";

  if (org?.logo) {
    const pad = Math.round(size * 0.14);
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-white",
          className
        )}
        style={{ width: size, height: size, padding: pad }}
      >
        <Image
          src={org.logo}
          alt={org.name || label}
          width={size}
          height={size}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <OrgMonogram
      name={label}
      color={org?.color ?? undefined}
      size={size}
      className={className}
    />
  );
}
