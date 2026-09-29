"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Native <dialog> as the modal primitive (ponytail: the platform already does focus
 * trapping, Esc, inert background and top-layer stacking). It stays inside the app
 * DOM tree, so no portal or z-index juggling is needed.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = "dialog",
  dismissible = true,
  labelledById,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** "sheet" = bottom sheet < 1024px, right panel ≥ 1024px (DS §7.1). */
  variant?: "dialog" | "sheet";
  dismissible?: boolean;
  labelledById?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = labelledById ?? `dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const shape =
    variant === "sheet"
      ? "app-dialog m-0 mt-auto w-full max-w-none rounded-t-card border-t-2 border-line max-h-[90vh] lg:ml-auto lg:mt-0 lg:h-full lg:max-h-none lg:w-[480px] lg:rounded-none lg:border-t-0 lg:border-l-2"
      : "app-dialog m-auto w-[calc(100%-2rem)] max-w-[520px] rounded-card border border-line shadow-brutal-lg";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`${shape} bg-elevated p-0 text-ink`}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel).
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      <div className={`flex max-h-[inherit] flex-col ${variant === "sheet" ? "lg:h-full" : ""}`}>
        {variant === "sheet" ? (
          <span aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border-subtle lg:hidden" />
        ) : null}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold leading-snug text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-sunken hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </dialog>
  );
}
