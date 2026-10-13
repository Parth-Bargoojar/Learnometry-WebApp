import "server-only";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { PLANS, type PlanCode } from "./costs";
import { creditStateFor } from "./rules";
import { asUser } from "@/lib/db/client";
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
  // Lots that expired a moment ago are zeroed by the nightly job; the learner never sees them (BE-D33).
  const balance = rows.reduce((n, r) => n + r.amount, 0);
  return { balance, buckets };
}

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface TransactionPage {
  rows: TransactionRow[];
  /** Pass back as `cursor` for the next page; null on the last page. */
  next: string | null;
}

export const HISTORY_PAGE_SIZE = 25;

const LABEL_BY_TYPE: Record<string, string> = {
  subscription_grant: "Plan credits",
  promotion_grant: "Promotional credits",
  purchase: "Credits purchased",
  consumption: "Credits used",
  refund: "Credits returned",
  expiration: "Credits expired",
  adjustment: "Adjustment",
  reversal: "Reversal",
};

function parseCursor(cursor?: string): { at: string; id: string } | null {
  // Microsecond text from Postgres: a JS Date would truncate it and skip rows sharing a millisecond.
  const m = /^(\d{4}-\d{2}-\d{2} [\d:.]+[+-]\d{2}(?::\d{2})?)\|([0-9a-f-]{36})$/i.exec(cursor ?? "");
  return m ? { at: m[1], id: m[2] } : null;
}

/**
 * History for the Credits screen, newest first, 25 per page (API `listCreditTransactions`).
 * The ledger is the truth: a refund and the consumption it reverses are separate rows.
 * Reads through the caller's handle, so RLS limits it to their own.
 */
export async function listCreditTransactions(tx: Tx, learnerId: string, cursor?: string): Promise<TransactionPage> {
  const [account] = await tx.select({ id: s.creditAccounts.id }).from(s.creditAccounts).where(eq(s.creditAccounts.learnerId, learnerId));
  if (!account) return { rows: [], next: null };
  const after = parseCursor(cursor);
  const rows = await tx
    .select({ id: s.creditTransactions.id, at: s.creditTransactions.createdAt, atText: sql<string>`${s.creditTransactions.createdAt}::text`, description: s.creditTransactions.description, amount: s.creditTransactions.amount, type: s.creditTransactions.transactionType })
    .from(s.creditTransactions)
    .where(and(eq(s.creditTransactions.creditAccountId, account.id), after ? sql`(${s.creditTransactions.createdAt}, ${s.creditTransactions.id}) < (${after.at}::timestamptz, ${after.id}::uuid)` : undefined))
    .orderBy(desc(s.creditTransactions.createdAt), desc(s.creditTransactions.id))
    .limit(HISTORY_PAGE_SIZE + 1);
  const page = rows.slice(0, HISTORY_PAGE_SIZE);
  return {
    rows: page.map((r) => ({ id: r.id, date: istDate(new Date(r.at)), description: r.description ?? LABEL_BY_TYPE[r.type], amount: r.amount })),
    next: rows.length > HISTORY_PAGE_SIZE ? `${page[page.length - 1].atText}|${page[page.length - 1].id}` : null,
  };
}

export { creditStateFor };

/** The signed-in learner's history page, read through RLS. */
export const loadCreditHistory = (userId: string, learnerId: string, cursor?: string) => asUser({ sub: userId }, (tx) => listCreditTransactions(tx, learnerId, cursor));

/** The welcome grant this learner received (0 before eligibility), for the "all set" screen. */
export async function loadWelcomeCredits(userId: string, learnerId: string): Promise<number> {
  return asUser({ sub: userId }, async (tx) => {
    const [row] = await tx
      .select({ amount: s.creditLots.amount })
      .from(s.creditLots)
      .innerJoin(s.creditAccounts, eq(s.creditAccounts.id, s.creditLots.creditAccountId))
      .where(and(eq(s.creditAccounts.learnerId, learnerId), eq(s.creditLots.grantKey, "welcome")));
    return row?.amount ?? 0;
  });
}
