/**
 * Deterministic scoring and evidence aggregation — PRD §4.8 stages 1–2.
 * Stage 3 (root-cause interpretation) is an AI call in production; here it is the
 * `CAUSE_TEXT` lookup, which has the same output shape the gateway will return.
 */
import { confidenceFor, priorityFor, retestOutcome, severityFor } from "./config";
import { conceptById, concepts, questionById } from "./data";
import type { AttemptConfig, ErrorCategory, Question, Response, WeaknessFinding } from "./types";

export function isCorrect(q: Question, answer: string | null): boolean {
  if (answer === null || answer.trim() === "") return false;
  if (q.type === "mcq") return answer === q.answer;
  const given = Number(answer);
  return Number.isFinite(given) && Math.abs(given - Number(q.answer)) <= (q.tolerance ?? 0);
}

export function scoreAttempt(config: AttemptConfig, responses: Response[]) {
  let correct = 0;
  let incorrect = 0;
  let seconds = 0;
  for (const id of config.questionIds) {
    const r = responses.find((x) => x.questionId === id);
    seconds += r?.seconds ?? 0;
    if (!r || r.answer === null || r.answer === "") continue;
    if (isCorrect(questionById(id), r.answer)) correct++;
    else incorrect++;
  }
  const total = config.questionIds.length;
  const attempted = correct + incorrect;
  return {
    score: correct * config.marking.correct + incorrect * config.marking.incorrect,
    max: total * config.marking.correct,
    correct,
    incorrect,
    unanswered: total - attempted,
    attempted,
    total,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    seconds,
  };
}

/** Smoothed accuracy so 3/3 is not "100% mastery" from three questions. */
export const masteryFrom = (correct: number, total: number) => Math.round((100 * (correct + 0.5)) / (total + 1));

const CAUSE_TEXT: Record<string, string> = {
  "resolution:conceptual": "Took mg cos θ along the incline, the component that belongs to the normal force.",
  "friction:conceptual": "Used the limiting value μN when the block was not about to slip.",
  "circular:time_pressure": "The method is right; one question was left unanswered near the end.",
  "circular:conceptual": "Unclear which force supplies the centripetal force in the set-up.",
  "vectors:conceptual": "Swapped the sin and cos components of a vector.",
  "work-energy:calculation": "Arithmetic slip in the change of kinetic energy.",
};

const CAUSE_FALLBACK: Record<ErrorCategory, string> = {
  conceptual: "The idea behind the question is not yet secure.",
  prerequisite: "A concept this one builds on needs work first.",
  calculation: "The method was right; an arithmetic step went wrong.",
  misread: "The question was misread.",
  strategy: "The approach chosen made the problem longer than it needed to be.",
  careless: "A small slip on a question you can do.",
  time_pressure: "Ran short of time on this concept.",
};

const NEXT_TEXT: Record<string, string> = {
  resolution: "Revise the incline components, then 10 targeted questions.",
  friction: "Practise limiting vs actual friction: 10 questions.",
  circular: "A timed practice set. The method is already right.",
};

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  conceptual: "Conceptual",
  prerequisite: "Prerequisite gap",
  calculation: "Calculation",
  misread: "Misread question",
  strategy: "Strategy",
  careless: "Careless slip",
  time_pressure: "Time pressure",
};

export function diagnose(questionIds: string[], responses: Response[]): WeaknessFinding[] {
  const byConcept = new Map<string, Question[]>();
  for (const id of questionIds) {
    const q = questionById(id);
    byConcept.set(q.conceptId, [...(byConcept.get(q.conceptId) ?? []), q]);
  }

  const raw = [...byConcept.entries()].map(([conceptId, qs]) => {
    const marks = qs.map((q) => {
      const r = responses.find((x) => x.questionId === q.id);
      if (!r || r.answer === null || r.answer === "") return "unanswered" as const;
      return isCorrect(q, r.answer) ? ("correct" as const) : ("incorrect" as const);
    });
    const correct = marks.filter((m) => m === "correct").length;
    const mastery = masteryFrom(correct, qs.length);
    const seconds = qs.map((q) => responses.find((x) => x.questionId === q.id)?.seconds ?? 0);
    const causes = qs
      .map((q, i) => (marks[i] === "unanswered" ? "time_pressure" : marks[i] === "incorrect" ? q.missCause ?? "conceptual" : null))
      .filter((c): c is ErrorCategory => c !== null);
    const cause = mostCommon(causes);
    return { conceptId, qs, marks, correct, mastery, seconds, cause };
  });

  // Priority ≈ weakness × exam weight × (1 + dependents that are also weak), PRD §4.9.
  const weakIds = new Set(raw.filter((x) => x.mastery < 65).map((x) => x.conceptId));
  const scored = raw.map((x) => {
    const dependents = concepts.filter((c) => c.prerequisites.includes(x.conceptId) && weakIds.has(c.id)).length;
    return { ...x, p: (1 - x.mastery / 100) * conceptById(x.conceptId).examWeight * (1 + 0.3 * dependents) };
  });
  const maxP = Math.max(...scored.map((x) => x.p), 0.0001);

  return scored
    .map((x): WeaknessFinding => {
      const concept = conceptById(x.conceptId);
      const confidence = confidenceFor(x.qs.length);
      const severity = severityFor(x.mastery, confidence);
      return {
        conceptId: x.conceptId,
        severity,
        confidence,
        priority: priorityFor(x.p / maxP),
        mastery: x.mastery,
        correct: x.correct,
        total: x.qs.length,
        marks: x.marks,
        avgSeconds: Math.round(x.seconds.reduce((a, b) => a + b, 0) / x.qs.length),
        expectedSeconds: Math.round(x.qs.reduce((a, q) => a + q.expectedSeconds, 0) / x.qs.length),
        cause: x.cause,
        causeText: x.cause ? CAUSE_TEXT[`${x.conceptId}:${x.cause}`] ?? CAUSE_FALLBACK[x.cause] : "No errors on this concept.",
        next:
          severity === "strong" || severity === "stable"
            ? "Nothing to do now. A later retest checks it again."
            : NEXT_TEXT[x.conceptId] ?? "Revise the concept, then a 5-question practice set.",
        minutes: concept.estimatedMinutes,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.mastery - b.mastery);
}

export function compareRetest(baseline: WeaknessFinding[], retest: WeaknessFinding[]) {
  return retest.map((r) => {
    const b = baseline.find((x) => x.conceptId === r.conceptId);
    const before = b?.mastery ?? r.mastery;
    const delta = r.mastery - before;
    return { conceptId: r.conceptId, before, after: r.mastery, delta, outcome: retestOutcome(delta, r.total), total: r.total, correct: r.correct };
  });
}

function mostCommon<T>(items: T[]): T | null {
  if (!items.length) return null;
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
