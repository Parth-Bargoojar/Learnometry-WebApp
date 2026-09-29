import type { Metadata } from "next";
import { ArrowRight, Zap } from "lucide-react";
import { conceptById, planVersions } from "@/lib/data";
import { dayMonth } from "@/lib/format";
import { ButtonLink, Card, ProgressBar } from "@/components/ui";

export const metadata: Metadata = { title: "Previous plans" };

/**
 * Plan versions — Web App Structure §4.1 `/plan/history`, §8.9 "View previous plans".
 * Read-only: what each plan focused on, why it started, how far it got and what
 * happened next. Reschedules edit the current plan and never appear here.
 */
export default function PlanHistoryPage() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <p className="text-[15px] text-muted">
        A new plan starts after a diagnostic, a retest or a rebuild. Moving tasks or changing your daily time updates the current plan instead.
      </p>
      <ol className="flex flex-col gap-4">
        {planVersions.map((v) => {
          const current = v.status === "active";
          return (
            <li key={v.id}>
              <Card level={current ? "structural" : "supporting"} as="article" className="p-5 sm:p-6" aria-labelledby={`${v.id}-h`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`${v.id}-h`} className="text-lg font-semibold text-ink">
                    Plan {v.version} · {dayMonth(v.from)} – {dayMonth(v.to)}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      current ? "border-success/35 bg-success/10 text-success-text" : "border-border-subtle bg-sunken text-muted"
                    }`}
                  >
                    {current ? "Current" : "Replaced"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{v.triggerLabel}</p>

                <h3 className="mt-4 text-sm font-semibold text-muted">Focus, in order</h3>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {v.focus.map((id, i) => (
                    <li key={id} className="rounded-full border border-border-subtle bg-sunken px-3 py-1 text-sm text-ink">
                      <span className="font-semibold tabular-nums">{i + 1}.</span> {conceptById(id).name}
                    </li>
                  ))}
                </ol>

                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border-subtle pt-4 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs font-semibold text-muted">Tasks done</dt>
                    <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
                      {v.tasksDone} of {v.tasksTotal}
                    </dd>
                    <dd className="mt-1.5">
                      <ProgressBar value={v.tasksDone} max={v.tasksTotal} label={`Plan ${v.version} tasks done`} tone="ink" size="sm" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Daily time</dt>
                    <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">{v.dailyMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Cost</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums text-ink">
                      {v.credits ? (
                        <>
                          <Zap aria-hidden="true" className="size-4 text-muted" />
                          {v.credits}
                          <span className="sr-only"> credits</span>
                        </>
                      ) : (
                        "Free · part of the retest"
                      )}
                    </dd>
                  </div>
                </dl>

                {v.outcome ? <p className="mt-4 rounded-card-sm bg-sunken px-4 py-3 text-sm text-ink">{v.outcome}</p> : null}
                {current ? (
                  <ButtonLink href="/plan" variant="secondary" className="mt-5">
                    Open current plan <ArrowRight aria-hidden="true" className="size-5" />
                  </ButtonLink>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
