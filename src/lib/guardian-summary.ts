/**
 * `GET /api/guardian/learners/:id/summary` (CONTEXT §7.8), shaped for parents.
 * It contains only what D5 allows a guardian to see: scores, topic names with
 * severity, plan completion, retest dates and outcomes. Never question text,
 * answers, evidence, notifications or settings.
 */
import { PLANS, retestOutcome, type Severity } from "./config";
import {
  DIAGNOSTIC_ID,
  conceptById,
  getAttemptConfig,
  learner,
  pastRetests,
  planMeta,
  planTasks,
  reports,
  sampleDiagnosticResponses,
  scoreTrend,
  stateFor,
  targetedConcepts,
} from "./data";
import { diagnose } from "./diagnosis";

export interface GuardianSummary {
  learnerId: string;
  firstName: string;
  lastName: string;
  exam: string;
  className: string;
  planName: string;
  passEnds: string;
  dailyMinutes: number;
  lastDiagnostic: { date: string; score: number; max: number; pct: number } | null;
  weakTopics: { name: string; severity: Severity }[];
  strongTopics: string[];
  focusThisWeek: string[];
  week: { done: number; total: number };
  nextRetest: string;
  retests: { date: string; title: string; outcomes: { name: string; before: number; after: number; outcome: ReturnType<typeof retestOutcome> }[] }[];
  targeted: { name: string; before: number; after: number }[];
  trend: typeof scoreTrend;
}

export function guardianSummary(learnerId: string): GuardianSummary | null {
  if (learnerId !== learner.id) return null;

  const cfg = getAttemptConfig(DIAGNOSTIC_ID)!;
  const findings = diagnose(cfg.questionIds, sampleDiagnosticResponses);
  const diag = reports.find((r) => r.kind === "diagnostic" && r.status === "ready") ?? null;
  const week = planTasks.filter((t) => t.date <= planMeta.retestOn && t.type !== "retest");

  return {
    learnerId,
    firstName: learner.firstName,
    lastName: learner.lastName,
    exam: learner.exam,
    className: learner.className,
    planName: PLANS[learner.plan].name,
    passEnds: learner.passEnds,
    dailyMinutes: learner.dailyMinutes,
    lastDiagnostic: diag ? { date: diag.date, score: diag.score, max: diag.max, pct: Math.round((100 * diag.score) / diag.max) } : null,
    weakTopics: findings
      .filter((f) => f.severity === "critical" || f.severity === "weak" || f.severity === "needs_work")
      .slice(0, 3)
      .map((f) => ({ name: conceptById(f.conceptId).name, severity: f.severity })),
    strongTopics: findings.filter((f) => f.severity === "strong").map((f) => conceptById(f.conceptId).name),
    focusThisWeek: planMeta.focus.map((id) => conceptById(id).name),
    week: { done: week.filter((t) => t.status === "completed").length, total: week.length },
    nextRetest: planMeta.retestOn,
    retests: pastRetests.map((r) => ({
      date: r.date,
      title: r.title,
      outcomes: r.results.map((x) => ({
        name: conceptById(x.conceptId).name,
        before: x.baseline,
        after: x.retest,
        outcome: retestOutcome(x.retest - x.baseline, x.items),
      })),
    })),
    targeted: targetedConcepts.map((id) => {
      const s = stateFor(id)!;
      return { name: conceptById(id).name, before: s.baselineMastery ?? s.mastery, after: s.mastery };
    }),
    trend: scoreTrend,
  };
}
