import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-12 w-full rounded-control border border-border bg-surface px-4 text-[14px] text-fg placeholder:text-muted",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink focus-visible:border-ink",
      "disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-control border border-border bg-surface px-4 py-3 text-[14px] text-fg placeholder:text-muted",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink focus-visible:border-ink",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[13px] font-medium text-fg", className)}
      {...props}
    />
  );
}
