"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Share, Smartphone, SquarePlus, WifiOff } from "lucide-react";
import { SHARED, useShared } from "@/lib/local-store";
import { TODAY_PLAN_KEY, promptInstall, useInstallKind, useOnline } from "@/lib/pwa";
import { Dialog } from "./dialog";
import { btn } from "./ui";

/*
  PWA pieces — Web App Structure §9.8 and decisions L1–L4, each placed where the spec says.
  (<PwaBoot>, which runs on every route, lives in its own file so it stays tiny.)
*/

/* ---------- Offline banner (§5.2 OfflineBanner) ---------- */

/**
 * The live region is always mounted: screen readers only announce changes inside a region
 * that already exists. Reconnecting says so for a few seconds instead of vanishing silently.
 */
export function OfflineBanner() {
  const online = useOnline();
  const [back, setBack] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onOnline = () => {
      setBack(true);
      timer = window.setTimeout(() => setBack(false), 4000);
    };
    const onOffline = () => {
      window.clearTimeout(timer);
      setBack(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="print:hidden">
      {!online ? (
        <div className="mb-5 flex items-start gap-3 rounded-card border border-warning/50 bg-warning/10 px-4 py-3 sm:items-center">
          <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-text sm:mt-0" />
          <p className="text-sm text-ink">
            <span className="font-semibold">You&apos;re offline.</span> Answers are saved on this device and will sync.
          </p>
        </div>
      ) : back ? (
        <div className="mb-5 flex items-center gap-3 rounded-card border border-success/40 bg-success/5 px-4 py-3">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-success-text" />
          <p className="text-sm font-semibold text-ink">You&apos;re back online.</p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Today's plan, kept for /offline ---------- */

export interface PlanSnapshotTask {
  id: string;
  concept: string;
  action: string;
  minutes: number;
  done: boolean;
}

/** Renders nothing. Every app page refreshes the snapshot, so `/offline` can show today's tasks. */
export function TodayPlanSnapshot({ date, tasks }: { date: string; tasks: PlanSnapshotTask[] }) {
  useEffect(() => {
    try {
      localStorage.setItem(TODAY_PLAN_KEY, JSON.stringify({ date, tasks }));
    } catch {}
  }, [date, tasks]);
  return null;
}

/* ---------- Install ---------- */

/** iOS has no install prompt; Share → Add to Home Screen is the only route (and the only route to push). */
export function InstallSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    { icon: Share, text: "Tap the Share button in your browser's toolbar." },
    { icon: SquarePlus, text: "Choose Add to Home Screen." },
    { icon: Smartphone, text: "Tap Add, then open Learnometry from your home screen." },
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Add Learnometry to your home screen" description="Works on iPhone and iPad, iOS 16.4 or later.">
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.text} className="flex items-center gap-3 rounded-card-sm border border-border-subtle bg-sunken px-3 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-card-sm border-2 border-line bg-surface">
              <s.icon aria-hidden="true" className="size-5 text-ink" />
            </span>
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{i + 1}. </span>
              {s.text}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex justify-end">
        <button type="button" autoFocus onClick={onClose} className={btn("secondary")}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}

/**
 * Dashboard card, decision L3 (last on the page, so it appearing after hydration moves nothing
 * the learner is looking at): offered once, only after a first diagnosis (value proven),
 * never to someone already running the app, and never again after "Not now".
 * A browser that can't install gets no card rather than a button that does nothing.
 */
export function InstallCard() {
  const kind = useInstallKind();
  const [dismissed, setDismissed] = useShared<boolean>(SHARED.installDismissed, false);
  const [steps, setSteps] = useState(false);
  if (dismissed || kind === "installed" || kind === "none") return null;

  const add = async () => {
    if (kind === "ios") return setSteps(true);
    // Whatever the answer, don't ask again: the browser has its own memory of a refusal.
    if ((await promptInstall()) !== "accepted") setDismissed(true);
  };

  return (
    <section aria-labelledby="install-h" className="mt-5 flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:p-5 print:hidden">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-card-sm border-2 border-line bg-primary/15">
          <Smartphone aria-hidden="true" className="size-5 text-ink" />
        </span>
        <div className="min-w-0">
          <h2 id="install-h" className="font-semibold text-ink">
            Add Learnometry to your home screen
          </h2>
          <p className="mt-0.5 text-sm text-muted">One-tap access to your plan.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => setDismissed(true)} className={btn("ghost", "md")}>
          Not now
        </button>
        <button type="button" onClick={add} className={btn("secondary", "md")}>
          {kind === "ios" ? "Show me how" : "Add to home screen"}
        </button>
      </div>
      <InstallSteps open={steps} onClose={() => setSteps(false)} />
    </section>
  );
}
