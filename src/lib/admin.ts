/**
 * Admin console rules — Web App Structure §8.19 and build decisions K1–K16 (§8.19a).
 * Pure and server-safe: the console previews what the server enforces, and every
 * value here becomes a read from `feature_flags` / config when the backend lands.
 */
import { REFUND_MAX_USAGE, refundWindow } from "./billing";
import { dayMonth } from "./format";

export const ADMIN = {
  /** K2: a reason is required on every mutation and stored in the audit log. */
  reasonMin: 10,
  /** K4: bounds on one manual credit adjustment. Grants expire like promotional credits. */
  adjustMax: 500,
  adjustGrantExpiryDays: 30,
  /** §1.9: admin sessions are 12 h (K1 adds 2FA at every sign-in). */
  sessionHours: 12,
  /** K14: dense tables. */
  pageSize: 25,
  /** K5: refund decisions within 48 h (the site promises billing replies in 48 h). */
  refundDecisionHours: 48,
  /** K12: automatic webhook retries before an event shows as failed. */
  webhookRetries: 5,
  webhookBackoff: ["1 min", "5 min", "30 min", "2 h", "12 h"],
  /** K11: flag changes reach every server within this many seconds (config cache TTL). */
  flagPropagationSeconds: 60,
} as const;

/* ---------- K2: reasons ---------- */

export const reasonError = (reason: string) =>
  reason.trim().length < ADMIN.reasonMin ? `Write at least ${ADMIN.reasonMin} characters so the audit log explains this change.` : null;

/* ---------- K8: AI spend circuit breaker (CONTEXT §9, TRD §7.7) ---------- */

export type BreakerState = "normal" | "warning" | "restricted";
export type BreakerOverride = "force_normal" | "force_restricted" | null;

export interface BudgetConfig {
  warningRatio: number;
  restrictedRatio: number;
  hardCapInr: number;
}

export const DEFAULT_BUDGET: BudgetConfig = { warningRatio: 0.2, restrictedRatio: 0.3, hardCapInr: 5000 };

/**
 * Ratio = today's AI cost ÷ trailing 7-day average daily net revenue.
 * An operator override lasts until the 00:00 IST reset.
 */
export function breakerState(costTodayInr: number, revenueAvgInr: number, cfg: BudgetConfig = DEFAULT_BUDGET, override: BreakerOverride = null) {
  const ratio = revenueAvgInr > 0 ? costTodayInr / revenueAvgInr : 1;
  let computed: BreakerState = "normal";
  if (ratio >= cfg.restrictedRatio || costTodayInr >= cfg.hardCapInr) computed = "restricted";
  else if (ratio >= cfg.warningRatio) computed = "warning";
  const state: BreakerState = override === "force_normal" ? "normal" : override === "force_restricted" ? "restricted" : computed;
  return { ratio, computed, state, overridden: override !== null && state !== computed, warningAtInr: revenueAvgInr * cfg.warningRatio };
}

export const BREAKER_COPY: Record<BreakerState, { label: string; effect: string }> = {
  normal: { label: "Normal", effect: "Every operation runs on its planned tier." },
  warning: { label: "Warning", effect: "Alert sent. Eligible operations route to the Fast tier." },
  restricted: {
    label: "Restricted",
    effect: "Deep diagnostics and question-generation fallback are paused. Tests, scoring and plans still work, and learners see the “slower than usual” banner.",
  },
};

/* ---------- K7: prerequisite cycle check (TRD §5.2) ---------- */

/** `from` is a prerequisite of `to`. */
export interface Edge {
  from: string;
  to: string;
}

/**
 * Adding `from → to` closes a cycle when `to` already reaches `from`.
 * Returns that existing path (to … from) so the editor can show it, or null.
 */
export function cyclePath(edges: Edge[], from: string, to: string): string[] | null {
  if (from === to) return [from];
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const prev = new Map<string, string>();
  const queue = [to];
  const seen = new Set([to]);
  while (queue.length) {
    const node = queue.shift()!;
    if (node === from) {
      const path = [from];
      let cur = from;
      while (cur !== to) {
        cur = prev.get(cur)!;
        path.unshift(cur);
      }
      return path;
    }
    for (const n of next.get(node) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        prev.set(n, node);
        queue.push(n);
      }
    }
  }
  return null;
}

/* ---------- K6: question lifecycle ---------- */

export type QuestionStatus = "draft" | "validated" | "reviewed" | "published" | "suspended";
export type ValidatorType = "schema" | "math" | "semantic" | "difficulty" | "duplicate" | "exam_style" | "safety" | "human";
export type ValidationResult = "pass" | "warning" | "fail" | "pending";

export const AUTOMATED_VALIDATORS: ValidatorType[] = ["schema", "math", "semantic", "difficulty", "duplicate", "exam_style", "safety"];

export const VALIDATOR_LABEL: Record<ValidatorType, string> = {
  schema: "Schema",
  math: "Math check",
  semantic: "Answer matches solution",
  difficulty: "Difficulty estimate",
  duplicate: "Duplicate check",
  exam_style: "Exam style",
  safety: "Safety",
  human: "Human review",
};

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  reviewed: "Reviewed",
  published: "Published",
  suspended: "Suspended",
};

/** Why a question can't be published yet; empty = publishable. */
export function publishBlockers(status: QuestionStatus, results: Partial<Record<ValidatorType, ValidationResult>>): string[] {
  if (status === "published") return ["Already published."];
  const out: string[] = [];
  const failed = AUTOMATED_VALIDATORS.filter((v) => results[v] === "fail");
  const pending = AUTOMATED_VALIDATORS.filter((v) => !results[v] || results[v] === "pending");
  if (failed.length) out.push(`Failed: ${failed.map((v) => VALIDATOR_LABEL[v]).join(", ")}.`);
  if (pending.length) out.push(`Still running: ${pending.map((v) => VALIDATOR_LABEL[v]).join(", ")}.`);
  if (results.human !== "pass") out.push("Needs a human review.");
  return out;
}

export const canSuspend = (status: QuestionStatus) => status === "published";

/* ---------- K5: refunds ---------- */

export function refundCheck(firstPayment: string, usedShare: number, today?: string) {
  const w = refundWindow(firstPayment, usedShare, today);
  const notes: string[] = [];
  notes.push(w.inTime ? `Requested within 7 days (window ends ${dayMonth(w.until)})` : `Outside the 7-day window (ended ${dayMonth(w.until)})`);
  notes.push(w.underUsage ? `Used ${Math.round(usedShare * 100)}% of the allowance (under ${REFUND_MAX_USAGE * 100}%)` : `Used ${Math.round(usedShare * 100)}% of the allowance (limit ${REFUND_MAX_USAGE * 100}%)`);
  return { ...w, notes };
}

/* ---------- K4: credit adjustments ---------- */

export function adjustmentError(amount: number, balance: number) {
  if (!Number.isInteger(amount) || amount === 0) return "Enter a whole number of credits, other than 0.";
  if (Math.abs(amount) > ADMIN.adjustMax) return `One adjustment can move at most ${ADMIN.adjustMax} credits.`;
  if (balance + amount < 0) return `The balance is ${balance}. A deduction can't take it below 0.`;
  return null;
}

/* ---------- Formatting ---------- */

/** "27 Sep, 14:05" from an ISO timestamp with offset. Hand-formatted (see format.ts). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function stamp(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3_600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** IST calendar day ("2026-09-27") of an ISO timestamp. */
export const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export const inrPrecise = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
