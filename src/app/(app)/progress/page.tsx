import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Minus, TrendingUp } from "lucide-react";
import { retestOutcome } from "@/lib/config";
import { attemptHistory, conceptById, pastRetests, scoreTrend, stateFor, targetedConcepts } from "@/lib/data";
import { dayMonth, signed } from "@/lib/format";
import { Card, CardHeader, TextLink } from "@/components/ui";
import { PairedBar, TrendLine } from "@/components/charts";

export const metadata: Metadata = { title: "Progress" };

/** Progress — "Am I actually getting better?" (Web App Structure §8.13). */
export default function ProgressPage() {
  const targeted = targetedConcepts.map((id) => stateFor(id)!);
  const base = Math.round(targeted.reduce((a, s) => a + (s.baselineMastery ?? s.mastery), 0) / targeted.length);
  const now = Math.round(targeted.reduce((a, s) => a + s.mastery, 0) / targeted.length);

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="answer" className="rounded-card-lg border border-line bg-surface p-5 shadow-brutal sm:p-7">
        <h2 id="answer" className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Your targeted concepts are up {now - base} points since your first diagnostic.
        </h2>
        <p className="mt-2 text-[15px] text-muted">
          Measured by {pastRetests.length} {pastRetests.length === 1 ? "retest" : "retests"} on fresh questions.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="bn-h">
          <CardHeader id="bn-h" title="Targeted concepts: baseline vs now" meta={`${base}% → ${now}% average`} />
          <div className="mt-5 flex flex-col gap-6">
            {targeted.map((s) => (
              <div key={s.conceptId}>
                <Link href={`/progress/concepts/${s.conceptId}`} className="mb-2 inline-flex min-h-6 touch:min-h-11 items-center text-sm font-semibold text-ink hover:underline hover:underline-offset-4">
                  {conceptById(s.conceptId).name}
                </Link>
                <PairedBar before={s.baselineMastery ?? 0} after={s.mastery} label={conceptById(s.conceptId).name} />
              </div>
            ))}
          </div>
        </Card>
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="trend-h">
          <CardHeader id="trend-h" title="Score trend" meta="Diagnostics and retests only" />
          <div className="mt-4 max-w-3xl">
            <TrendLine
              title={`Scores: ${scoreTrend.map((p) => `${dayMonth(p.date)} ${p.pct}%`).join(", ")}`}
              points={scoreTrend.map((p) => ({ ...p, label: dayMonth(p.date) }))}
            />
          </div>
        </Card>

        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="ro-h">
          <CardHeader id="ro-h" title="Retest outcomes" action={<TextLink href="/progress/concepts">All concepts <ArrowRight aria-hidden="true" className="size-4" /></TextLink>} />
          <ul className="mt-3 divide-y divide-border-subtle">
            {pastRetests.map((r) => {
              const outcomes = r.results.map((x) => retestOutcome(x.retest - x.baseline, x.items));
              const imp = outcomes.filter((o) => o === "improved").length;
              const delta = Math.round(r.results.reduce((a, x) => a + x.retest - x.baseline, 0) / r.results.length);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="w-14 text-sm tabular-nums text-muted">{dayMonth(r.date)}</span>
                  <span className="min-w-0 flex-1 font-medium text-ink">{r.title}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                    <TrendingUp aria-hidden="true" className="size-4 text-success-text" /> {imp} improved
                    <Minus aria-hidden="true" className="ml-2 size-4 text-muted" /> {outcomes.length - imp} stable
                  </span>
                  <span className="w-20 text-right font-bold tabular-nums text-ink">{signed(delta)} pts</span>
                </li>
              );
            })}
          </ul>
          <TextLink href="/progress/history" className="mt-3">
            All {attemptHistory.length} attempts <ArrowRight aria-hidden="true" className="size-4" />
          </TextLink>
        </Card>
      </div>
    </div>
  );
}
