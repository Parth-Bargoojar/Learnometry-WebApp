/**
 * Billing rules — decision D6 (Web App Structure §1, §8.15). The pure rules live in
 * `src/domains/billing/rules.ts` (BE-0.4); this module binds them to the sample "today"
 * and the sample coupon book so the UI keeps its call shape until BE-10.
 */
import type { PlanCode } from "@/domains/credits/costs";
import * as rules from "@/domains/billing/rules";
import { TODAY } from "./data";

export {
  CONFIRM_SLOW_AFTER_MS,
  ENDS_SOON_DAYS,
  GSTIN,
  PASS_DAYS,
  PASS_STATUS_LABEL,
  REFUND_MAX_USAGE,
  REFUND_WINDOW_DAYS,
  packItem,
  renewalReminderOn,
  totalDue,
} from "@/domains/billing/rules";
export type { CheckoutItem, CouponResult, PassStatus } from "@/domains/billing/rules";

/** `endsOn` = launch date + 30 days (§1.9); the sample value stands in until the launch date is set. */
const SAMPLE_CAMPAIGNS: rules.CampaignBook = {
  EARLYACCESS: { percentOff: 20, bonusCredits: 100, firstPassOnly: true, endsOn: "2026-11-15" },
};

export const passStatus = (passEnds: string, opts: { renewalFailed?: boolean; today?: string } = {}) =>
  rules.passStatus(passEnds, { renewalFailed: opts.renewalFailed, today: opts.today ?? TODAY });

export const prorate = (current: PlanCode, target: PlanCode, passEnds: string, today = TODAY) =>
  rules.prorate(current, target, passEnds, today);

export const refundWindow = (firstPayment: string, usedShare: number, today = TODAY) =>
  rules.refundWindow(firstPayment, usedShare, today);

export const passItem = (target: PlanCode, current: PlanCode, passEnds: string) =>
  rules.passItem(target, current, passEnds, TODAY);

export const applyCoupon = (
  raw: string,
  item: rules.CheckoutItem,
  ctx: { redeemed: string[]; hadPaidPass: boolean; today?: string },
) => rules.applyCoupon(raw, item, { ...ctx, today: ctx.today ?? TODAY, campaigns: SAMPLE_CAMPAIGNS });
