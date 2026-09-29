"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./dialog";

/*
  Keyboard shortcuts — Web App Structure §9.9, decision L9. Every shortcut is optional and
  listed here, so none is only discoverable by accident; nothing is keyboard-only.
  The test/practice player owns its own key handling (it needs the question state) but
  shares the rows below, so the two lists cannot drift apart.
*/

export type Shortcut = [keys: string, does: string];

export function playerShortcuts(practice: boolean): Shortcut[] {
  return [
    ["A–D or 1–4", "Choose an option"],
    ["→ or N", "Next question"],
    ["← or P", "Previous question"],
    ...(practice ? ([["Enter", "Check answer, then next question"]] as Shortcut[]) : ([["M", "Mark for review"]] as Shortcut[])),
    // Not "C": on a four-option question C is the third option (decision L10).
    ["Backspace or Delete", "Clear your answer"],
    ["?", "Show this list"],
  ];
}

export function ShortcutRows({ rows }: { rows: Shortcut[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>
            <kbd className="rounded-md border border-border-subtle bg-sunken px-2 py-0.5 font-mono text-xs text-ink">{k}</kbd>
          </dt>
          <dd className="text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const ANYWHERE: Shortcut[] = [
  ["?", "Show this list"],
  ["Esc", "Close a window or sheet"],
  ["Tab", "Move to the next control"],
  ["Shift + Tab", "Move to the previous control"],
];

/** Opens on `?` unless the learner is typing or a window is already open. */
export function useShortcutSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, show: () => setOpen(true), close: () => setOpen(false) };
}

export function KeyboardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="Optional. Everything also works by tap or click.">
      <h3 className="mb-2 text-sm font-semibold text-ink">Anywhere</h3>
      <ShortcutRows rows={ANYWHERE} />
      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">In a test</h3>
      <ShortcutRows rows={playerShortcuts(false)} />
      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">In practice</h3>
      <ShortcutRows rows={playerShortcuts(true)} />
    </Dialog>
  );
}
