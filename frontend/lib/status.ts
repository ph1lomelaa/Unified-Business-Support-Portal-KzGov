// Mirror of backend app/status.py — labels + chip tones for display.
import type { ChipTone } from "@/components/ui/chip";

export type StatusMeta = {
  label: string;
  tone: ChipTone;
  sla?: number;
};

export const STATUS: Record<string, StatusMeta> = {
  draft: { label: "Черновик", tone: "gray" },
  submitted: { label: "Подана", tone: "blue" },
  stage2_required: { label: "Нужно добавить сведения", tone: "amber" },
  stage2_submitted: { label: "Сведения отправлены", tone: "blue" },
  in_review: { label: "На рассмотрении", tone: "blue", sla: 5 },
  needs_changes: { label: "Нужно исправить заявку", tone: "amber" },
  resubmitted: { label: "Отправлена повторно", tone: "blue" },
  approved: { label: "Одобрена", tone: "green" },
  contract_signed: { label: "Договор подписан", tone: "green" },
  active: { label: "Субсидирование активно", tone: "green" },
  completed: { label: "Завершена", tone: "green" },
  rejected: { label: "Не одобрена", tone: "red" },
};

export function statusMeta(key: string): StatusMeta {
  return STATUS[key] ?? { label: key, tone: "gray" };
}

export type SlaProgress = {
  elapsed: number;
  total: number;
  due: string;
  remaining: number;
  overdue: boolean;
};

export type AppEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  toLabel: string;
  comment: string | null;
  actor: string;
  createdAt: string;
};
