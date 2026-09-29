/**
 * Evidence, severity, priority bands and mastery smoothing — Web App Structure §1.9,
 * ALGORITHMS.md §2–§3. Pure: no I/O, no clock.
 */
import type { Question } from "@/lib/types";

/* ---------- Evidence, severity, priority (§1.9) ---------- */

export type Confidence = "insufficient" | "low" | "medium" | "high";
export type Severity = "strong" | "stable" | "needs_work" | "weak" | "critical" | "insufficient";
export type Priority = 1 | 2 | 3 | 4;

export function confidenceFor(scoredItems: number): Confidence {
  if (scoredItems <= 1) return "insufficient";
  if (scoredItems === 2) return "low";
  if (scoredItems <= 4) return "medium";
  return "high";
}

export function severityFor(mastery: number, confidence: Confidence): Severity {
  if (confidence === "insufficient") return "insufficient";
  if (mastery >= 80) return "strong";
  if (mastery >= 65) return "stable";
  if (mastery >= 50) return "needs_work";
  if (mastery >= 35) return "weak";
  return "critical";
}

export function priorityFor(score: number): Priority {
  if (score >= 0.75) return 1;
  if (score >= 0.5) return 2;
  if (score >= 0.25) return 3;
  return 4;
}

/** DS §39: a mastery number is only shown when evidence supports it. */
export const showsMasteryNumber = (c: Confidence) => c === "medium" || c === "high";

/** Retest outcome rule, §1.9. */
export function retestOutcome(delta: number, retestItems: number) {
  if (retestItems < 3) return "insufficient" as const;
  if (delta >= 10) return "improved" as const;
  if (delta <= -10) return "declined" as const;
  return "stable" as const;
}

/** Smoothed accuracy so 3/3 is not "100% mastery" from three questions (ALGORITHMS §3). */
export const masteryFrom = (correct: number, total: number) => Math.round((100 * (correct + 0.5)) / (total + 1));

/** MCQ: key match. Numerical: within the absolute tolerance. Blank or non-numeric is wrong (ALGORITHMS §1). */
export function isCorrect(q: Pick<Question, "type" | "answer" | "tolerance">, answer: string | null): boolean {
  if (answer === null || answer.trim() === "") return false;
  if (q.type === "mcq") return answer === q.answer;
  const given = Number(answer);
  return Number.isFinite(given) && Math.abs(given - Number(q.answer)) <= (q.tolerance ?? 0);
}
