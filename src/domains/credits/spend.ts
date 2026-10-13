import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { addIstDays, endOfIstDay } from "@/lib/time";

/*
  Credit ledger — the spend half (BE-D33–D35). Every function runs inside the caller's
  transaction and locks the learner's `credit_accounts` row first, so concurrent spends,
  releases, grants and expiry on one account serialise and never overdraw.

  Invariants this file maintains (the nightly audit re-checks them):
    · credit_accounts.balance = Σ credit_lots.remaining over the account's lots;
    · credit_lots.remaining   = Σ credit_transactions.amount rows pointing at that lot;
    · a lot's remaining never leaves 0 … amount (CHECK).
*/

export const RESERVATION_TTL_MS = 15 * 60_000;
export const RETURNED_LOT_DAYS = 7;
export const IDEMPOTENCY_WINDOW_MS = 24 * 3_600_000;

type Bucket = (typeof s.CREDIT_BUCKETS)[number];
const BUCKET_RANK: Record<Bucket, number> = { daily_plan: 0, promotional: 1, free_monthly: 2, purchased: 3 };

export type ReservationStatus = "reserved" | "settled" | "released" | "expired";

export interface ReserveInput {
  learnerId: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  /** One UUID per user intent (BE-D35). */
  idempotencyKey: string;
  description: string;
  now: Date;
}

export interface ReserveResult {
  reservationId: string;
  status: ReservationStatus;
  amount: number;
  /** True when the key had been used before: nothing was charged by this call. */
  replay: boolean;
  balance: number;
}

async function lockAccount(tx: Tx, learnerId: string) {
  const [account] = await tx
    .select({ id: s.creditAccounts.id, balance: s.creditAccounts.balance })
    .from(s.creditAccounts)
    .where(eq(s.creditAccounts.learnerId, learnerId))
    .for("update");
  if (!account) throw new AppError("not_found", { message: "No credit account." });
  return account;
}

/**
 * Zero every lot whose time has passed and write one `expiration` row per lot. Caller holds
 * the account lock. Returns the credits removed. Credits held by an open reservation are not in
 * the lot any more (BE-D34), so they are unaffected.
 */
export async function expireLotsLocked(tx: Tx, accountId: string, now: Date): Promise<number> {
  const due = await tx
    .select({ id: s.creditLots.id, bucket: s.creditLots.bucket, remaining: s.creditLots.remaining, expiresAt: s.creditLots.expiresAt })
    .from(s.creditLots)
    .where(and(eq(s.creditLots.creditAccountId, accountId), gt(s.creditLots.remaining, 0), lte(s.creditLots.expiresAt, now)))
    .for("update");
  if (due.length === 0) return 0;

  let total = 0;
  for (const lot of due) {
    await tx.insert(s.creditTransactions).values({
      creditAccountId: accountId,
      lotId: lot.id,
      bucket: lot.bucket,
      transactionType: "expiration",
      amount: -lot.remaining,
      description: "Credits expired",
      expiresAt: lot.expiresAt,
    });
    await tx.update(s.creditLots).set({ remaining: 0 }).where(eq(s.creditLots.id, lot.id));
    total += lot.remaining;
  }
  await tx
    .update(s.creditAccounts)
    .set({ balance: sql`${s.creditAccounts.balance} - ${total}` })
    .where(eq(s.creditAccounts.id, accountId));
  return total;
}

/** Expire due lots of one learner (used by the nightly job per account, and by tests). */
export async function expireLearnerLots(tx: Tx, learnerId: string, now: Date): Promise<number> {
  const account = await lockAccount(tx, learnerId);
  return expireLotsLocked(tx, account.id, now);
}

/**
 * Reserve = debit now, soonest-expiry lot first, then bucket order (BE-D33/34). The same
 * idempotency key returns the first result and charges nothing (BE-D35).
 * Throws `insufficient_credits` when the unexpired lots cannot cover `amount`.
 */
export async function reserveCredits(tx: Tx, input: ReserveInput): Promise<ReserveResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new AppError("validation_failed", { message: "Amount must be a positive whole number." });
  const account = await lockAccount(tx, input.learnerId);

  const [existing] = await tx
    .select()
    .from(s.creditReservations)
    .where(and(eq(s.creditReservations.creditAccountId, account.id), eq(s.creditReservations.idempotencyKey, input.idempotencyKey)));
  if (existing) {
    if (existing.amount !== input.amount || existing.referenceType !== input.referenceType || existing.referenceId !== input.referenceId) {
      throw new AppError("conflict", { message: "That request key was already used for something else." });
    }
    return { reservationId: existing.id, status: existing.status, amount: existing.amount, replay: true, balance: account.balance };
  }

  await expireLotsLocked(tx, account.id, input.now);

  const lots = await tx
    .select({ id: s.creditLots.id, bucket: s.creditLots.bucket, remaining: s.creditLots.remaining, expiresAt: s.creditLots.expiresAt, createdAt: s.creditLots.createdAt })
    .from(s.creditLots)
    .where(and(eq(s.creditLots.creditAccountId, account.id), gt(s.creditLots.remaining, 0), or(isNull(s.creditLots.expiresAt), gt(s.creditLots.expiresAt, input.now))))
    .orderBy(sql`${s.creditLots.expiresAt} asc nulls last`, asc(s.creditLots.createdAt));
  lots.sort((a, b) => {
    const ea = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const eb = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return ea - eb || BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const available = lots.reduce((n, l) => n + l.remaining, 0);
  if (available < input.amount) {
    throw new AppError("insufficient_credits", { message: `This needs ${input.amount} credits. You have ${available}.` });
  }

  const [reservation] = await tx
    .insert(s.creditReservations)
    .values({
      creditAccountId: account.id,
      amount: input.amount,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      expiresAt: new Date(input.now.getTime() + RESERVATION_TTL_MS),
    })
    .returning({ id: s.creditReservations.id });

  let need = input.amount;
  for (const lot of lots) {
    if (need === 0) break;
    const take = Math.min(lot.remaining, need);
    need -= take;
    await tx.update(s.creditLots).set({ remaining: sql`${s.creditLots.remaining} - ${take}` }).where(eq(s.creditLots.id, lot.id));
    await tx.insert(s.creditTransactions).values({
      creditAccountId: account.id,
      lotId: lot.id,
      reservationId: reservation.id,
      bucket: lot.bucket,
      transactionType: "consumption",
      amount: -take,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      expiresAt: lot.expiresAt,
    });
  }
  const [updated] = await tx
    .update(s.creditAccounts)
    .set({ balance: sql`${s.creditAccounts.balance} - ${input.amount}` })
    .where(eq(s.creditAccounts.id, account.id))
    .returning({ balance: s.creditAccounts.balance });
  return { reservationId: reservation.id, status: "reserved", amount: input.amount, replay: false, balance: updated.balance };
}

async function lockReservation(tx: Tx, reservationId: string) {
  const [peek] = await tx.select({ accountId: s.creditReservations.creditAccountId }).from(s.creditReservations).where(eq(s.creditReservations.id, reservationId));
  if (!peek) throw new AppError("not_found", { message: "Reservation not found." });
  const [account] = await tx.select({ id: s.creditAccounts.id }).from(s.creditAccounts).where(eq(s.creditAccounts.id, peek.accountId)).for("update");
  const [reservation] = await tx.select().from(s.creditReservations).where(eq(s.creditReservations.id, reservationId)).for("update");
  return { account, reservation };
}

/** The work succeeded: keep the debit. Settling twice is a no-op; settling a released one is a conflict. */
export async function settleReservation(tx: Tx, reservationId: string, now: Date): Promise<ReservationStatus> {
  const { reservation } = await lockReservation(tx, reservationId);
  if (reservation.status === "settled") return "settled";
  if (reservation.status !== "reserved") throw new AppError("conflict", { message: "Those credits were already returned." });
  await tx.update(s.creditReservations).set({ status: "settled", settledAt: now }).where(eq(s.creditReservations.id, reservationId));
  return "settled";
}

/**
 * The work failed or timed out: give the credits back to the same lots (BE-D34). A lot that
 * expired in the meantime cannot take them, so that part becomes one `promotional` lot
 * ("Returned credits") valid for 7 days. Releasing twice is a no-op.
 */
export async function releaseReservation(tx: Tx, reservationId: string, now: Date, finalStatus: "released" | "expired" = "released"): Promise<ReservationStatus> {
  const { account, reservation } = await lockReservation(tx, reservationId);
  if (reservation.status === "released" || reservation.status === "expired") return reservation.status;
  if (reservation.status === "settled") throw new AppError("conflict", { message: "Those credits were already used." });

  const consumed = await tx
    .select({ lotId: s.creditTransactions.lotId, bucket: s.creditTransactions.bucket, amount: s.creditTransactions.amount })
    .from(s.creditTransactions)
    .where(and(eq(s.creditTransactions.reservationId, reservationId), eq(s.creditTransactions.transactionType, "consumption")));

  const lotIds = consumed.map((c) => c.lotId).filter((id): id is string => id !== null);
  const lots = lotIds.length ? await tx.select().from(s.creditLots).where(inArray(s.creditLots.id, lotIds)).for("update") : [];
  const lotById = new Map(lots.map((l) => [l.id, l]));

  let restored = 0;
  let returned = 0;
  for (const c of consumed) {
    const back = -c.amount;
    const lot = c.lotId ? lotById.get(c.lotId) : undefined;
    const usable = lot && (lot.expiresAt === null || new Date(lot.expiresAt) > now);
    if (!lot || !usable) {
      returned += back;
      continue;
    }
    await tx.update(s.creditLots).set({ remaining: sql`${s.creditLots.remaining} + ${back}` }).where(eq(s.creditLots.id, lot.id));
    await tx.insert(s.creditTransactions).values({
      creditAccountId: account.id,
      lotId: lot.id,
      reservationId,
      bucket: lot.bucket,
      transactionType: "refund",
      amount: back,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      description: "Credits returned",
      expiresAt: lot.expiresAt,
    });
    restored += back;
  }

  if (returned > 0) {
    const expiresAt = endOfIstDay(addIstDays(now, RETURNED_LOT_DAYS));
    const [lot] = await tx
      .insert(s.creditLots)
      .values({ creditAccountId: account.id, bucket: "promotional", amount: returned, remaining: returned, expiresAt, grantKey: `returned:${reservationId}`, description: "Returned credits" })
      .returning({ id: s.creditLots.id });
    await tx.insert(s.creditTransactions).values({
      creditAccountId: account.id,
      lotId: lot.id,
      reservationId,
      bucket: "promotional",
      transactionType: "refund",
      amount: returned,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      description: "Returned credits",
      expiresAt,
    });
  }

  const total = restored + returned;
  await tx
    .update(s.creditAccounts)
    .set({ balance: sql`${s.creditAccounts.balance} + ${total}` })
    .where(eq(s.creditAccounts.id, account.id));
  await tx.update(s.creditReservations).set({ status: finalStatus, releasedAt: now }).where(eq(s.creditReservations.id, reservationId));
  return finalStatus;
}

/* ---------- Jobs' queries (BE-4.2) ---------- */

/** Ids of reservations stuck in `reserved` past their 15-minute window. */
export async function staleReservationIds(tx: Tx, now: Date, limit = 500): Promise<string[]> {
  const rows = await tx
    .select({ id: s.creditReservations.id })
    .from(s.creditReservations)
    .where(and(eq(s.creditReservations.status, "reserved"), lte(s.creditReservations.expiresAt, now)))
    .orderBy(asc(s.creditReservations.expiresAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

/** Learner ids that own at least one lot that has expired with credits left. */
export async function learnersWithExpiredLots(tx: Tx, now: Date): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ learnerId: s.creditAccounts.learnerId })
    .from(s.creditLots)
    .innerJoin(s.creditAccounts, eq(s.creditAccounts.id, s.creditLots.creditAccountId))
    .where(and(gt(s.creditLots.remaining, 0), lte(s.creditLots.expiresAt, now)));
  return rows.map((r) => r.learnerId);
}

export interface LedgerDrift {
  kind: "account" | "lot";
  id: string;
  expected: number;
  actual: number;
}

/** Re-derive both invariants from the rows. An empty list means the ledger is consistent. */
export async function findLedgerDrift(tx: Tx): Promise<LedgerDrift[]> {
  const accounts = (await tx.execute(sql`
    select a.id, a.balance::int as actual, coalesce(l.total, 0)::int as expected
    from public.credit_accounts a
    left join (select credit_account_id, sum(remaining) as total from public.credit_lots group by 1) l on l.credit_account_id = a.id
    where a.balance <> coalesce(l.total, 0)
  `)) as unknown as { id: string; actual: number; expected: number }[];
  const lots = (await tx.execute(sql`
    select l.id, l.remaining::int as actual, coalesce(t.total, 0)::int as expected
    from public.credit_lots l
    left join (select lot_id, sum(amount) as total from public.credit_transactions where lot_id is not null group by 1) t on t.lot_id = l.id
    where l.remaining <> coalesce(t.total, 0)
  `)) as unknown as { id: string; actual: number; expected: number }[];
  return [
    ...accounts.map((r) => ({ kind: "account" as const, id: r.id, expected: r.expected, actual: r.actual })),
    ...lots.map((r) => ({ kind: "lot" as const, id: r.id, expected: r.expected, actual: r.actual })),
  ];
}
