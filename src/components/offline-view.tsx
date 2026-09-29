"use client";

import Image from "next/image";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CircleCheck, Circle, WifiOff } from "lucide-react";
import { TODAY_PLAN_KEY } from "@/lib/pwa";
import { btn } from "./ui";
import type { PlanSnapshotTask } from "./pwa";

/*
  /offline — Web App Structure §8.20, decision L4. The service worker serves this page in
  place of any screen it can't reach, so it has to work with no network: plain image paths
  (cached at install), no data fetching, and today's plan from the device's own copy.
*/

interface Snapshot {
  date: string;
  tasks: PlanSnapshotTask[];
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const noop = () => () => {};

const read = () => {
  try {
    return localStorage.getItem(TODAY_PLAN_KEY);
  } catch {
    return null;
  }
};

/** Try the screen that was asked for; if this *is* /offline, there's nothing to retry, so go home. */
function retry() {
  // A full load on purpose: the client router can't fetch anything while offline, and the worker
  // answers full navigations.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (window.location.pathname === "/offline") window.location.assign("/dashboard");
  else window.location.reload();
}

export function OfflineView({ today }: { today: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  // The plan comes from this device, so it only exists after hydration. Everything above it keeps
  // a fixed size until then, and the plan sits last, so nothing moves when it arrives (CLS).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const snapshot = useMemo<Snapshot | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }, [raw]);

  useEffect(() => {
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const fresh = snapshot && snapshot.date === today ? snapshot : null;
  const minutes = fresh ? fresh.tasks.reduce((a, t) => a + t.minutes, 0) : 0;

  return (
    <main id="main" className="flex flex-1 justify-center px-4 py-10 sm:pt-20">
      <div className="w-full max-w-[520px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-white ring-4 ring-primary/25">
            <Image src="/mascot.jpeg" alt="" width={192} height={192} unoptimized className="size-full scale-110 object-contain" />
          </span>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl text-ink">
            <WifiOff aria-hidden="true" className="size-7 text-muted" />
            You&apos;re offline
          </h1>
          <p className="min-h-6 text-[15px] text-ink">
            {!mounted ? " " : fresh ? "Your plan for today is still here." : "Reconnect to see today's plan."}
          </p>
          <p className="text-sm text-muted">Anything you answered in a test is saved on this device.</p>
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" onClick={retry} className={btn("primary", "md")}>
            Try again
          </button>
        </div>

        {fresh ? (
          <section aria-labelledby="offline-plan" className="mt-8 rounded-card border border-border-subtle bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="offline-plan" className="text-lg font-semibold text-ink">
                Today
              </h2>
              <p className="text-sm tabular-nums text-muted">{minutes} min planned</p>
            </div>
            <ul className="mt-3 divide-y divide-border-subtle">
              {fresh.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  {t.done ? (
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-text" />
                  ) : (
                    <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{t.concept}</p>
                    <p className="text-sm text-muted">{t.action}</p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-ink">
                    {t.minutes} min<span className="sr-only">, {t.done ? "done" : "to do"}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : snapshot ? (
          <p className="mt-8 text-center text-sm text-muted">Your last saved plan is from a different day, so we won&apos;t show it as today&apos;s.</p>
        ) : null}
      </div>
    </main>
  );
}
