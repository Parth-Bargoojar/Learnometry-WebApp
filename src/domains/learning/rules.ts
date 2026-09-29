/**
 * Evidence, severity, priority bands and mastery smoothing — Web App Structure §1.9,
 * ALGORITHMS.md §2–§3. Pure: no I/O, no clock.
 */
import type { Question } from "@/lib/types";
import {
  CONFIDENCE_SCORE,
  DIFFICULTY_WEIGHT,
  EVIDENCE_WINDOW,
  FORGETTING_DAYS,
  IMPROVEMENT_BY_SEVERITY,
  INSUFFICIENT_WEAKNESS,
  MIN_INTERVENTION_MINUTES,
  PREREQUISITE_BOOST,
  RECENCY_DECAY,
  SOURCE_WEIGHT,
  UNANSWERED_WEIGHT_FACTOR,
} from "./constants";

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

/* ---------- alg-v1: evidence, mastery, forgetting, priority (ALGORITHMS.md §2–§7) ---------- */

export type Difficulty = "easy" | "medium" | "hard";
export type EvidenceSource = keyof typeof SOURCE_WEIGHT;

export interface EvidenceItem {
  correct: boolean;
  /** False for an unanswered item in a timed attempt. */
  answered: boolean;
  difficulty: Difficulty;
  source: EvidenceSource;
  /** Later attempts or practice sessions on this concept; items of one session share k. */
  laterSessions: number;
}

/** Weight of one item (ALG §3). */
export function evidenceWeight(item: EvidenceItem): number {
  const w = RECENCY_DECAY ** item.laterSessions * DIFFICULTY_WEIGHT[item.difficulty] * SOURCE_WEIGHT[item.source];
  return item.answered ? w : w * UNANSWERED_WEIGHT_FACTOR;
}

/** Recency- and quality-weighted, Laplace-smoothed accuracy, 0–100 (ALG §3). */
export function weightedMastery(items: EvidenceItem[]): number {
  let num = 0;
  let den = 0;
  for (const item of items) {
    const w = evidenceWeight(item);
    num += item.correct && item.answered ? w : 0;
    den += w;
  }
  return Math.round((100 * (num + 0.5)) / (den + 1));
}

/** Mastery of one attempt only, for before/after comparisons: every item has k = 0 (ALG §3). */
export const attemptMastery = (items: Omit<EvidenceItem, "laterSessions">[]) =>
  weightedMastery(items.map((i) => ({ ...i, laterSessions: 0 })));

export interface SessionedEvidence extends Omit<EvidenceItem, "laterSessions"> {
  sessionId: string;
  /** Session time in ms since epoch (items of a session share it). */
  at: number;
}

/**
 * Keep the most recent `EVIDENCE_WINDOW` items and derive k from the sessions: k is the
 * number of sessions that happened later than the item's own (ALG §2–§3).
 */
export function evidenceWindow(items: SessionedEvidence[]): EvidenceItem[] {
  const sessionAt = new Map<string, number>();
  for (const i of items) sessionAt.set(i.sessionId, Math.max(sessionAt.get(i.sessionId) ?? 0, i.at));
  const recent = [...items].sort((a, b) => b.at - a.at).slice(0, EVIDENCE_WINDOW);
  return recent.map(({ sessionId, at, ...rest }) => {
    void at;
    let later = 0;
    for (const t of sessionAt.values()) if (t > (sessionAt.get(sessionId) ?? 0)) later++;
    return { ...rest, laterSessions: later };
  });
}

/** Confidence from the number of evidence items in the window (ALG §2). */
export const evidenceConfidence = (itemCount: number): Confidence => confidenceFor(Math.min(itemCount, EVIDENCE_WINDOW));

/** Mastery for display and bands: null while evidence is insufficient (DS §39). */
export function masteryFor(items: EvidenceItem[]): { mastery: number; confidence: Confidence; severity: Severity } {
  const confidence = evidenceConfidence(items.length);
  const mastery = weightedMastery(items);
  return { mastery, confidence, severity: severityFor(mastery, confidence) };
}

/** `forgetting = 1 − exp(−days/21)`; never seen → 1 (ALG §6). */
export const forgetting = (daysSinceSeen: number | null): number =>
  daysSinceSeen === null ? 1 : 1 - Math.exp(-Math.max(0, daysSinceSeen) / FORGETTING_DAYS);

export interface PriorityInput {
  conceptId: string;
  /** 0–100; ignored when severity is `insufficient`. */
  mastery: number;
  severity: Severity;
  /** Track weight, 0–1. */
  examWeight: number;
  /** Direct dependents that are weak, needs-work or unassessed. */
  weakDependents: number;
  forgetting: number;
  estimatedMinutes: number;
}

export interface PriorityResult {
  conceptId: string;
  raw: number;
  /** 0–1, relative to the top concept. */
  score: number;
  band: Priority;
}

/** PRD §4.9 made exact (ALG §7). Returns concepts ranked by priority, highest first. */
export function rankPriorities(inputs: PriorityInput[]): PriorityResult[] {
  const maxDependents = Math.max(0, ...inputs.map((i) => i.weakDependents));
  const raws = inputs.map((i) => {
    const W = i.severity === "insufficient" ? INSUFFICIENT_WEAKNESS : 1 - i.mastery / 100;
    const P = 1 + PREREQUISITE_BOOST * (maxDependents > 0 ? i.weakDependents / maxDependents : 0);
    const U = 0.7 + 0.3 * i.forgetting;
    const I = IMPROVEMENT_BY_SEVERITY[i.severity];
    const T = Math.max(i.estimatedMinutes, MIN_INTERVENTION_MINUTES) / 60;
    return { conceptId: i.conceptId, raw: (W * i.examWeight * P * U * I) / T };
  });
  const max = Math.max(0, ...raws.map((r) => r.raw));
  return raws
    .map((r) => {
      const score = max > 0 ? r.raw / max : 0;
      return { ...r, score, band: priorityFor(score) };
    })
    .sort((a, b) => b.raw - a.raw || a.conceptId.localeCompare(b.conceptId));
}

/** Stored knowledge-state numbers for one concept (ALG §4). */
export function conceptStateFrom(items: EvidenceItem[], answered: { correct: boolean }[]) {
  const { mastery, confidence, severity } = masteryFor(items);
  const total = answered.length;
  const recent = answered.slice(-5);
  return {
    masteryScore: mastery / 100,
    confidenceScore: CONFIDENCE_SCORE[confidence],
    confidence,
    severity,
    accuracy: total ? answered.filter((a) => a.correct).length / total : 0,
    recentAccuracy: recent.length ? recent.filter((a) => a.correct).length / recent.length : 0,
  };
}
