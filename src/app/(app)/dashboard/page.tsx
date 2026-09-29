import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, Route, Target, Zap } from "lucide-react";
import { COST, PLANS } from "@/lib/config";
import {
  DIAGNOSTIC_ID,
  TODAY,
  conceptById,
  credits,
  getAttemptConfig,
  learner,
  planMeta,
  planTasks,
  sampleDiagnosticResponses,
  stateFor,
  targetedConcepts,
} from "@/lib/data";
import { diagnose } from "@/lib/diagnosis";
import { daysFromToday, relativeDay, shortDate } from "@/lib/format";
import { Alert, ButtonLink, Card, CardHeader, Cost, PriorityBadge, ProgressBar, SeverityBadge, TextLink } from "@/components/ui";
import { GetCreditsButton } from "@/components/credit-gate";
import { Mascot } from "@/components/feedback";
import { PairedBar } from "@/components/charts";
import { TaskList } from "@/components/tasks";

export const metadata: Metadata = { title: "Home" };

/**
 * Home — a state machine, not a widget grid (Web App Structure §8.3).
 * `?state=new` previews S0 and `?state=out` previews S7 (credits exhausted);
 * the sample learner is in S4 (active plan).
 */
export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { state } = await props.searchParams;
  if (state === "new") return <NewLearner />;
  return <ActivePlan balance={state === "out" ? 0 : credits.balance} />;
}

/** Turns a balance into decisions (DS §14): what can I still do today? */
function enoughFor(balance: number) {
  if (balance >= COST.retest + COST.practiceSet5) {
    const sets = Math.floor((balance - COST.retest) / COST.practiceSet5);
    return `Enough for 1 retest and ${sets} practice ${sets === 1 ? "set" : "sets"}.`;
  }
  if (balance >= COST.practiceSet5) {
    const sets = Math.floor(balance / COST.practiceSet5);
    return `Enough for ${sets} practice ${sets === 1 ? "set" : "sets"}.`;
  }
  if (balance >= COST.hint) return "Enough for hints and explanations only.";
  return "Your plan and revision tasks don't need credits.";
}

function ContextLine() {
  return (
    <p className="mb-5 text-sm text-muted sm:mb-6">
      {shortDate(TODAY)} · {learner.subject} · {learner.exam} in {daysFromToday(learner.examDate)} days
    </p>
  );
}

/* ---------------- S0: no diagnostic yet ---------------- */

function NewLearner() {
  const steps = [
    { icon: ClipboardCheck, title: "Diagnose", body: "A 30-minute test finds the concepts behind your wrong answers." },
    { icon: Route, title: "Plan", body: "Your gaps, ordered by exam weight and cut to your daily time." },
    { icon: Target, title: "Retest", body: "Fresh questions confirm a gap actually closed." },
  ];
  return (
    <>
      <ContextLine />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card level="primary" className="p-6 sm:p-8 lg:col-span-8">
          <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-lg">
              <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">Take your first diagnostic</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                30 minutes, 15 questions from Class 11 Mechanics. You get a score, the concepts behind each wrong answer, and a plan
                that fits your {learner.dailyMinutes} minutes a day.
              </p>
              <p className="mt-3 text-sm font-semibold text-success-text">Free: covered by your 100 welcome credits.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ButtonLink href="/assess/diagnostic" size="lg">
                  Start diagnostic <Cost credits={COST.fullDiagnostic} />
                </ButtonLink>
              </div>
            </div>
            <Mascot size="md" />
          </div>
        </Card>
        <Card level="structural" className="p-6 lg:col-span-4">
          <CardHeader title="Your credits" />
          <p className="mt-3 font-display text-4xl tabular-nums text-ink">100</p>
          <p className="mt-1 text-sm text-muted">Welcome credits · expire in 30 days</p>
          <p className="mt-4 text-sm text-ink">Enough for your diagnostic and your first study plan.</p>
        </Card>
      </div>
      <section aria-labelledby="how" className="mt-8">
        <h2 id="how" className="text-lg font-semibold text-ink">What happens next</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-card border border-border-subtle bg-surface p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-card-sm border-2 border-line bg-primary/15">
                <s.icon aria-hidden="true" className="size-5 text-ink" />
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {i + 1}. {s.title}
                </p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/* ---------------- S4: active plan ---------------- */

function ActivePlan({ balance }: { balance: number }) {
  const today = planTasks.filter((t) => t.date === TODAY);
  const priority = today.find((t) => t.status === "pending")!;
  const pConcept = conceptById(priority.conceptId);
  const others = today.filter((t) => t.status === "pending" && t.id !== priority.id);
  const planned = today.reduce((a, t) => a + t.minutes, 0);

  const cfg = getAttemptConfig(DIAGNOSTIC_ID)!;
  const findings = diagnose(cfg.questionIds, sampleDiagnosticResponses);
  const pFinding = findings.find((f) => f.conceptId === priority.conceptId);
  const weak = findings.filter((f) => ["critical", "weak", "needs_work"].includes(f.severity)).slice(0, 3);

  const week = planTasks.filter((t) => t.date <= planMeta.retestOn && t.type !== "retest");
  const done = week.filter((t) => t.status === "completed").length;
  const plan = PLANS[learner.plan];

  const targeted = targetedConcepts.map((id) => stateFor(id)!);
  const baseAvg = Math.round(targeted.reduce((a, s) => a + (s.baselineMastery ?? s.mastery), 0) / targeted.length);
  const nowAvg = Math.round(targeted.reduce((a, s) => a + s.mastery, 0) / targeted.length);

  return (
    <>
      <ContextLine />
      {balance <= 0 ? (
        /* S7: above everything; non-credit work (the plan, revision tasks) stays usable. */
        <div className="mb-5">
          <Alert
            tone="warning"
            icon={Zap}
            title="You're out of credits."
            action={<GetCreditsButton balance={0} variant="secondary" size="sm" />}
          >
            {plan.period === "daily" ? "They refill at 00:00 IST." : "Your free credits refill on the 1st."} Revision tasks and your plan still work.
          </Alert>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Today's priority — the one dominant action (DS §14) */}
        <Card level="primary" className="flex flex-col p-5 sm:p-7 lg:col-span-8" aria-labelledby="today-priority">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge value={priority.priority} />
            <span className="text-sm text-muted">Today&apos;s priority</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{priority.minutes} min</span>
          </div>
          <h2 id="today-priority" className="mt-4 font-display text-2xl leading-tight text-ink sm:text-[28px]">
            {pConcept.name}
          </h2>
          <p className="mt-2 text-[15px] text-ink">
            Revise {priority.action.charAt(0).toLowerCase() + priority.action.slice(1)}, then {priority.then}.
          </p>
          {pFinding ? (
            <p className="mt-2 text-sm text-muted">
              Why: {pFinding.total - pFinding.correct} of {pFinding.total} incorrect in your diagnostic.
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-6">
            <ButtonLink href={`/plan/tasks/${priority.id}`} size="lg">
              Start task <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
            {others.length ? (
              <span className="text-sm text-muted">
                {others.length} more {others.length === 1 ? "task" : "tasks"} today · {others.reduce((a, t) => a + t.minutes, 0)} min
              </span>
            ) : null}
          </div>
        </Card>

        {/* Credits — turned into decisions ("Enough for…") */}
        <Card level="structural" className="flex flex-col p-5 sm:p-6 lg:col-span-4" aria-labelledby="credits-h">
          <CardHeader id="credits-h" title="Credits" meta={`${plan.name} plan`} />
          <p className="mt-4 font-display text-4xl leading-none tabular-nums text-ink">{balance}</p>
          <p className="mt-1.5 text-sm text-muted">of {plan.periodCredits} today · refills 00:00 IST</p>
          <div className="mt-3">
            <ProgressBar value={balance} max={plan.periodCredits} label="Credits left today" />
          </div>
          <p className="mt-4 text-sm text-ink">{enoughFor(balance)}</p>
          <TextLink href="/credits" className="mt-auto pt-3">
            Details
          </TextLink>
        </Card>

        {/* Today's plan */}
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="plan-h">
          <CardHeader
            id="plan-h"
            title="Today"
            meta={`${planned} of ${learner.dailyMinutes} min planned`}
            action={<TextLink href="/plan">Full plan <ArrowRight aria-hidden="true" className="size-4" /></TextLink>}
          />
          <div className="mt-4">
            <TaskList tasks={today} primaryFirst={false} compact />
          </div>
        </Card>

        {/* Weaknesses */}
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="weak-h">
          <CardHeader id="weak-h" title="Top weaknesses" meta="From your 27 Sep diagnostic" />
          <ul className="mt-3 divide-y divide-border-subtle">
            {weak.map((f) => (
              <li key={f.conceptId}>
                <Link
                  href={`/assess/results/${DIAGNOSTIC_ID}?concept=${f.conceptId}`}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-btn px-2 py-2 hover:bg-sunken"
                >
                  <SeverityBadge value={f.severity} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{conceptById(f.conceptId).name}</span>
                  <PriorityBadge value={f.priority} compact />
                </Link>
              </li>
            ))}
          </ul>
          <TextLink href={`/assess/results/${DIAGNOSTIC_ID}`} className="mt-2">
            View full report
          </TextLink>
        </Card>

        {/* Next retest */}
        <Card level="supporting" className="flex flex-col p-5 sm:p-6 lg:col-span-5" aria-labelledby="retest-h">
          <CardHeader id="retest-h" title="Next retest" />
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-sunken px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <CalendarClock aria-hidden="true" className="size-3.5" /> Scheduled
            </span>
            <span className="text-sm font-semibold text-ink">{relativeDay(planMeta.retestOn)}</span>
          </div>
          <p className="mt-3 text-sm text-ink">
            {planMeta.focus.length} concepts · about 20 min · new questions on this week&apos;s concepts
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>Finish this week&apos;s tasks to unlock it early</span>
              <span className="tabular-nums">
                {done} of {week.length}
              </span>
            </div>
            <ProgressBar value={done} max={week.length} label="Tasks completed this week" tone="ink" />
          </div>
          <TextLink href="/plan?view=retest" className="mt-auto pt-3">
            See retest details
          </TextLink>
        </Card>

        {/* Progress */}
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="progress-h">
          <CardHeader
            id="progress-h"
            title={`Targeted concepts: ${baseAvg}% → ${nowAvg}%`}
            meta={`+${nowAvg - baseAvg} pts since your first diagnostic, measured by 1 retest`}
            action={<TextLink href="/progress">Progress <ArrowRight aria-hidden="true" className="size-4" /></TextLink>}
          />
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {targeted.map((s) => (
              <div key={s.conceptId}>
                <p className="mb-2 text-sm font-semibold text-ink">{conceptById(s.conceptId).name}</p>
                <PairedBar before={s.baselineMastery ?? 0} after={s.mastery} label={conceptById(s.conceptId).name} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
