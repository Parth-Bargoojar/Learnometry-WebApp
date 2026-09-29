import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarClock } from "lucide-react";
import { practiceCost } from "@/lib/config";
import { DIAGNOSTIC_ID, chapterById, conceptById, getAttemptConfig, planTasks, practicePoolSize, sampleDiagnosticResponses } from "@/lib/data";
import { diagnose } from "@/lib/diagnosis";
import { relativeDay } from "@/lib/format";
import { ExplainButton, StepDone } from "@/components/task-steps";
import { SpendLink } from "@/components/credit-gate";

export const metadata: Metadata = { title: "Task" };

const KEY_IDEAS: Record<string, string[]> = {
  resolution: [
    "Draw the weight straight down, then split it along and perpendicular to the incline.",
    "The angle between the weight and the perpendicular to the incline equals the incline angle θ.",
    "Along the incline: mg sin θ. Into the surface: mg cos θ, balanced by the normal force.",
    "Check the extremes: at θ = 0 nothing pulls along the slope, so the along-slope part must be sin θ.",
  ],
  friction: [
    "Static friction matches whatever force tries to move the block, up to a limit.",
    "The limit is μs N. Only use μs N when the block is about to slip.",
    "Kinetic friction is μk N whenever the block is sliding.",
  ],
  circular: [
    "Centripetal force is not a new force; it is whichever real force points to the centre.",
    "Flat curve: friction supplies it, so v max = √(μ g r).",
    "Banked curve with no friction: tan θ = v² / (r g).",
  ],
};

export default async function TaskPage(props: PageProps<"/plan/tasks/[taskId]">) {
  const { taskId } = await props.params;
  const task = planTasks.find((t) => t.id === taskId);
  if (!task) notFound();
  const concept = conceptById(task.conceptId);
  const cfg = getAttemptConfig(DIAGNOSTIC_ID)!;
  const finding = diagnose(cfg.questionIds, sampleDiagnosticResponses).find((f) => f.conceptId === task.conceptId);
  // Never promise more questions than the validated bank holds (content gate G5).
  const practiceN = Math.min(task.practiceQuestions ?? 5, practicePoolSize(task.conceptId));
  const practiceSize = practiceN >= 15 ? 15 : practiceN >= 10 ? 10 : 5;
  const ideas = KEY_IDEAS[task.conceptId] ?? ["Revise the definitions and one worked example from your notes."];
  const reviseMin = task.practiceQuestions ? Math.max(10, task.minutes - 15) : task.minutes;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <p className="text-sm text-muted">
        {relativeDay(task.date)} · {task.minutes} min
      </p>

      {finding && finding.total - finding.correct > 0 ? (
        <p className="text-[15px] text-ink">
          Why: {finding.total - finding.correct} of {finding.total} incorrect in your 27 Sep diagnostic ·{" "}
          <Link href={`/assess/results/${DIAGNOSTIC_ID}?concept=${task.conceptId}`} className="font-semibold text-primary-text underline underline-offset-4">
            See the questions
          </Link>
        </p>
      ) : null}

      <section aria-labelledby="steps-h">
        <h2 id="steps-h" className="mb-3 text-lg font-semibold text-ink">
          Steps
        </h2>
        <ol className="flex flex-col gap-3">
          <li className="rounded-card-lg border border-line bg-surface p-5 shadow-brutal sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-on-ink">1</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink">
                    {task.type === "practice" ? "Warm up" : task.type === "review" ? "Review" : "Revise"} · {reviseMin} min
                  </h3>
                  <StepDone label="Mark revised" />
                </div>
                <p className="mt-1 text-[15px] text-ink">{task.action}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {ideas.map((idea) => (
                    <li key={idea} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                      <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary-deep" />
                      {idea}
                    </li>
                  ))}
                </ul>
                {finding?.cause ? (
                  <p className="mt-4 rounded-card-sm border border-warning/45 bg-warning/10 px-3 py-2 text-sm text-ink">
                    <span className="font-semibold">The mistake you made:</span> {finding.causeText}
                  </p>
                ) : null}
                <p className="mt-4 flex items-start gap-2 text-sm text-muted">
                  <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  Where to read: {chapterById(concept.chapterId).ncert} ({chapterById(concept.chapterId).name})
                </p>
                <div className="mt-4">
                  <ExplainButton concept={concept.name} conceptId={concept.id} />
                </div>
              </div>
            </div>
          </li>
          {task.practiceQuestions ? (
            <li className="rounded-card border border-border-subtle bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink">2</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink">Practice · {practiceN} questions</h3>
                  <p className="mt-1 text-sm text-muted">Targeted at this concept, matched to your level. Instant feedback after each answer.</p>
                  <SpendLink href={`/attempt/prac-${task.conceptId}-${practiceSize}`} cost={practiceCost(practiceN)} what="A practice set" className="mt-4">
                    Start practice
                  </SpendLink>
                </div>
              </div>
            </li>
          ) : null}
          {task.reviewOn ? (
            <li className="flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink">{task.practiceQuestions ? 3 : 2}</span>
              <div>
                <h3 className="font-semibold text-ink">Review · {relativeDay(task.reviewOn)}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <CalendarClock aria-hidden="true" className="size-4" /> Scheduled automatically in your plan
                </p>
              </div>
            </li>
          ) : null}
        </ol>
      </section>
    </div>
  );
}
