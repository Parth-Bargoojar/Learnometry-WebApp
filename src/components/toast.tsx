"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Toast — Web App Structure §9.5: short confirmations that auto-dismiss after 4 s,
 * above the bottom tab bar on mobile, bottom-right on desktop, z-50 (§5.1).
 * One live region per page; the message is announced politely.
 */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottomnav-h)+12px)] z-50 flex justify-center px-4 lg:bottom-6 lg:justify-end lg:pr-8 print:hidden">
      {children ? (
        <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-btn border border-line bg-ink px-4 py-2.5 text-sm font-medium text-on-ink shadow-brutal animate-fade-in">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const toastAction = "font-bold text-on-ink underline decoration-2 underline-offset-4";

/** `show("Saved")` → renders `<Toast>` for 4 s. */
export function useToast(ms = 4000) {
  const [message, setMessage] = useState<ReactNode>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (m: ReactNode) => {
      window.clearTimeout(timer.current);
      setMessage(m);
      timer.current = window.setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );
  const hide = useCallback(() => setMessage(null), []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { show, hide, node: <Toast>{message}</Toast> };
}
