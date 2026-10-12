import "server-only";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { PLANS, type PlanCode } from "./costs";
import { creditStateFor } from "./rules";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { dayMonth } from "@/lib/iso-date";
import { istDate } from "@/lib/time";
import type { CreditBucketView } from "@/lib/viewer";

const LABEL: Record<CreditBucketView["key"], string> = {
  daily_plan: "Plan credits",
  free_monthly: "Free monthly",
  promotional: "Promotional",
  purchased: "Purchased",
};

const ORDER: CreditBucketView["key"][] = ["daily_plan", "free_monthly", "promotional", "purchased"];

export interface BalanceSummary {
  balance: number;
  buckets: CreditBucketView[];
}

/**
 * Balance and per-bucket breakdown from the unexpired lots (BE-D33). Reads through the
 * caller's handle, so `asUser` applies RLS and a learner sees only their own.
 */
export async function getBalanceSummary(tx: Tx, learnerId: string, plan: PlanCode, now: Date): Promise<BalanceSummary> {
  const [account] = await tx.select({ id: s.creditAccounts.id, balance: s.creditAccounts.balance }).from(s.creditAccounts).where(eq(s.creditAccounts.learnerId, learnerId));
  if (!account) return { balance: 0, buckets: [] };

  const rows = await tx
    .select({
      bucket: s.creditLots.bucket,
      amount: sql<number>`coalesce(sum(${s.creditLots.remaining}), 0)::int`,
      soonest: sql<Date | null>`min(${s.creditLots.expiresAt})`,
    })
    .from(s.creditLots)
    .where(and(eq(s.creditLots.creditAccountId, account.id), gt(s.creditLots.remaining, 0), or(isNull(s.creditLots.expiresAt), gt(s.creditLots.expiresAt, now))))
    .groupBy(s.creditLots.bucket);

  const byBucket = new Map(rows.map((r) => [r.bucket as CreditBucketView["key"], r]));
  const period = PLANS[plan].periodCredits;
  const buckets = ORDER.filter((k) => byBucket.has(k)).map((key) => {
    const r = byBucket.get(key)!;
    const soonest = r.soonest ? dayMonth(istDate(new Date(r.soonest))) : null;
    const note =
      key === "daily_plan"
        ? `Refills to ${period} at 00:00 IST`
        : key === "free_monthly"
          ? "30 credits every month"
          : key === "purchased"
            ? "Packs last 90 days"
            : soonest
              ? `Expire ${soonest}`
              : "No expiry";
    return { key, label: LABEL[key], amount: r.amount, note };
  });
  return { balance: account.balance, buckets };
}

export { creditStateFor };
