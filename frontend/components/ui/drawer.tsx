"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  title,
  width = 520,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  width?: number;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30" />
      <DialogPrimitive.Content
        style={{ maxWidth: width }}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-surface shadow-[var(--shadow-pop)] focus:outline-none",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Закрыть"
            className="rounded-control p-1 text-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            <X size={20} strokeWidth={1.75} />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
