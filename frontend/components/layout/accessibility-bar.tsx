"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "eppb-a11y";

/**
 * Single "eye" toggle: one click toggles html.a11y-mode, persisted in localStorage.
 */
export function AccessibilityBar({ onDark = false }: { onDark?: boolean }) {
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "on";
    setOn(stored);
    document.documentElement.classList.toggle("a11y-mode", stored);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("a11y-mode", next);
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label="Версия для слабовидящих"
      title="Версия для слабовидящих"
      className={cn(
        "flex size-11 items-center justify-center rounded-control border transition-colors cursor-pointer",
        onDark
          ? "border-white/25 text-white/80 hover:bg-white/10 hover:text-white"
          : "border-border text-fg hover:bg-st-gray-bg",
        on && (onDark ? "border-white bg-white/15 text-white" : "border-accent bg-accent text-white")
      )}
    >
      <Eye size={18} strokeWidth={1.75} />
    </button>
  );
}
