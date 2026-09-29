"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, Clock, History, MoreHorizontal, Plus, Printer, RefreshCw, X } from "lucide-react";
import { conceptById, planChange } from "@/lib/data";
import { SHARED, useShared } from "@/lib/local-store";
import { Dialog } from "./dialog";
import { Popover, menuItem } from "./popover";

/* Plan menu and PlanChangeBanner — Web App Structure §7.5, §8.9. */

export function PlanMenu() {
  return (
    <Popover
      label="Plan options"
      triggerClassName="flex size-11 items-center justify-center rounded-btn border border-border-subtle bg-surface text-ink hover:border-line print:hidden"
      panelClassName="w-64"
      trigger={<MoreHorizontal aria-hidden="true" className="size-5" />}
    >
      {(close) => (
        <ul>
          <li>
            <Link href="/settings/study" onClick={close} className={menuItem}>
              <Clock aria-hidden="true" className="size-4 text-muted" />
              Change daily time
            </Link>
          </li>
          <li>
            <Link href="/plan/history" onClick={close} className={menuItem}>
              <History aria-hidden="true" className="size-4 text-muted" />
              View previous plans
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                close();
                // Let the menu unmount before the print snapshot is taken.
                requestAnimationFrame(() => window.print());
              }}
              className={menuItem}
            >
              <Printer aria-hidden="true" className="size-4 text-muted" />
              Print plan
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );
}

const NONE = 0;

/** Shown once per regeneration until dismissed; "See what changed" opens the diff (§7.5). */
export function PlanChangeBanner() {
  const [seen, setSeen] = useShared<number>(SHARED.planChangeSeen, NONE);
  const [open, setOpen] = useState(false);
  if (seen >= planChange.toVersion) return null;

  const groups = [
    { title: "Added", icon: Plus, items: planChange.added },
    { title: "Moved later", icon: ArrowDownRight, items: planChange.moved },
    { title: "Kept", icon: RefreshCw, items: planChange.kept },
  ];

  return (
    <>
      <div role="status" className="flex flex-col gap-3 rounded-card border border-info/40 bg-info/5 px-4 py-3 sm:flex-row sm:items-center print:hidden">
        <RefreshCw aria-hidden="true" className="hidden size-5 shrink-0 text-info sm:block" />
        <p className="min-w-0 flex-1 text-[15px] text-ink">Your plan was rebuilt after {planChange.reason}.</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary-text underline underline-offset-4">
            See what changed
          </button>
          <button
            type="button"
            onClick={() => setSeen(planChange.toVersion)}
            aria-label="Dismiss"
            className="flex size-11 items-center justify-center rounded-btn text-muted hover:bg-sunken hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="What changed" description={`Plan ${planChange.fromVersion} → plan ${planChange.toVersion}, after ${planChange.reason}.`} variant="sheet">
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <g.icon aria-hidden="true" className="size-4 text-muted" />
                {g.title}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {g.items.map((it) => (
                  <li key={it.conceptId} className="rounded-card-sm border border-border-subtle p-3">
                    <p className="font-medium text-ink">{conceptById(it.conceptId).name}</p>
                    <p className="mt-0.5 text-sm text-muted">{it.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <Link href="/plan/history" onClick={() => setOpen(false)} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          All previous plans
        </Link>
      </Dialog>
    </>
  );
}
