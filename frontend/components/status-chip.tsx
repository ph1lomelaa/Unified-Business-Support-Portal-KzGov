import { Chip } from "@/components/ui/chip";
import { statusMeta } from "@/lib/status";

export function StatusChip({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <Chip tone={m.tone} pulse={status === "in_review"}>
      {m.label}
    </Chip>
  );
}
