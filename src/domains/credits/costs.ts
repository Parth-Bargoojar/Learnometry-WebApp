/**
 * Plans, credit prices and packs — the launch values from Web App Structure §1.9 and
 * CONTEXT §0.1. Configuration, not law: the `plans` table is seeded from these (BE-1.5)
 * and read from the database once BE-4 lands. Pure data, safe to import anywhere.
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

export const DAILY_MINUTE_PRESETS = [30, 45, 60, 90, 120] as const;
