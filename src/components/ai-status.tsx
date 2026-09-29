"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, LoaderCircle } from "lucide-react";

/**
 * AI generation state — DS §23. Never a blank spinner: named steps appear within
 * 300ms, and after 20s the learner is told they can leave. In production the steps
 * advance on Inngest progress events; here `stepMs` simulates them.
 */
export function AIStatus({
  title,
  steps,
  stepMs = 900,
  onDone,
}: {
  title: string;
  steps: string[];
  stepMs?: number;
  onDone?: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [slow, setSlow] = useState(false);
  const doneRef = useRef(onDone);
  const fired = useRef(false);

  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (current >= steps.length) {
      if (!fired.current) {
        fired.current = true;
        doneRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => setCurrent((c) => c + 1), stepMs);
    return () => clearTimeout(t);
  }, [current, steps.length, stepMs]);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="rounded-card-lg border border-line bg-surface p-5 sm:p-6" aria-busy={current < steps.length}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <ol className="mt-4 flex flex-col gap-3" aria-live="polite">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className="flex items-center gap-3">
              {done ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-success text-white">
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                </span>
              ) : active ? (
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary-text" />
              ) : (
                <Circle aria-hidden="true" className="size-6 text-border-subtle" />
              )}
              <span className={`text-[15px] ${active ? "font-semibold text-ink" : done ? "text-ink" : "text-faint"}`}>
                {step}
                <span className="sr-only">{done ? " — done" : active ? " — in progress" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {slow ? (
        <p className="mt-4 text-sm text-muted">This can take up to a minute. You can leave this page; we&apos;ll notify you when it&apos;s ready.</p>
      ) : null}
    </div>
  );
}
