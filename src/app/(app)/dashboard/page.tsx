import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Route, Target, Zap } from "lucide-react";
import { COST, PLANS, enoughFor } from "@/lib/config";
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
import { Alert, ButtonLink, Card, CardHeader, Cost, ProgressBar, SeverityBadge, TextLink } from "@/components/ui";
import { GetCreditsButton } from "@/components/credit-gate";
import { Mascot } from "@/components/feedback";
import { PairedBar } from "@/components/charts";
import { TaskList } from "@/components/tasks";
import { InstallCard } from "@/components/pwa";

export const metadata: Metadata = { title: "Home" };

/**
 * Home — a state machine, not a widget grid (Web App Structure §8.3).
 * `?state=new` previews S0 and `?state=out` previews S7 (credits exhausted);
 * the sample learner is in S4 (active plan).
 * Every block answers one question no other block answers: what now, what can I spend,
 * what else today, when is the retest, what am I weak at, am I improving (§8.3, §8.22).
 */
export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { state } = await props.searchParams;
  if (state === "new") return <NewLearner />;
  return <ActivePlan balance={state === "out" ? 0 : credits.balance} />;
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
        <Card level="structural" className="flex flex-col p-6 lg:col-span-4">
          <CardHeader title="Your credits" />
          <p className="mt-3 font-display text-4xl tabular-nums text-ink">100</p>
          <p className="mt-1 text-sm text-muted">Welcome credits · expire in 30 days</p>
          <p className="mt-auto pt-4 text-sm text-ink">Enough for your diagnostic and your first study plan.</p>
        </Card>
      </div>
      <section aria-labelledby="how" className="mt-8">
        <h2 id="how" className="text-lg font-semibold text-ink">What happens next</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-card border border-border-subtle bg-surface p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-card-sm border border-line bg-primary/15">
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
  // The priority card already shows the first task; the list below is everything else today.
  const rest = today.filter((t) => t.id !== priority.id);
  const restPending = rest.filter((t) => t.status === "pending");

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
        {/* Row 1 · Today's priority — the one dominant action (DS §14) */}
        <Card level="primary" className="flex flex-col p-5 sm:p-7 lg:col-span-8 lg:col-start-1 lg:row-start-1" aria-labelledby="today-priority">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Today&apos;s priority</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{priority.minutes} min</span>
          </div>
          <h2 id="today-priority" className="mt-4 font-display text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
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
          <div className="mt-auto pt-6">
            <ButtonLink href={`/plan/tasks/${priority.id}`} size="lg">
              Start task <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
          </div>
        </Card>

        {/* Row 2 · The rest of today (the priority task is not repeated here) */}
        {rest.length ? (
          <Card level="supporting" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="plan-h">
            <CardHeader
              id="plan-h"
              title="Also today"
              meta={restPending.length ? `${restPending.length} to do · ${restPending.reduce((a, t) => a + t.minutes, 0)} min` : "All done"}
              action={<TextLink href="/plan">Full plan <ArrowRight aria-hidden="true" className="size-4" /></TextLink>}
            />
            <div className="mt-4">
              <TaskList tasks={rest} primaryFirst={false} />
            </div>
          </Card>
        ) : null}

        {/* Row 2 · Next retest */}
        <Card level="supporting" className={`flex flex-col p-5 sm:p-6 ${rest.length ? "lg:col-span-5" : "lg:col-span-12"}`} aria-labelledby="retest-h">
          <CardHeader id="retest-h" title="Next retest" meta={relativeDay(planMeta.retestOn)} />
          <p className="mt-3 text-sm text-muted">About 20 min · new questions on these concepts</p>
          <ul className="mt-2 divide-y divide-border-subtle">
            {planMeta.focus.map((id) => (
              <li key={id} className="flex items-center gap-2.5 py-2.5 text-[15px] text-ink">
                <Target aria-hidden="true" className="size-4 shrink-0 text-muted" />
                {conceptById(id).name}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>Tasks done this week</span>
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

        {/* Row 3 · What to work on */}
        <Card level="supporting" className="flex flex-col p-5 sm:p-6 lg:col-span-5" aria-labelledby="weak-h">
          <CardHeader id="weak-h" title="Top weaknesses" meta="From your 27 Sep diagnostic" />
          <ul className="mt-3 divide-y divide-border-subtle">
            {weak.map((f) => (
              <li key={f.conceptId}>
                <Link
                  href={`/assess/results/${DIAGNOSTIC_ID}?concept=${f.conceptId}`}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sunken/50"
                >
                  <SeverityBadge value={f.severity} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{conceptById(f.conceptId).name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <TextLink href={`/assess/results/${DIAGNOSTIC_ID}`} className="mt-auto pt-3">
            View full report
          </TextLink>
        </Card>

        {/* Row 3 · Am I improving? */}
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="progress-h">
          <CardHeader
            id="progress-h"
            title={`Targeted concepts: ${baseAvg}% → ${nowAvg}%`}
            meta={`+${nowAvg - baseAvg} pts since your first diagnostic`}
            action={<TextLink href="/progress">Progress <ArrowRight aria-hidden="true" className="size-4" /></TextLink>}
          />
          <div className="mt-5 flex flex-col gap-5">
            {targeted.map((s) => (
              <div key={s.conceptId}>
                <p className="mb-2 text-sm font-semibold text-ink">{conceptById(s.conceptId).name}</p>
                <PairedBar before={s.baselineMastery ?? 0} after={s.mastery} label={conceptById(s.conceptId).name} />
              </div>
            ))}
          </div>
        </Card>
        {/* Credits, turned into decisions ("Enough for…"). Last in the markup so small screens and keyboard order end here (the chip is already in the top bar); on desktop it is placed beside the priority card by grid position. */}
        <Card level="structural" className="flex flex-col p-5 sm:p-6 lg:col-span-4 lg:col-start-9 lg:row-start-1" aria-labelledby="credits-h">
          <CardHeader id="credits-h" title="Credits" meta={`${plan.name} plan`} />
          <p className="mt-4 text-lg font-semibold leading-snug text-ink">{enoughFor(balance)}</p>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {balance} of {plan.periodCredits} credits left today · refills 00:00 IST
          </p>
          <div className="mt-3">
            <ProgressBar value={balance} max={plan.periodCredits} label="Credits left today" />
          </div>
          <TextLink href="/credits" className="mt-auto pt-3">
            Details
          </TextLink>
        </Card>

      </div>
      {/* Only after a first diagnosis (§9.8). Last on the page so it can't shift anything above it. */}
      <InstallCard />
    </>
  );
}
