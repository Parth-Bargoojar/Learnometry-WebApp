"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Anchored panel (disclosure pattern): the trigger has aria-expanded, the panel
 * closes on outside press and on Escape (focus returns to the trigger).
 * Z-index 30 = dropdowns and popovers (§5.1). Used by the plan menu, the
 * notification bell and the guardian learner switcher.
 */
export function Popover({
  trigger,
  label,
  triggerClassName,
  panelClassName = "w-64",
  align = "right",
  children,
}: {
  trigger: ReactNode;
  /** Accessible name when the trigger is icon-only. */
  label?: string;
  triggerClassName: string;
  panelClassName?: string;
  /** "none": the panel class sets its own horizontal position. */
  align?: "left" | "right" | "none";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          className={`absolute top-[calc(100%+8px)] z-30 rounded-card border-2 border-line bg-elevated p-1.5 shadow-brutal animate-fade-in ${
            align === "right" ? "right-0" : align === "left" ? "left-0" : ""
          } ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export const menuItem = "flex min-h-11 w-full items-center gap-2.5 rounded-btn px-3 py-1.5 text-left text-sm text-ink hover:bg-sunken";
