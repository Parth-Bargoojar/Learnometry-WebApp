/**
 * Deterministic scoring and evidence aggregation — PRD §4.8 stages 1–2, ALGORITHMS.md
 * §1–§3, §7. Pure: the caller supplies question/concept lookups and the wording for the
 * stage-3 text, so the same code runs on sample data now and on database rows later.
 * Stage 3 (root-cause interpretation) is an AI call in production.
 */
import {
  CARELESS_TIME_SHARE,
  CAUSE_TIE_ORDER,
  LATE_POSITION_SHARE,
  WRONG_ANSWER_TOLERANCE_PCT,
} from "@/domains/learning/constants";
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

/* ---------- alg-v1: error classification (ALGORITHMS.md §5) ---------- */

export interface WrongAnswerEntry {
  value: number;
  category: ErrorCategory;
}

/** A numerical answer within ±1% of a known wrong answer maps to that entry's category. */
export function matchWrongAnswer(given: number, entries: WrongAnswerEntry[]): ErrorCategory | null {
  for (const e of entries) {
    const tol = (Math.abs(e.value) * WRONG_ANSWER_TOLERANCE_PCT) / 100;
    if (Math.abs(given - e.value) <= tol + 1e-12) return e.category;
  }
  return null;
}

export interface ItemEvidence {
  answered: boolean;
  correct: boolean;
  /** Zero-based position in the paper and the paper length. */
  position: number;
  totalItems: number;
  /** The timed attempt ran out of time. */
  hitDeadline: boolean;
  /** Category of the `misconception` tag on the chosen option, if any. */
  optionMisconception?: ErrorCategory | null;
  /** Category of a matched `wrong_answers` entry, if any (see `matchWrongAnswer`). */
  wrongAnswerCategory?: ErrorCategory | null;
  secondsSpent: number;
  expectedSeconds: number;
  /** The content marks this stem as easy to misread. */
  misreadRisk?: boolean;
  /** A direct prerequisite has mastery < 50 at Low confidence or better. */
  prerequisiteWeak: boolean;
  /** The learner tapped "Sure" (D8). */
  saidSure?: boolean;
}

export interface ItemClassification {
  /** An unanswered item that is not evidence of time pressure: excluded from the error profile. */
  skipped: boolean;
  candidates: ErrorCategory[];
}

const isLate = (position: number, total: number) => position >= total - Math.ceil(total * LATE_POSITION_SHARE);

/**
 * Stage 2 proposes candidate categories for one item; stage 3 (LLM) chooses among them
 * (ALG §5). Correct items have none.
 */
export function classifyItem(e: ItemEvidence): ItemClassification {
  if (!e.answered) {
    const timePressure = e.hitDeadline || isLate(e.position, e.totalItems);
    return timePressure ? { skipped: false, candidates: ["time_pressure"] } : { skipped: true, candidates: [] };
  }
  if (e.correct) return { skipped: false, candidates: [] };

  const found: ErrorCategory[] = [];
  const add = (c: ErrorCategory | null | undefined) => {
    if (c && !found.includes(c)) found.push(c);
  };
  add(e.optionMisconception);
  add(e.wrongAnswerCategory);
  if (e.expectedSeconds > 0 && e.secondsSpent < e.expectedSeconds * CARELESS_TIME_SHARE) add(e.misreadRisk ? "misread" : "careless");
  if (e.prerequisiteWeak) add("prerequisite");
  if (found.length === 0) found.push("conceptual");
  // D8: a confident wrong answer signals a misconception, so it leads.
  if (e.saidSure) return { skipped: false, candidates: ["conceptual", ...found.filter((c) => c !== "conceptual")] };
  return { skipped: false, candidates: found };
}

export interface ConceptCause {
  category: ErrorCategory | null;
  /** Fewer than two wrong items: shown with "likely" wording. */
  likely: boolean;
  counts: Partial<Record<ErrorCategory, number>>;
}

/** Deterministic concept-level cause: the most frequent candidate; ties by CAUSE_TIE_ORDER (ALG §5). */
export function conceptCause(items: ItemClassification[], wrongItems: number): ConceptCause {
  const counts: Partial<Record<ErrorCategory, number>> = {};
  for (const item of items) for (const c of item.candidates) counts[c] = (counts[c] ?? 0) + 1;
  let best: ErrorCategory | null = null;
  for (const c of CAUSE_TIE_ORDER) {
    const n = counts[c] ?? 0;
    if (n > 0 && (best === null || n > (counts[best] ?? 0))) best = c;
  }
  return { category: best, likely: wrongItems < 2, counts };
}

/** Error profile of a concept: how many items fell into each first-choice category (ALG §4). */
export function errorProfile(items: ItemClassification[]): Partial<Record<ErrorCategory, number>> {
  const profile: Partial<Record<ErrorCategory, number>> = {};
  for (const item of items) {
    const first = item.candidates[0];
    if (first) profile[first] = (profile[first] ?? 0) + 1;
  }
  return profile;
}

/* ---------- Stage-3 output validation (ALG §5, TRD §7.10) ---------- */

export interface RootCauseOutput {
  concept_id: string;
  category: ErrorCategory | "insufficient_evidence";
  cited_item_ids: string[];
  explanation: string;
  next_step: string;
  certainty: "low" | "medium" | "high";
}

export interface RootCauseContext {
  /** Candidate categories per concept, from stage 2. */
  candidates: Record<string, ErrorCategory[]>;
  /** Evidence item ids per concept. */
  evidence: Record<string, string[]>;
}

/** Reasons a stage-3 answer must be rejected; empty when it is acceptable. */
export function validateRootCause(out: RootCauseOutput, ctx: RootCauseContext): string[] {
  const problems: string[] = [];
  const allowed = ctx.candidates[out.concept_id];
  const evidence = ctx.evidence[out.concept_id];
  if (!allowed || !evidence) return ["unknown concept"];
  if (out.category !== "insufficient_evidence" && !allowed.includes(out.category)) problems.push("category outside the candidate set");
  const unknown = out.cited_item_ids.filter((id) => !evidence.includes(id));
  if (unknown.length) problems.push("cites unknown items");
  if (out.category !== "insufficient_evidence" && out.cited_item_ids.length === 0) problems.push("cites no evidence");
  if (out.certainty === "high" && evidence.length < 3) problems.push("high certainty with fewer than 3 evidence items");
  if (out.explanation.length > 240) problems.push("explanation too long");
  if (out.next_step.length > 160) problems.push("next step too long");
  return problems;
}
