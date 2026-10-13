import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { addIstDays, endOfIstDay, endOfIstMonth, istDate, istMonth } from "@/lib/time";

/*
  Credit ledger — the grant half (BE-D33, BE-D35, BE-D36). Reservations, spending and expiry
  live in spend.ts.

  Rules that already hold:
    · every grant is one lot + one ledger row + the balance change, in the caller's transaction;
    · the account row is locked first, so concurrent grants and spends serialise;
    · a grant has a natural key (`welcome`, `monthly:2026-09`, …): the same key never grants twice.
*/

export type GrantType = "subscription_grant" | "promotion_grant" | "purchase" | "adjustment";

export interface GrantInput {
  learnerId: string;
  bucket: "daily_plan" | "free_monthly" | "promotional" | "purchased";
  type: GrantType;
  amount: number;
  /** Null = never expires. */
  expiresAt: Date | null;
  /** Idempotency key of this grant within the account. */
  grantKey: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
}

export interface GrantResult {
  granted: boolean;
  lotId: string | null;
  balance: number;
}

export async function grantLot(tx: Tx, input: GrantInput): Promise<GrantResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("Grant amount must be a positive whole number");

  // Lock the account so grants and spends on it serialise.
  const [account] = await tx
    .select({ id: s.creditAccounts.id, balance: s.creditAccounts.balance })
    .from(s.creditAccounts)
    .where(eq(s.creditAccounts.learnerId, input.learnerId))
    .for("update");
  if (!account) throw new Error(`No credit account for learner ${input.learnerId}`);

  const [lot] = await tx
    .insert(s.creditLots)
    .values({
      creditAccountId: account.id,
      bucket: input.bucket,
      amount: input.amount,
      remaining: input.amount,
      expiresAt: input.expiresAt,
      grantKey: input.grantKey,
      description: input.description,
    })
    .onConflictDoNothing({ target: [s.creditLots.creditAccountId, s.creditLots.grantKey] })
    .returning({ id: s.creditLots.id });
  if (!lot) return { granted: false, lotId: null, balance: account.balance };

  await tx.insert(s.creditTransactions).values({
    creditAccountId: account.id,
    lotId: lot.id,
    bucket: input.bucket,
    transactionType: input.type,
    amount: input.amount,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    description: input.description,
    expiresAt: input.expiresAt,
  });
  const [updated] = await tx
    .update(s.creditAccounts)
    .set({ balance: sql`${s.creditAccounts.balance} + ${input.amount}` })
    .where(eq(s.creditAccounts.id, account.id))
    .returning({ balance: s.creditAccounts.balance });
  return { granted: true, lotId: lot.id, balance: updated.balance };
}

export const WELCOME_GRANT_KEY = "welcome";
export const WELCOME_EXPIRY_DAYS = 30;

/**
 * The 100 welcome credits, granted once when a learner becomes eligible (verified email,
 * onboarding complete and, for minors, consent — BE-D36) and expiring 30 days later.
 */
export async function grantWelcomeCredits(tx: Tx, learnerId: string, now: Date): Promise<GrantResult> {
  const [free] = await tx.select({ credits: s.plans.welcomeCredits }).from(s.plans).where(eq(s.plans.code, "free"));
  const amount = free?.credits ?? 0;
  if (amount <= 0) {
    const [acct] = await tx.select({ balance: s.creditAccounts.balance }).from(s.creditAccounts).where(eq(s.creditAccounts.learnerId, learnerId));
    return { granted: false, lotId: null, balance: acct?.balance ?? 0 };
  }
  return grantLot(tx, {
    learnerId,
    bucket: "promotional",
    type: "promotion_grant",
    amount,
    expiresAt: endOfIstDay(addIstDays(now, WELCOME_EXPIRY_DAYS)),
    grantKey: WELCOME_GRANT_KEY,
    description: "Welcome credits",
  });
}

/* ---------- Free monthly credits (BE-D36, BE-D78) ---------- */

export const FREE_MONTHLY_AMOUNT = 30;

/**
 * The 30 free credits of the IST month containing `now`, expiring at 23:59:59 IST on its last
 * day. The grant key `monthly:YYYY-MM` makes the cron and the mid-month catch-up idempotent.
 */
export async function grantFreeMonthlyCredits(tx: Tx, learnerId: string, now: Date): Promise<GrantResult> {
  const [free] = await tx.select({ credits: s.plans.periodCredits }).from(s.plans).where(eq(s.plans.code, "free"));
  return grantLot(tx, {
    learnerId,
    bucket: "free_monthly",
    type: "subscription_grant",
    amount: free?.credits ?? FREE_MONTHLY_AMOUNT,
    expiresAt: endOfIstMonth(now),
    grantKey: `monthly:${istMonth(now)}`,
    description: "Free monthly credits",
  });
}

/**
 * Learners who get free monthly credits: onboarded, account active (a minor without consent is
 * `consent_pending`, a deleting account is `deletion_pending`) and without a running pass.
 */
export async function eligibleForFreeMonthly(tx: Tx, now: Date): Promise<string[]> {
  const rows = await tx
    .select({ id: s.learners.id })
    .from(s.learners)
    .innerJoin(s.users, eq(s.users.id, s.learners.userId))
    .where(
      and(
        eq(s.learners.onboardingCompleted, true),
        eq(s.users.status, "active"),
        sql`not exists (select 1 from public.subscriptions sub where sub.learner_id = ${s.learners.id} and sub.current_period_end > ${now.toISOString()}::timestamptz)`,
      ),
    );
  return rows.map((r) => r.id);
}

/* ---------- Daily plan credits (BE-D36; used from BE-10 when passes exist) ---------- */

/**
 * Daily plan credits for one learner on a running pass: the plan's allowance as one lot that
 * expires at 23:59:59 IST today (no rollover). Key `daily:YYYY-MM-DD` makes the 00:00 cron, a
 * retry and an immediate top-up on pass start/upgrade (BE-10) all safe to repeat.
 */
export async function grantDailyPlanCredits(tx: Tx, learnerId: string, now: Date): Promise<GrantResult> {
  const [sub] = await tx
    .select({ credits: s.plans.periodCredits })
    .from(s.subscriptions)
    .innerJoin(s.plans, eq(s.plans.id, s.subscriptions.planId))
    .where(and(eq(s.subscriptions.learnerId, learnerId), sql`${s.subscriptions.currentPeriodEnd} > ${now.toISOString()}::timestamptz`, eq(s.plans.creditPeriod, "daily")))
    .orderBy(sql`${s.plans.periodCredits} desc`)
    .limit(1);
  if (!sub) {
    const [acct] = await tx.select({ balance: s.creditAccounts.balance }).from(s.creditAccounts).where(eq(s.creditAccounts.learnerId, learnerId));
    return { granted: false, lotId: null, balance: acct?.balance ?? 0 };
  }
  return grantLot(tx, {
    learnerId,
    bucket: "daily_plan",
    type: "subscription_grant",
    amount: sub.credits,
    expiresAt: endOfIstDay(now),
    grantKey: `daily:${istDate(now)}`,
    description: "Daily plan credits",
  });
}

/** Learners with a running daily-credit pass. */
export async function learnersWithDailyPass(tx: Tx, now: Date): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: s.subscriptions.learnerId })
    .from(s.subscriptions)
    .innerJoin(s.plans, eq(s.plans.id, s.subscriptions.planId))
    .where(and(sql`${s.subscriptions.currentPeriodEnd} > ${now.toISOString()}::timestamptz`, eq(s.plans.creditPeriod, "daily")));
  return rows.map((r) => r.id);
}
