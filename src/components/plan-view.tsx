"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarClock, ChevronDown, Lock, Target } from "lucide-react";
import { COST } from "@/lib/config";
import { RETEST_ID, TODAY, conceptById, learner, planMeta, planTasks, upcomingWeeks } from "@/lib/data";
import { daysFromToday, relativeDay, shortDate, weekday } from "@/lib/format";
import { TaskList } from "./tasks";
import { Dialog } from "./dialog";
import { ProgressBar, btn } from "./ui";
import { SpendLink } from "./credit-gate";
import { PlanChangeBanner, PlanMenu } from "./plan-extras";

type View = "today" | "week" | "upcoming" | "retest";
const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "retest", label: "Retest" },
];

/** Plan — Web App Structure §8.9. Tabs live in `?view=` so back/forward work. */
export function PlanView() {
  const router = useRouter();
  const params = useSearchParams();
  const view = (params.get("view") as View) || "today";
  const [moveOpen, setMoveOpen] = useState(false);
  const [moved, setMoved] = useState(false);

  const week = planTasks.filter((t) => t.type !== "retest");
  const done = week.filter((t) => t.status === "completed").length;
  const today = planTasks.filter((t) => t.date === TODAY);
  const planned = today.reduce((a, t) => a + t.minutes, 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="hidden print:block">
        <span className="block font-display text-2xl text-ink">
          Study plan · {learner.firstName} {learner.lastName}
        </span>
        <span className="text-sm text-muted">
          {learner.exam} · {learner.subject} · printed {shortDate(TODAY)}
        </span>
      </p>
      <PlanChangeBanner />
      <div className="flex items-start gap-3 rounded-card-lg border-2 border-line bg-surface p-5 sm:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">
              Week {planMeta.week} of {planMeta.weeks} · {planMeta.focus.length} concepts · {learner.dailyMinutes} min a day
            </p>
            <p className="mt-1 text-lg font-semibold text-ink">
              This week: {conceptById(planMeta.focus[0]).name} first · retest {relativeDay(planMeta.retestOn)}
            </p>
          </div>
          <div className="w-full sm:w-64 sm:shrink-0">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>Tasks done this week</span>
              <span className="tabular-nums">
                {done} of {week.length}
              </span>
            </div>
            <ProgressBar value={done} max={week.length} label="Tasks done this week" tone="ink" />
            <p className="mt-1.5 text-xs text-muted">Finishing tasks doesn&apos;t change mastery. The retest does.</p>
          </div>
        </div>
        <PlanMenu />
      </div>

      <div role="tablist" aria-label="Plan views" className="print:hidden flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-sunken p-1 sm:self-start">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            type="button"
            aria-selected={view === v.key}
            onClick={() => router.replace(v.key === "today" ? "/plan" : `/plan?view=${v.key}`, { scroll: false })}
            className={`h-10 touch:h-11 shrink-0 rounded-full border-2 px-4 text-sm font-semibold transition-colors duration-150 ${
              view === v.key ? "border-line bg-surface text-ink shadow-brutal-sm" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="animate-fade-in" key={view}>
        {view === "today" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">{shortDate(TODAY)}</h2>
                <p className="text-sm tabular-nums text-muted">
                  {planned} of {learner.dailyMinutes} min
                </p>
              </div>
              {moved ? (
                <p role="status" className="mb-3 rounded-card border border-border-subtle bg-surface p-4 text-sm text-ink">
                  Moved 2 tasks to later this week. Your retest is still {relativeDay(planMeta.retestOn)}.
                </p>
              ) : (
                <TaskList tasks={today} />
              )}
              {!moved ? (
                <button type="button" onClick={() => setMoveOpen(true)} className="print:hidden mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4 hover:text-ink">
                  Can&apos;t study today?
                </button>
              ) : null}
            </div>
            <aside className="lg:col-span-4">
              <details open className="group rounded-card border border-border-subtle bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  Why this order
                  <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <ol className="flex flex-col gap-3 border-t border-border-subtle px-5 py-4 text-sm text-ink">
                  {planMeta.why.map((w, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold text-ink">{i + 1}</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </aside>
          </div>
        ) : null}

        {view === "week" ? <WeekView /> : null}

        {view === "upcoming" ? (
          <div className="flex flex-col gap-4">
            {upcomingWeeks.map((w) => (
              <section key={w.week} className="rounded-card border border-border-subtle bg-surface p-5">
                <h2 className="font-semibold text-ink">
                  Week {w.week} · {w.range}
                </h2>
                <p className="mt-1 text-sm text-muted">Outline. Details are set after this week&apos;s retest.</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {w.concepts.map((id) => (
                    <li key={id} className="rounded-full border border-border-subtle bg-sunken px-3 py-1 text-sm text-ink">
                      {conceptById(id).name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {view === "retest" ? <RetestPanel done={done} total={week.length} /> : null}
      </div>

      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} title="Move today's tasks?" description="Your plan re-prioritises instead of piling up a backlog.">
        <p className="text-sm text-ink">
          We&apos;ll spread today&apos;s 2 remaining tasks over the rest of the week and drop the lowest-yield practice if there isn&apos;t room. Your retest date stays the same. Free.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn("secondary")} onClick={() => setMoveOpen(false)}>
            Keep today
          </button>
          <button
            type="button"
            className={btn("primary")}
            onClick={() => {
              setMoved(true);
              setMoveOpen(false);
            }}
          >
            Move tasks
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function WeekView() {
  const days = Array.from(new Set(planTasks.map((t) => t.date)));
  const max = learner.dailyMinutes;
  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Minutes planned per day" className="hidden grid-cols-7 gap-2 sm:grid">
        {days.map((d) => {
          const mins = planTasks.filter((t) => t.date === d).reduce((a, t) => a + t.minutes, 0);
          const isToday = d === TODAY;
          return (
            <li key={d}>
              <a
                href={`#day-${d}`}
                className={`flex h-full flex-col items-center gap-2 rounded-card-sm bg-surface px-2 py-3 text-center ${isToday ? "border-2 border-line shadow-brutal-sm" : "border border-border-subtle"}`}
              >
                <span className="text-xs font-semibold text-muted">{weekday(d)}</span>
                <span className="font-display text-lg leading-none text-ink">{Number(d.slice(8))}</span>
                <span aria-hidden="true" className="relative flex h-14 w-3 items-end overflow-hidden rounded-full bg-sunken">
                  <span className="w-full rounded-full bg-primary" style={{ height: `${Math.min(100, (mins / max) * 100)}%` }} />
                </span>
                <span className="text-xs tabular-nums text-muted">{mins} min</span>
              </a>
            </li>
          );
        })}
      </ol>
      {days.map((d) => {
        const tasks = planTasks.filter((t) => t.date === d);
        const past = daysFromToday(d) < 0;
        return (
          <section key={d} id={`day-${d}`} aria-labelledby={`h-${d}`} className="scroll-mt-24">
            <div className="mb-2 flex items-end justify-between">
              <h2 id={`h-${d}`} className="font-semibold text-ink">
                {relativeDay(d)}
                {d !== TODAY && relativeDay(d) !== shortDate(d) ? <span className="font-normal text-muted"> · {shortDate(d)}</span> : null}
              </h2>
              <span className="text-sm tabular-nums text-muted">{tasks.reduce((a, t) => a + t.minutes, 0)} min</span>
            </div>
            {tasks.some((t) => t.type === "retest") ? (
              <Link href={`/assess/retests/${RETEST_ID}`} className="flex items-center gap-3 rounded-card border border-dashed border-faint bg-surface p-4 hover:border-line">
                <Target aria-hidden="true" className="size-5 text-primary-text" />
                <span className="flex-1 text-sm font-semibold text-ink">Retest: 9 new questions on this week&apos;s concepts</span>
                <span className="text-sm text-muted">20 min</span>
              </Link>
            ) : (
              <TaskList tasks={tasks} primaryFirst={d === TODAY && !past} compact />
            )}
          </section>
        );
      })}
    </div>
  );
}

function RetestPanel({ done, total }: { done: number; total: number }) {
  const unlocked = done === total;
  return (
    <section className="rounded-card-lg border-2 border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-sunken px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <CalendarClock aria-hidden="true" className="size-3.5" /> Scheduled
        </span>
        <span className="font-semibold text-ink">{shortDate(planMeta.retestOn)}</span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-ink">Retest: this week&apos;s 3 concepts</h2>
      <p className="mt-1 text-[15px] text-muted">9 new questions at the same difficulty. It measures whether the fix worked.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {planMeta.focus.map((id) => (
          <li key={id} className="flex items-center gap-2 text-[15px] text-ink">
            <Target aria-hidden="true" className="size-4 text-muted" />
            {conceptById(id).name}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {unlocked ? (
          <SpendLink href={`/assess/retests/${RETEST_ID}`} cost={COST.retest} what="A retest">
            Start retest
          </SpendLink>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <Lock aria-hidden="true" className="size-4" />
              Unlocks when you finish {total - done} more tasks, or on {shortDate(planMeta.retestOn)}
            </span>
            <Link href={`/assess/retests/${RETEST_ID}`} className={btn("secondary", "sm")}>
              View retest
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
