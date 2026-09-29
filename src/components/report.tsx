"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Minus, X as XIcon } from "lucide-react";
import type { AttemptConfig, Response, WeaknessFinding } from "@/lib/types";
import { COST, showsMasteryNumber } from "@/lib/config";
import { conceptById, credits, learner, questionById } from "@/lib/data";
import { CATEGORY_LABEL, diagnose, isCorrect, scoreAttempt } from "@/lib/diagnosis";
import { clock, duration } from "@/lib/format";
import { AIStatus } from "./ai-status";
import { Dialog } from "./dialog";
import { MathText } from "./math";
import { ConfidenceMeter, Cost, FieldLabel, SeverityBadge, btn } from "./ui";
import { useAttemptResponses } from "./use-result";
import { GetCreditsButton, SpendLink } from "./credit-gate";

const DIAGNOSIS_STEPS = ["Analyzing responses", "Checking evidence", "Building diagnosis", "Preparing recommendations"];
const PLAN_STEPS = ["Ordering your weak concepts", `Fitting them to ${learner.dailyMinutes} min a day`, "Scheduling your retest", "Writing task notes"];

export function Report({ config, fallback }: { config: AttemptConfig; fallback: Response[] }) {
  const { responses, own } = useAttemptResponses(config.id, fallback);
  const [stage, setStage] = useState<"analyzing" | "ready">(own ? "analyzing" : "ready");
  const [seenOwn, setSeenOwn] = useState(false);
  if (own && !seenOwn) {
    setSeenOwn(true);
    setStage("analyzing");
  }

  if (!responses) return <ReportSkeleton />;

  const score = scoreAttempt(config, responses);
  const findings = diagnose(config.questionIds, responses);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <ScoreSummary score={score} durationSeconds={config.durationSeconds} />
      {stage === "analyzing" ? (
        <AIStatus title="Building your diagnosis" steps={DIAGNOSIS_STEPS} stepMs={700} onDone={() => setStage("ready")} />
      ) : (
        <Diagnosis findings={findings} config={config} responses={responses} />
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading your report">
      <div className="skeleton h-4 w-60" />
      <div className="skeleton h-28 w-full" />
      <div className="skeleton h-24 w-full" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}

function ScoreSummary({ score, durationSeconds }: { score: ReturnType<typeof scoreAttempt>; durationSeconds: number | null }) {
  return (
    <section aria-labelledby="score-h" className="rounded-card-lg border border-line bg-surface p-5 sm:p-6">
      <h2 id="score-h" className="sr-only">
        Your score
      </h2>
      <dl className="grid grid-cols-2 gap-5">
        <div>
          <dt className="text-xs font-semibold text-muted">Score</dt>
          <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink sm:text-4xl">
            {score.score}
            <span className="text-lg text-muted"> / {score.max}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Accuracy</dt>
          <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink sm:text-4xl">{score.accuracy}%</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">
        Attempted {score.attempted} of {score.total} · {clock(score.seconds)} used{durationSeconds ? ` of ${clock(durationSeconds)}` : ""}
      </p>
    </section>
  );
}

function Diagnosis({ findings, config, responses }: { findings: WeaknessFinding[]; config: AttemptConfig; responses: Response[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const evidenceFor = params.get("concept");
  const [showAll, setShowAll] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  const weak = findings.filter((f) => ["critical", "weak", "needs_work"].includes(f.severity));
  const insufficient = findings.filter((f) => f.severity === "insufficient");
  const strong = findings.filter((f) => f.severity === "strong" || f.severity === "stable");
  const top = weak[0];
  const shown = showAll ? weak : weak.slice(0, 3);

  const setConcept = (id: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("concept", id);
    else sp.delete("concept");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  return (
    <>
      {top ? (
        <section aria-labelledby="bottleneck" className="rounded-card-lg border border-border-subtle bg-surface p-5 sm:p-6">
          <div className="border-l-4 border-line pl-4">
            <h2 id="bottleneck" className="text-xs font-bold uppercase tracking-wider text-muted">
              Your main bottleneck
            </h2>
            <p className="mt-1.5 text-lg font-semibold leading-snug text-ink sm:text-xl">
              {conceptById(top.conceptId).name}. {top.causeText}
            </p>
            <div className="mt-2 text-sm text-muted">
              <ConfidenceMeter value={top.confidence} />
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-card-lg border border-success/40 bg-success/5 p-5">
          <p className="text-lg font-semibold text-ink">No weak concepts in this test.</p>
          <p className="mt-1 text-sm text-muted">Take a full diagnostic to check the rest of the unit.</p>
        </section>
      )}

      {weak.length ? (
        <section aria-labelledby="fix-h">
          <h2 id="fix-h" className="mb-3 text-lg font-semibold text-ink">
            Fix these first
          </h2>
          <div className="flex flex-col gap-3">
            {shown.map((f, i) => (
              <WeaknessCard key={f.conceptId} f={f} defaultOpen={i === 0} onEvidence={() => setConcept(f.conceptId)} />
            ))}
          </div>
          {weak.length > 3 && !showAll ? (
            <button type="button" onClick={() => setShowAll(true)} className={btn("ghost", "md", "mt-3")}>
              Show all {weak.length}
            </button>
          ) : null}
        </section>
      ) : null}

      {insufficient.length ? (
        <Group title={`Not enough evidence yet (${insufficient.length})`} dashed>
          {insufficient.map((f) => (
            <GroupRow key={f.conceptId} f={f} />
          ))}
        </Group>
      ) : null}

      {strong.length ? (
        <Group title={`You can skip these for now (${strong.length})`}>
          {strong.map((f) => (
            <GroupRow key={f.conceptId} f={f} />
          ))}
        </Group>
      ) : null}

      <Link href={`/assess/results/${config.id}/review`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary-text underline underline-offset-4 hover:text-ink">
        Review every question <ArrowRight aria-hidden="true" className="size-4" />
      </Link>

      {weak.length ? (
        <div className="sticky bottom-[calc(var(--bottomnav-h)+12px)] z-10 lg:bottom-4">
          <div className="flex flex-col gap-3 rounded-card-lg border border-line bg-surface px-4 py-3 shadow-brutal sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-ink">
              <span className="font-semibold">{weak.length} concepts to fix.</span> Your plan fits them into {learner.dailyMinutes} min a day.
            </p>
            {credits.balance >= COST.studyPlan ? (
              <button type="button" onClick={() => setPlanOpen(true)} className={btn("primary", "md", "w-full sm:w-auto")}>
                Build my plan <Cost credits={COST.studyPlan} />
              </button>
            ) : (
              <GetCreditsButton cost={COST.studyPlan} balance={credits.balance} what="A study plan" />
            )}
          </div>
        </div>
      ) : null}

      <EvidenceSheet conceptId={evidenceFor} config={config} responses={responses} findings={findings} onClose={() => setConcept(null)} />

      <Dialog
        open={planOpen}
        onClose={() => !building && setPlanOpen(false)}
        dismissible={!building}
        title={building ? "Building your plan" : "Build your study plan"}
        description={building ? undefined : "Your weak concepts, in the right order, sized to your day."}
      >
        {building ? (
          <AIStatus title="Your plan" steps={PLAN_STEPS} stepMs={650} onDone={() => router.push("/plan")} />
        ) : (
          <>
            <dl className="divide-y divide-border-subtle rounded-card-sm border border-border-subtle">
              {[
                ["Starts", "Today"],
                ["Daily time", `${learner.dailyMinutes} min`],
                ["First retest", "In 6 days"],
                ["Concepts this week", `${Math.min(weak.length, 3)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted">You can change your daily time any time; rescheduling is free.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPlanOpen(false)} className={btn("secondary")}>
                Not now
              </button>
              <button type="button" onClick={() => setBuilding(true)} className={btn("primary")}>
                Build plan <Cost credits={COST.studyPlan} />
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}

export function EvidenceDots({ marks }: { marks: WeaknessFinding["marks"] }) {
  const wrong = marks.filter((m) => m !== "correct").length;
  return (
    <span className="inline-flex items-center gap-1">
      {marks.map((m, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`flex size-5 items-center justify-center rounded-md ${
            m === "correct" ? "bg-success/15 text-success-text" : m === "incorrect" ? "bg-danger/15 text-danger-text" : "bg-sunken text-muted"
          }`}
        >
          {m === "correct" ? <Check className="size-3.5" strokeWidth={3} /> : m === "incorrect" ? <XIcon className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" strokeWidth={3} />}
        </span>
      ))}
      <span className="sr-only">
        {wrong} of {marks.length} incorrect or unanswered
      </span>
    </span>
  );
}

function WeaknessCard({ f, defaultOpen, onEvidence }: { f: WeaknessFinding; defaultOpen: boolean; onEvidence: () => void }) {
  const c = conceptById(f.conceptId);
  return (
    <details open={defaultOpen} className="group rounded-card border border-border-subtle bg-surface">
      <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <SeverityBadge value={f.severity} size="sm" />
        <h3 className="min-w-0 flex-1 basis-40 text-[17px] font-semibold leading-snug text-ink">{c.name}</h3>
        <span className="text-sm text-muted">
          {f.total - f.correct} of {f.total} incorrect
        </span>
        <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-1 gap-4 border-t border-border-subtle p-5 sm:grid-cols-2">
        <div>
          <FieldLabel note="from your answers">Evidence</FieldLabel>
          <div className="mt-2">
            <EvidenceDots marks={f.marks} />
          </div>
          {showsMasteryNumber(f.confidence) ? <p className="mt-2 text-xs text-muted">Estimated mastery {f.mastery}%</p> : null}
        </div>
        <div>
          <FieldLabel note="interpretation">Likely cause</FieldLabel>
          {f.cause ? (
            <span className="mt-1.5 inline-flex rounded-full border border-border-subtle bg-sunken px-2.5 py-0.5 text-xs font-semibold text-ink">
              {CATEGORY_LABEL[f.cause]}
            </span>
          ) : null}
          <p className="mt-1.5 text-sm text-ink">{f.causeText}</p>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Next</FieldLabel>
          <p className="mt-1.5 text-sm font-medium text-ink">{f.next}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-5 py-3">
        <button type="button" onClick={onEvidence} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4 hover:text-ink">
          See the {f.total} questions
        </button>
        <SpendLink href={`/attempt/prac-${f.conceptId}-5`} cost={COST.practiceSet5} what="A practice set" variant="secondary" size="sm">
          Practice this
        </SpendLink>
      </div>
    </details>
  );
}

function Group({ title, dashed = false, children }: { title: string; dashed?: boolean; children: React.ReactNode }) {
  return (
    <details className={`group rounded-card bg-surface ${dashed ? "border border-dashed border-faint" : "border border-border-subtle"}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <ul className="divide-y divide-border-subtle border-t border-border-subtle">{children}</ul>
    </details>
  );
}

function GroupRow({ f }: { f: WeaknessFinding }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <SeverityBadge value={f.severity} size="sm" />
      <span className="min-w-0 flex-1 text-[15px] text-ink">{conceptById(f.conceptId).name}</span>
      <span className="text-sm text-muted">
        {f.correct} of {f.total} correct
      </span>
    </li>
  );
}

function EvidenceSheet({
  conceptId,
  config,
  responses,
  findings,
  onClose,
}: {
  conceptId: string | null;
  config: AttemptConfig;
  responses: Response[];
  findings: WeaknessFinding[];
  onClose: () => void;
}) {
  const f = findings.find((x) => x.conceptId === conceptId);
  const qs = useMemo(() => config.questionIds.map(questionById).filter((q) => q.conceptId === conceptId), [config, conceptId]);
  if (!conceptId || !f) return <Dialog open={false} onClose={onClose} title="Evidence" variant="sheet">{null}</Dialog>;
  return (
    <Dialog open onClose={onClose} title={conceptById(conceptId).name} description={`${f.total - f.correct} of ${f.total} incorrect · the questions behind this finding`} variant="sheet">
      <ol className="flex flex-col gap-3">
        {qs.map((q) => {
          const r = responses.find((x) => x.questionId === q.id);
          const ok = isCorrect(q, r?.answer ?? null);
          const given = r?.answer ?? null;
          return (
            <li key={q.id} className="rounded-card-sm border border-border-subtle p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted">Q{config.questionIds.indexOf(q.id) + 1}</span>
                <span className={`text-xs font-bold ${ok ? "text-success-text" : given ? "text-danger-text" : "text-muted"}`}>
                  {ok ? "Correct" : given ? "Incorrect" : "Not answered"}
                </span>
              </div>
              <MathText as="p" className="mt-2 line-clamp-3 text-sm text-ink">
                {q.stem}
              </MathText>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Your answer</dt>
                  <dd className="font-semibold text-ink">{given ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Correct</dt>
                  <dd className="font-semibold text-ink">{q.answer}</dd>
                </div>
                <div>
                  <dt className="text-muted">Time</dt>
                  <dd className="font-semibold text-ink">
                    {duration(r?.seconds ?? 0)} <span className="font-normal text-muted">/ {duration(q.expectedSeconds)}</span>
                  </dd>
                </div>
              </dl>
              {!ok && q.missCause ? (
                <p className="mt-2 text-xs text-muted">
                  Error type: <span className="font-semibold text-ink">{CATEGORY_LABEL[given ? q.missCause : "time_pressure"]}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <SpendLink href={`/attempt/prac-${conceptId}-5`} cost={COST.practiceSet5} what="A practice set" className="mt-5 w-full">
        Practice this
      </SpendLink>
    </Dialog>
  );
}
