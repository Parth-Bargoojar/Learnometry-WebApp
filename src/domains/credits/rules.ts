import { COST } from "./costs";

export const practiceCost = (questions: number) => (questions / 5) * COST.practiceSet5;

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
