/**
 * Retest selection and outcome — ALGORITHMS.md §10, BE-D55. Pure.
 */
import { RETEST_ITEMS_PER_CONCEPT, RETEST_SECONDS_PER_ITEM } from "@/domains/learning/constants";
import { attemptMastery, retestOutcome, type Difficulty, type EvidenceItem } from "@/domains/learning/rules";

export interface RetestPoolItem {
  id: string;
  difficulty: Difficulty;
  /** Items meant to measure the same thing as a baseline item. */
  parallelGroup: string | null;
  seen: boolean;
}

export interface BaselineItem {
  difficulty: Difficulty;
  parallelGroup: string | null;
}

export interface RetestPick {
  itemIds: string[];
  /** Fewer than `RETEST_ITEMS_PER_CONCEPT` unseen items exist: shown as "Insufficient evidence", plus a content alert (BE-D55). */
  insufficient: boolean;
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Three unseen retest items for one concept: for each baseline item, prefer the same
 * parallel group, then the same difficulty, then the nearest difficulty (ALG §10).
 */
export function selectRetestItems(baseline: BaselineItem[], pool: RetestPoolItem[]): RetestPick {
  const free = pool.filter((p) => !p.seen);
  const used = new Set<string>();
  const take = (p: RetestPoolItem | undefined) => {
    if (!p) return false;
    used.add(p.id);
    return true;
  };
  const targets: BaselineItem[] = Array.from({ length: RETEST_ITEMS_PER_CONCEPT }, (_, i) => baseline[i] ?? { difficulty: "medium" as const, parallelGroup: null });
  const ids: string[] = [];
  for (const t of targets) {
    const open = free.filter((p) => !used.has(p.id));
    const match =
      (t.parallelGroup ? open.find((p) => p.parallelGroup === t.parallelGroup) : undefined) ??
      open.find((p) => p.difficulty === t.difficulty) ??
      [...open].sort((a, b) => Math.abs(RANK[a.difficulty] - RANK[t.difficulty]) - Math.abs(RANK[b.difficulty] - RANK[t.difficulty]))[0];
    if (take(match)) ids.push(match!.id);
  }
  return { itemIds: ids, insufficient: ids.length < RETEST_ITEMS_PER_CONCEPT };
}

/** 3 minutes per item (ALG §10): 3 concepts → 9 items → 27 minutes. */
export const retestDurationSeconds = (itemCount: number) => itemCount * RETEST_SECONDS_PER_ITEM;

type Scored = Omit<EvidenceItem, "laterSessions">;

export interface ConceptRetestResult {
  before: number;
  after: number;
  delta: number;
  outcome: ReturnType<typeof retestOutcome>;
}

/** Compare attempt-scoped mastery of the retest with the baseline attempt for a concept. The LLM may explain this, never compute it. */
export function retestConceptResult(baseline: Scored[], retest: Scored[]): ConceptRetestResult {
  const before = attemptMastery(baseline);
  const after = attemptMastery(retest);
  const delta = after - before;
  return { before, after, delta, outcome: retestOutcome(delta, retest.length) };
}
