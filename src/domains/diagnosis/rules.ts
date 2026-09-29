/**
 * Deterministic scoring and evidence aggregation — PRD §4.8 stages 1–2, ALGORITHMS.md
 * §1–§3, §7. Pure: the caller supplies question/concept lookups and the wording for the
 * stage-3 text, so the same code runs on sample data now and on database rows later.
 * Stage 3 (root-cause interpretation) is an AI call in production.
 */
import { confidenceFor, isCorrect, masteryFrom, priorityFor, retestOutcome, severityFor } from "@/domains/learning/rules";
import type { AttemptConfig, Concept, ErrorCategory, Question, Response, WeaknessFinding } from "@/lib/types";

export interface DiagnosisDeps {
  questionById: (id: string) => Question;
  conceptById: (id: string) => Concept;
  concepts: Concept[];
  /** Stage-3 stand-in: the sentence for a concept's cause; the gateway supplies it in BE-7. */
  causeText: (conceptId: string, cause: ErrorCategory | null) => string;
  nextText: (conceptId: string, severity: WeaknessFinding["severity"]) => string;
}

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  conceptual: "Conceptual",
  prerequisite: "Prerequisite gap",
  calculation: "Calculation",
  misread: "Misread question",
  strategy: "Strategy",
  careless: "Careless slip",
  time_pressure: "Time pressure",
};

export function scoreAttempt(deps: Pick<DiagnosisDeps, "questionById">, config: AttemptConfig, responses: Response[]) {
  let correct = 0;
  let incorrect = 0;
  let seconds = 0;
  for (const id of config.questionIds) {
    const r = responses.find((x) => x.questionId === id);
    seconds += r?.seconds ?? 0;
    if (!r || r.answer === null || r.answer === "") continue;
    if (isCorrect(deps.questionById(id), r.answer)) correct++;
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

export function diagnose(deps: DiagnosisDeps, questionIds: string[], responses: Response[]): WeaknessFinding[] {
  const byConcept = new Map<string, Question[]>();
  for (const id of questionIds) {
    const q = deps.questionById(id);
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
    const dependents = deps.concepts.filter((c) => c.prerequisites.includes(x.conceptId) && weakIds.has(c.id)).length;
    return { ...x, p: (1 - x.mastery / 100) * deps.conceptById(x.conceptId).examWeight * (1 + 0.3 * dependents) };
  });
  const maxP = Math.max(...scored.map((x) => x.p), 0.0001);

  return scored
    .map((x): WeaknessFinding => {
      const concept = deps.conceptById(x.conceptId);
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
        causeText: deps.causeText(x.conceptId, x.cause),
        next: deps.nextText(x.conceptId, severity),
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
