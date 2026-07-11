import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown instead of a silent empty/zero state when a fetch fails — the
 * point is that "no data" and "couldn't reach the server" must never look
 * the same to the user. */
export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-card border border-st-red/30 bg-st-red-bg px-4 py-3",
        className
      )}
    >
      <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-st-red" />
      <div className="flex-1">
        <p className="text-[14px] font-medium text-st-red">Не удалось загрузить данные</p>
        <p className="mt-0.5 text-[13px] text-st-red/85">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-control border border-st-red/30 px-3 py-1.5 text-[13px] font-medium text-st-red hover:bg-st-red/10"
        >
          <RotateCw size={14} strokeWidth={1.75} />
          Повторить
        </button>
      )}
    </div>
  );
}
