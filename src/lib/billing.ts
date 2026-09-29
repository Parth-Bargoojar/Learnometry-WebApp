/**
 * Billing rules — decision D6 (Web App Structure §1, §8.15). Pure functions: the
 * server is the authority for every amount, and the UI only previews what the
 * server will charge so the learner can check it by hand.
 */
import { CREDIT_PACKS, PLANS, type PlanCode } from "./config";
import { TODAY } from "./data";
import { daysBetween } from "./format";
import { addDays } from "./guardian";

export const PASS_DAYS = 30;
export const REFUND_WINDOW_DAYS = 7;
export const REFUND_MAX_USAGE = 0.2;
export const ENDS_SOON_DAYS = 3;
/** Confirmation polling: after this long the page says it's fine to leave (§8.15). */
export const CONFIRM_SLOW_AFTER_MS = 120_000;

/**
 * `LEGAL_ENTITY.gstin` (D6): payment receipts until a GSTIN exists, GST tax invoices after.
 * Stays null until the founders register (launch gate G2 covers the legal details).
 */
export const GSTIN: string | null = null;

export type PassStatus = "active" | "ends_soon" | "renewal_failed" | "ended";

export function passStatus(passEnds: string, opts: { renewalFailed?: boolean; today?: string } = {}): PassStatus {
  const left = daysBetween(opts.today ?? TODAY, passEnds);
  if (left < 0) return "ended";
  if (opts.renewalFailed) return "renewal_failed";
  if (left <= ENDS_SOON_DAYS) return "ends_soon";
  return "active";
}

export const PASS_STATUS_LABEL: Record<PassStatus, string> = {
  active: "Active",
  ends_soon: "Ends soon",
  renewal_failed: "Renewal failed",
  ended: "Ended",
};

/** Upgrade charge = new price − unused value of the current pass, rounded down to the rupee. */
export function prorate(current: PlanCode, target: PlanCode, passEnds: string, today = TODAY) {
  const remaining = Math.max(0, Math.min(PASS_DAYS, daysBetween(today, passEnds)));
  const credit = Math.floor((PLANS[current].priceInr * remaining) / PASS_DAYS);
  return { credit, due: Math.max(0, PLANS[target].priceInr - credit), remaining };
}

export function refundWindow(firstPayment: string, usedShare: number, today = TODAY) {
  const until = addDays(firstPayment, REFUND_WINDOW_DAYS);
  const inTime = daysBetween(today, until) >= 0;
  const underUsage = usedShare < REFUND_MAX_USAGE;
  return { until, eligible: inTime && underUsage, inTime, underUsage };
}

/** Renewal reminders go out 3 days and 1 day before the pass ends (D6). */
export const renewalReminderOn = (passEnds: string) => addDays(passEnds, -ENDS_SOON_DAYS);

/* ---------- What is being bought ---------- */

export interface CheckoutItem {
  kind: "plan_pass" | "credit_pack";
  code: string;
  title: string;
  /** Full price before proration or coupons. */
  priceInr: number;
  /** Unused value of the current pass, taken off an upgrade. */
  prorationInr?: number;
  /** One line under the total explaining what starts when. */
  note: string;
}

export function passItem(target: PlanCode, current: PlanCode, passEnds: string): CheckoutItem {
  const plan = PLANS[target];
  const upgrade = current !== "free" && plan.priceInr > PLANS[current].priceInr;
  const { credit } = upgrade ? prorate(current, target, passEnds) : { credit: 0 };
  return {
    kind: "plan_pass",
    code: target,
    title: `${plan.name} · 30-day pass`,
    priceInr: plan.priceInr,
    prorationInr: credit || undefined,
    note: upgrade
      ? `New 30-day pass starts now. Today's balance tops up to ${plan.periodCredits}.`
      : `${plan.periodCredits} credits a day for 30 days, refilled at 00:00 IST.`,
  };
}

export function packItem(packId: string): CheckoutItem {
  const p = CREDIT_PACKS.find((x) => x.id === packId)!;
  return {
    kind: "credit_pack",
    code: p.id,
    title: `${p.credits} credits`,
    priceInr: p.priceInr,
    note: "Valid 90 days. Used after your daily and promotional credits.",
  };
}

/* ---------- Coupons (server-validated; this mirrors the rules for the preview) ---------- */

export interface CouponResult {
  ok: boolean;
  code: string;
  message: string;
  discountInr?: number;
  bonusCredits?: number;
}

/** `endsOn` = launch date + 30 days (§1.9); the sample value stands in until the launch date is set. */
const CAMPAIGNS: Record<string, { percentOff: number; bonusCredits: number; firstPassOnly: boolean; endsOn: string }> = {
  EARLYACCESS: { percentOff: 20, bonusCredits: 100, firstPassOnly: true, endsOn: "2026-11-15" },
};

export function applyCoupon(
  raw: string,
  item: CheckoutItem,
  ctx: { redeemed: string[]; hadPaidPass: boolean; today?: string },
): CouponResult {
  const code = raw.trim().toUpperCase();
  const c = CAMPAIGNS[code];
  if (!code) return { ok: false, code, message: "Enter a code." };
  if (!c) return { ok: false, code, message: "That code isn't valid. Check the spelling and try again." };
  if (item.kind !== "plan_pass") return { ok: false, code, message: `${code} works on passes, not credit packs.` };
  if (daysBetween(ctx.today ?? TODAY, c.endsOn) < 0) return { ok: false, code, message: `${code} has ended.` };
  if (ctx.redeemed.includes(code)) return { ok: false, code, message: `${code} has already been used on this account. It works once per student.` };
  if (c.firstPassOnly && ctx.hadPaidPass) return { ok: false, code, message: `${code} is for a first pass only.` };
  const base = item.priceInr - (item.prorationInr ?? 0);
  const discountInr = Math.floor((base * c.percentOff) / 100);
  return {
    ok: true,
    code,
    discountInr,
    bonusCredits: c.bonusCredits,
    message: `${code} applied: ₹${discountInr} off + ${c.bonusCredits} bonus credits.`,
  };
}

export function totalDue(item: CheckoutItem, coupon?: CouponResult | null) {
  return Math.max(0, item.priceInr - (item.prorationInr ?? 0) - (coupon?.ok ? coupon.discountInr ?? 0 : 0));
}
