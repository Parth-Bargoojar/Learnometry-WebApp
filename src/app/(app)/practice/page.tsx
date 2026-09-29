import type { Metadata } from "next";
import { ChevronDown, Target } from "lucide-react";
import { COST, severityFor, confidenceFor } from "@/lib/config";
import { chapters, conceptById, concepts, hasQuestions, planMeta, stateFor } from "@/lib/data";
import { ago } from "@/lib/format";
import { ProgressBar, SeverityBadge } from "@/components/ui";
import { SpendLink } from "@/components/credit-gate";

export const metadata: Metadata = { title: "Practice" };

const REASON: Record<string, string> = {
  resolution: "P1 in your plan. 2 of 3 incorrect in your diagnostic.",
  friction: "Confusing limiting and actual friction.",
  circular: "Method is right; practise under time.",
};

/** Practice hub — Web App Structure §8.11. Never "AI practice": it says what is targeted. */
export default function PracticePage() {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="rec-h">
        <h2 id="rec-h" className="text-lg font-semibold text-ink">
          Recommended for you
        </h2>
        <p className="mt-1 text-sm text-muted">From this week&apos;s plan, in priority order.</p>
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {planMeta.focus.map((id, i) => {
            const c = conceptById(id);
            return (
              <li key={id} className={`flex flex-col bg-surface p-5 ${i === 0 ? "rounded-card-lg border-2 border-line shadow-brutal" : "rounded-card border border-border-subtle"}`}>
                <Target aria-hidden="true" className="size-5 text-primary-text" />
                <h3 className="mt-3 font-semibold leading-snug text-ink">{c.name}</h3>
                <p className="mt-1 text-sm text-muted">{REASON[id]}</p>
                <p className="mt-3 text-xs text-muted">5 questions · about 8 min · instant feedback</p>
                <SpendLink href={`/attempt/prac-${id}-5`} cost={COST.practiceSet5} what="A practice set" variant={i === 0 ? "primary" : "secondary"} className="mt-4 self-start">
                  Start practice
                </SpendLink>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="ch-h">
        <h2 id="ch-h" className="text-lg font-semibold text-ink">
          By chapter
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {chapters.map((ch, idx) => (
            <details key={ch.id} open={idx === 1} className="group rounded-card border border-border-subtle bg-surface">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {ch.name}
                <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {concepts
                  .filter((c) => c.chapterId === ch.id)
                  .map((c) => {
                    const s = stateFor(c.id);
                    const conf = confidenceFor(s?.scoredItems ?? 0);
                    const sev = s ? severityFor(s.mastery, conf) : null;
                    return (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                        <div className="min-w-0 flex-1 basis-56">
                          <p className="font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-muted">Last practised: {ago(s?.lastPracticed ?? null)}</p>
                        </div>
                        <div className="w-40">
                          {sev ? <SeverityBadge value={sev} size="sm" /> : <span className="text-xs text-muted">Not assessed yet</span>}
                          {s && sev !== "insufficient" ? (
                            <div className="mt-1.5">
                              <ProgressBar value={s.mastery} label={`${c.name} mastery`} size="sm" tone="ink" />
                            </div>
                          ) : null}
                        </div>
                        {hasQuestions(c.id) ? (
                          <SpendLink href={`/attempt/prac-${c.id}-5`} cost={COST.practiceSet5} what="A practice set" variant="secondary" size="sm">
                            Practice
                          </SpendLink>
                        ) : (
                          <span className="text-xs text-muted">Questions coming soon</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
