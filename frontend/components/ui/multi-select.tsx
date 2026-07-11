"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { OrgLogo } from "@/components/org-logo";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  org?: {
    name: string;
    shortName?: string | null;
    logo?: string | null;
    color?: string | null;
  };
};

export function MultiSelect({
  values,
  onValuesChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  const selected = new Set(values);
  const triggerLabel = values.length === 0
    ? placeholder
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label ?? placeholder
      : `Выбрано: ${values.length}`;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "inline-flex min-h-10 min-w-[210px] items-center justify-between gap-3 rounded-control border border-[#E2E5E9] bg-white px-3 py-2 text-[14px] text-fg outline-none transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-ink",
          className
        )}
      >
        <span className="min-w-0 whitespace-normal text-left leading-5">{triggerLabel}</span>
        <ChevronDown size={16} strokeWidth={1.8} className="shrink-0 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[2000] max-h-[380px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-control border border-border bg-white p-1 shadow-[var(--shadow-card-hover)]"
        >
          <DropdownMenu.Item
            onSelect={() => onValuesChange([])}
            className="flex cursor-pointer items-center rounded-[8px] px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-st-green-bg"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center">
              {values.length === 0 && <Check size={15} strokeWidth={2} />}
            </span>
            Все
          </DropdownMenu.Item>
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.value}
              checked={selected.has(option.value)}
              onCheckedChange={(checked) => onValuesChange(
                checked
                  ? [...values, option.value]
                  : values.filter((value) => value !== option.value)
              )}
              onSelect={(event) => event.preventDefault()}
              className="flex cursor-pointer items-center rounded-[8px] px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-st-green-bg"
            >
              <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check size={15} strokeWidth={2} />
                </DropdownMenu.ItemIndicator>
              </span>
              {option.org && <OrgLogo org={option.org} size={30} className="mr-2" />}
              <span className="max-w-[390px] whitespace-normal leading-5">{option.label}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
