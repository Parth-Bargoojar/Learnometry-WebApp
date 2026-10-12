import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { endOfIstDay, addIstDays } from "@/lib/time";

/*
  Credit ledger — the grant half (BE-D33, BE-D35, BE-D36). Reservations, spending and expiry
  arrive in BE-4; the welcome grant is needed at the end of onboarding, so grants exist now.

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
