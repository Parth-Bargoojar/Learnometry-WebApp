/**
 * Practice set selection — ALGORITHMS.md §9, BE-D54. Pure.
 */
import type { Difficulty, Severity } from "@/domains/learning/rules";

export interface PracticePoolItem {
  id: string;
  difficulty: Difficulty;
  /** Epoch ms of the last time the learner saw it; null = never. */
  lastSeenAt: number | null;
}

/** "Matched to you" difficulty mix by severity (§1.9). Shares add to 1. */
export function difficultyMix(severity: Severity): Record<Difficulty, number> {
  switch (severity) {
    case "critical":
    case "weak":
      return { easy: 0.6, medium: 0.4, hard: 0 };
    case "stable":
    case "strong":
      return { easy: 0, medium: 0.5, hard: 0.5 };
    default:
      return { easy: 0, medium: 1, hard: 0 };
  }
}

/** Whole-item counts per difficulty for a set of `size`; medium absorbs rounding, so a 50/50 split of 5 is 3 medium + 2 hard. */
export function mixCounts(severity: Severity, size: number): Record<Difficulty, number> {
  const mix = difficultyMix(severity);
  const easy = Math.round(mix.easy * size);
  const hard = Math.floor(mix.hard * size);
  return { easy, medium: size - easy - hard, hard };
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export interface PracticeSelection {
  itemIds: string[];
  /** Some items were seen before: the UI says "Some questions are ones you've seen before." */
  reusedSeen: boolean;
  /** The pool had fewer items than the set size. */
  short: boolean;
}

/**
 * Unseen first, then least recently seen (ALG §9). Difficulty targets fall back to the
 * nearest band when a band runs out. Returned easy → hard.
 */
export function selectPractice(input: { severity: Severity; size: number; pool: PracticePoolItem[] }): PracticeSelection {
  const order = (a: PracticePoolItem, b: PracticePoolItem) => (a.lastSeenAt ?? -Infinity) - (b.lastSeenAt ?? -Infinity) || a.id.localeCompare(b.id);
  const left = [...input.pool].sort(order);
  const chosen: PracticePoolItem[] = [];
  const counts = mixCounts(input.severity, input.size);

  for (const band of ["easy", "medium", "hard"] as const) {
    for (let n = 0; n < counts[band]; n++) {
      const nearest = left
        .filter((p) => !chosen.includes(p))
        .sort((a, b) => Math.abs(RANK[a.difficulty] - RANK[band]) - Math.abs(RANK[b.difficulty] - RANK[band]) || order(a, b));
      // Prefer an exact band, but never a seen item over an unseen one of a nearby band.
      const exactUnseen = nearest.find((p) => p.difficulty === band && p.lastSeenAt === null);
      const anyUnseen = nearest.find((p) => p.lastSeenAt === null);
      const pick = exactUnseen ?? anyUnseen ?? nearest.find((p) => p.difficulty === band) ?? nearest[0];
      if (pick) chosen.push(pick);
    }
  }
  const itemIds = chosen.sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty] || a.id.localeCompare(b.id)).map((p) => p.id);
  return { itemIds, reusedSeen: chosen.some((p) => p.lastSeenAt !== null), short: chosen.length < input.size };
}
