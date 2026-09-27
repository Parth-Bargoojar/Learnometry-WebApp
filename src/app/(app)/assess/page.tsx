import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck } from "lucide-react";
import { COST } from "@/lib/config";
import { RETEST_ID, planMeta, reports } from "@/lib/data";
import { dayMonth, relativeDay } from "@/lib/format";
import { ButtonLink, Card, CardHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Assess" };

/** Assess hub — Web App Structure §8.4. */
export default function AssessPage() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card level="primary" className="p-5 sm:p-7 lg:col-span-7" aria-labelledby="new-diag">
        <div className="flex items-start gap-4">
          <span className="hidden size-12 shrink-0 items-center justify-center rounded-card-sm border-2 border-line bg-primary/15 sm:flex">
            <ClipboardCheck aria-hidden="true" className="size-6 text-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="new-diag" className="text-xl font-semibold text-ink">
              New diagnostic
            </h2>
            <p className="mt-1 text-[15px] text-muted">Find the concepts behind your wrong answers in Class 11 Mechanics.</p>
            <ul className="mt-4 divide-y divide-border-subtle rounded-card-sm border border-border-subtle">
              <li className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">Full diagnostic</p>
                  <p className="text-sm text-muted">30 min · 15 questions · all 6 chapters</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">⚡ {COST.fullDiagnostic}</span>
              </li>
              <li className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">One chapter</p>
                  <p className="text-sm text-muted">15 min · 8 questions</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">⚡ {COST.chapterDiagnostic}</span>
              </li>
            </ul>
            <ButtonLink href="/assess/diagnostic" className="mt-5">
              Start diagnostic <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
          </div>
        </div>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-5" aria-labelledby="retests-h">
        <CardHeader id="retests-h" title="Scheduled retests" />
        <ul className="mt-3">
          <li>
            <Link href={`/assess/retests/${RETEST_ID}`} className="-mx-2 flex min-h-14 items-center gap-3 rounded-btn px-2 py-2 hover:bg-sunken">
              <CalendarClock aria-hidden="true" className="size-5 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{relativeDay(planMeta.retestOn)}</span>
                <span className="block text-sm text-muted">Resolution, friction, circular motion · 9 questions</span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums text-ink">⚡ {COST.retest}</span>
            </Link>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">Retests use new questions on the concepts you worked on, so the result measures the fix, not your memory.</p>
      </Card>

      <section aria-labelledby="reports-h" className="lg:col-span-12">
        <h2 id="reports-h" className="mb-3 text-lg font-semibold text-ink">
          Reports
        </h2>
        <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
          {reports.map((r) => {
            const href = r.kind === "diagnostic" ? `/assess/results/${r.attemptId}` : `/progress`;
            return (
              <li key={r.attemptId}>
                <Link href={href} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sunken">
                  <span className="w-14 text-sm tabular-nums text-muted">{dayMonth(r.date)}</span>
                  <span className="min-w-0 flex-1 font-medium text-ink">{r.title}</span>
                  <span className="rounded-full border border-border-subtle bg-sunken px-2 py-0.5 text-xs font-semibold capitalize text-muted">{r.kind}</span>
                  <span className="w-16 text-right font-semibold tabular-nums text-ink">
                    {r.score}/{r.max}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs text-muted lg:col-span-12">
        Starting a test shows its credit cost first. Reading reports is always free.
      </p>
    </div>
  );
}
