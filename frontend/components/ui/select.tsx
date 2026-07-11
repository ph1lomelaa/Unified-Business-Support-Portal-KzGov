"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  className,
  allowClear = true,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Root value={value || (allowClear ? "__all" : undefined)} onValueChange={(next) => onValueChange(next === "__all" ? "" : next)} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "inline-flex h-10 min-w-[170px] items-center justify-between gap-3 rounded-[10px] border border-[#E2E5E9] bg-white px-3 text-[14px] text-fg shadow-none outline-none transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} strokeWidth={1.8} className="shrink-0 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[2000] max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-[#E2E5E9] bg-white shadow-[var(--shadow-card-hover)]"
        >
          <SelectPrimitive.Viewport className="p-1">
            {allowClear && <SelectItem value="__all">{placeholder}</SelectItem>}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center rounded-[8px] px-8 py-2 text-[14px] text-fg outline-none data-[highlighted]:bg-st-green-bg data-[highlighted]:text-ink"
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
        <Check size={15} strokeWidth={2} />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
