import { Chip } from "@/components/ui/chip";
import { statusMeta } from "@/lib/status";

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const m = statusMeta(status);
  return <Chip tone={m.tone}>{label ?? m.label}</Chip>;
}
