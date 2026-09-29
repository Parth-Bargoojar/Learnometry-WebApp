/**
 * Scoring and diagnostic item selection — ALGORITHMS.md §1 and §8. Pure: the server calls
 * these at finalize and at attempt start; the client never computes an official score.
 */
import { DIAGNOSTIC_ITEMS, ITEMS_PER_CONCEPT } from "@/domains/learning/constants";
import type { Confidence, Difficulty } from "@/domains/learning/rules";

export type Track = "jee_main" | "neet" | "cbse_11";
export type Outcome = "correct" | "incorrect" | "unanswered";

/** Marking by track (§1.9; verified against official documents at gate G5). */
export const MARKING: Record<Track, { correct: number; incorrect: number }> = {
  jee_main: { correct: 4, incorrect: -1 },
  neet: { correct: 4, incorrect: -1 },
  cbse_11: { correct: 1, incorrect: 0 },
};

export interface AnswerKey {
  type: "mcq" | "numerical";
  /** MCQ: the option key. Numerical: the number as text. */
  answer: string;
  /** Absolute tolerance. */
  tolerance?: number;
  /** Percentage tolerance, used when no absolute tolerance is given. */
  tolerancePct?: number;
}

/** Numerical default: exact for integers, 1% for non-integers (ALG §1). */
export function numericalTolerance(key: AnswerKey): number {
  const target = Number(key.answer);
  if (key.tolerance !== undefined) return key.tolerance;
  if (key.tolerancePct !== undefined) return (Math.abs(target) * key.tolerancePct) / 100;
  return Number.isInteger(target) ? 0 : Math.abs(target) * 0.01;
}

/** Non-numeric input is incorrect; blank is unanswered upstream. */
export function isAnswerCorrect(key: AnswerKey, given: string | null): boolean {
  if (given === null) return false;
  const text = given.trim();
  if (text === "") return false;
  if (key.type === "mcq") return text === key.answer;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return false;
  const value = Number(text);
  const target = Number(key.answer);
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  // Absorb float noise so 12.5 ± 0.1 accepts 12.6.
  return Math.abs(value - target) <= numericalTolerance(key) + 1e-9;
}

export function outcomeOf(key: AnswerKey, given: string | null): Outcome {
  if (given === null || given.trim() === "") return "unanswered";
  return isAnswerCorrect(key, given) ? "correct" : "incorrect";
}

export interface AttemptScore {
  score: number;
  max: number;
  /** 0–100 to one decimal; null for practice, which is not marked. */
  percentage: number | null;
  /** Correct ÷ answered, whole percent; 0 when nothing was answered. */
  accuracy: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
}

export function scoreOutcomes(track: Track, outcomes: Outcome[], opts: { marked: boolean }): AttemptScore {
  const marking = MARKING[track];
  const correct = outcomes.filter((o) => o === "correct").length;
  const incorrect = outcomes.filter((o) => o === "incorrect").length;
  const answered = correct + incorrect;
  const total = outcomes.length;
  const score = opts.marked ? correct * marking.correct + incorrect * marking.incorrect : correct;
  const max = opts.marked ? total * marking.correct : total;
  return {
    score,
    max,
    percentage: opts.marked && max > 0 ? Math.round((1000 * Math.max(score, 0)) / max) / 10 : null,
    accuracy: answered ? Math.round((100 * correct) / answered) : 0,
    correct,
    incorrect,
    unanswered: total - answered,
    total,
  };
}

/* ---------- Diagnostic selection (ALG §8) ---------- */

export type DiagnosticKind = "full" | "chapter" | "deep";

export function diagnosticFormat(kind: DiagnosticKind, track: Track) {
  const base = DIAGNOSTIC_ITEMS[kind === "deep" ? "full" : kind][track];
  const items = kind === "deep" ? base * 2 : base;
  return { items, perConcept: ITEMS_PER_CONCEPT[kind] };
}

export interface SelectableConcept {
  id: string;
  prerequisites: string[];
  /** Track weight, 0–1. */
  weight: number;
  /** Position in the curriculum: chapter, then topic, then concept. */
  chapterOrder: number;
  topicOrder: number;
  order: number;
  hasEvidence: boolean;
  confidence: Confidence;
}

export interface PoolItem {
  id: string;
  conceptId: string;
  difficulty: Difficulty;
  /** The learner has already seen this item. */
  seen: boolean;
}

const DIFF_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const CONF_RANK: Record<Confidence, number> = { insufficient: 0, low: 1, medium: 2, high: 3 };

/** Longest prerequisite chain inside the candidate set; roots are 0. Cycles are ignored (K7 prevents them). */
export function prerequisiteDepth(concepts: Pick<SelectableConcept, "id" | "prerequisites">[]): Map<string, number> {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    let depth = 0;
    for (const p of byId.get(id)?.prerequisites ?? []) if (byId.has(p)) depth = Math.max(depth, visit(p, stack) + 1);
    stack.delete(id);
    memo.set(id, depth);
    return depth;
  };
  for (const c of concepts) visit(c.id, new Set());
  return memo;
}

/** Concept order for a diagnostic: unassessed first, prerequisite roots first, heavier, earlier (ALG §8). */
export function orderConcepts(concepts: SelectableConcept[]): SelectableConcept[] {
  const depth = prerequisiteDepth(concepts);
  const allAssessed = concepts.every((c) => c.hasEvidence);
  return [...concepts].sort(
    (a, b) =>
      Number(a.hasEvidence) - Number(b.hasEvidence) ||
      (allAssessed ? CONF_RANK[a.confidence] - CONF_RANK[b.confidence] : 0) ||
      depth.get(a.id)! - depth.get(b.id)! ||
      b.weight - a.weight ||
      a.order - b.order,
  );
}

/** One easy, one medium, one hard per concept; fewer slots lean medium. */
function wantedDifficulties(quota: number): Difficulty[] {
  if (quota === 1) return ["medium"];
  if (quota === 2) return ["easy", "medium"];
  const cycle: Difficulty[] = ["easy", "medium", "hard"];
  return Array.from({ length: quota }, (_, i) => cycle[i % 3]);
}

const FALLBACK: Record<Difficulty, Difficulty[]> = {
  easy: ["easy", "medium", "hard"],
  medium: ["medium", "easy", "hard"],
  hard: ["hard", "medium", "easy"],
};

/** Pick `quota` unseen items for one concept, matching wanted difficulties and falling back to the nearest. */
export function pickForConcept(pool: PoolItem[], quota: number): PoolItem[] {
  const free = pool.filter((p) => !p.seen);
  const taken = new Set<string>();
  const out: PoolItem[] = [];
  for (const want of wantedDifficulties(quota)) {
    for (const d of FALLBACK[want]) {
      const hit = free.find((p) => p.difficulty === d && !taken.has(p.id));
      if (hit) {
        taken.add(hit.id);
        out.push(hit);
        break;
      }
    }
  }
  return out;
}

export interface DiagnosticSelection {
  itemIds: string[];
  conceptIds: string[];
  /** True when the pools could not fill the format (a content alert, BE-3). */
  short: boolean;
}

/**
 * Select and order the items of a diagnostic. `perConcept` items per concept until the
 * remaining slots are fewer, then one item each; a concept that cannot fill its quota
 * passes the shortfall on to the next (ALG §8).
 */
export function selectDiagnostic(input: {
  kind: DiagnosticKind;
  track: Track;
  concepts: SelectableConcept[];
  pool: PoolItem[];
}): DiagnosticSelection {
  const { items, perConcept } = diagnosticFormat(input.kind, input.track);
  const ordered = orderConcepts(input.concepts);
  let remaining = items;
  const chosen: { concept: SelectableConcept; items: PoolItem[] }[] = [];
  for (const concept of ordered) {
    if (remaining <= 0) break;
    const quota = remaining >= perConcept ? perConcept : 1;
    const picks = pickForConcept(
      input.pool.filter((p) => p.conceptId === concept.id),
      quota,
    );
    if (picks.length === 0) continue;
    chosen.push({ concept, items: picks });
    remaining -= picks.length;
  }
  // Paper order: chapter → topic → concept, easy → hard within a concept.
  chosen.sort(
    (a, b) =>
      a.concept.chapterOrder - b.concept.chapterOrder || a.concept.topicOrder - b.concept.topicOrder || a.concept.order - b.concept.order,
  );
  const itemIds = chosen.flatMap((c) => [...c.items].sort((x, y) => DIFF_RANK[x.difficulty] - DIFF_RANK[y.difficulty]).map((i) => i.id));
  return { itemIds, conceptIds: chosen.map((c) => c.concept.id), short: remaining > 0 };
}
