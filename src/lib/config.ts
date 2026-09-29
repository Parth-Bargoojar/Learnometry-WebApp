/**
 * Product configuration — the launch values from Learnometry_WEB_APP_STRUCTURE_v1.md §1.9
 * and CONTEXT.md §0.1. Everything here is configuration, not law: when the server
 * config lands (TRD §23.4) these become reads from the `plans` table / feature config,
 * and nothing in the UI should need to change.
 */

export type PlanCode = "free" | "starter" | "plus" | "pro";

export interface Plan {
  code: PlanCode;
  name: string;
  priceInr: number;
  period: "monthly" | "daily";
  periodCredits: number;
  engine: "fast_only" | "learner_choice" | "auto" | "auto_extended";
  recommended?: boolean;
  summary: string;
  features: string[];
}

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: "free",
    name: "Free",
    priceInr: 0,
    period: "monthly",
    periodCredits: 30,
    engine: "fast_only",
    summary: "Your first diagnostic and study plan, then light practice.",
    features: ["100 welcome credits once", "30 credits every month", "Root-cause report on every diagnostic"],
  },
  starter: {
    code: "starter",
    name: "Starter",
    priceInr: 199,
    period: "daily",
    periodCredits: 200,
    engine: "learner_choice",
    summary: "Daily practice with the explanation engine you choose.",
    features: ["200 credits a day, refilled at 00:00 IST", "Choose Fast or Standard explanations", "Plan updates after each retest"],
  },
  plus: {
    code: "plus",
    name: "Plus",
    priceInr: 299,
    period: "daily",
    periodCredits: 350,
    engine: "auto",
    recommended: true,
    summary: "More credits, engine chosen for every question.",
    features: ["350 credits a day, refilled at 00:00 IST", "Deep reasoning on hard problems", "Plan adapts after every practice session", "Priority queue"],
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceInr: 349,
    period: "daily",
    periodCredits: 500,
    engine: "auto_extended",
    summary: "For the final-months sprint.",
    features: ["500 credits a day, refilled at 00:00 IST", "Extra reasoning depth", "Plan re-optimized every morning", "60-minute Deep diagnostic"],
  },
};

/** Credit costs, CONTEXT.md §0.1 (D1). */
export const COST = {
  fullDiagnostic: 70,
  chapterDiagnostic: 35,
  deepDiagnostic: 120,
  studyPlan: 30,
  practiceSet5: 20,
  retest: 50,
  hint: 5,
  explanation: 10,
  breakdown: 10,
} as const;

export const CREDIT_PACKS = [
  { id: "pack_100", credits: 100, priceInr: 49 },
  { id: "pack_250", credits: 250, priceInr: 99 },
  { id: "pack_600", credits: 600, priceInr: 199, bestValue: true },
] as const;

export const practiceCost = (questions: number) => (questions / 5) * COST.practiceSet5;

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

/* ---------- Credit chip thresholds (§1.9) ---------- */

export type CreditState = "normal" | "low" | "critical" | "exhausted";

export function creditStateFor(balance: number, periodCredits: number): CreditState {
  if (balance <= 0) return "exhausted";
  if (balance < COST.practiceSet5) return "critical";
  if (balance <= periodCredits * 0.2) return "low";
  return "normal";
}

/** Turns a balance into decisions (DS §14): what can I still do today? */
export function enoughFor(balance: number): string {
  if (balance >= COST.retest + COST.practiceSet5) {
    const sets = Math.floor((balance - COST.retest) / COST.practiceSet5);
    return `Enough for 1 retest and ${sets} practice ${sets === 1 ? "set" : "sets"}.`;
  }
  if (balance >= COST.practiceSet5) {
    const sets = Math.floor(balance / COST.practiceSet5);
    return `Enough for ${sets} practice ${sets === 1 ? "set" : "sets"}.`;
  }
  if (balance >= COST.hint) return "Enough for hints and explanations only.";
  return "Your plan and revision tasks don't need credits.";
}

export const DAILY_MINUTE_PRESETS = [30, 45, 60, 90, 120] as const;
