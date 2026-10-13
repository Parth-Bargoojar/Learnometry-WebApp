import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eligibleForFreeMonthly, grantDailyPlanCredits, grantFreeMonthlyCredits, grantLot } from "@/domains/credits/service";
import { getBalanceSummary, listCreditTransactions } from "@/domains/credits/queries";
import { expireLearnerLots, releaseReservation, reserveCredits, settleReservation, staleReservationIds } from "@/domains/credits/spend";
import { AppError } from "@/lib/errors/app-error";
import { endOfIstDay, endOfIstMonth } from "@/lib/time";
import { asUser, cleanupUsers, createUser, db, pg, type TestUser } from "./helpers";

/*
  Credits core (BE-4.4, BE-D33–D36): lots, soonest-expiry spending, reservations, idempotency,
  release to expired lots, expiry at 23:59:59 IST, and the ledger invariants under 20 parallel
  spends. Everything runs through the real service on the local database.
*/

afterAll(async () => {
  await cleanupUsers();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function learner(): Promise<TestUser & { learnerId: string }> {
  const u = await createUser();
  return { ...u, learnerId: u.learnerId! };
}

const grant = (learnerId: string, over: Partial<Parameters<typeof grantLot>[1]> = {}) =>
  db.transaction((tx) =>
    grantLot(tx, {
      learnerId,
      bucket: "promotional",
      type: "promotion_grant",
      amount: 100,
      expiresAt: new Date(Date.now() + 30 * DAY),
      grantKey: `k-${randomUUID()}`,
      description: "Test grant",
      ...over,
    }),
  );

const reserve = (learnerId: string, amount: number, key = randomUUID(), now = new Date(), refId = randomUUID()) =>
  db.transaction((tx) => reserveCredits(tx, { learnerId, amount, referenceType: "test", referenceId: refId, idempotencyKey: key, description: "Test spend", now }));

const balanceOf = async (learnerId: string) => (await pg<{ balance: number }[]>`select balance from public.credit_accounts where learner_id = ${learnerId}`)[0].balance;

async function expectInvariants(learnerId: string) {
  const mine = await pg<{ n: number }[]>`
    select count(*)::int as n from public.credit_accounts a
    where a.learner_id = ${learnerId}
      and a.balance <> (select coalesce(sum(remaining), 0) from public.credit_lots where credit_account_id = a.id)`;
  expect(mine[0].n).toBe(0);
  const lots = await pg<{ n: number }[]>`
    select count(*)::int as n from public.credit_lots l join public.credit_accounts a on a.id = l.credit_account_id
    where a.learner_id = ${learnerId}
      and l.remaining <> (select coalesce(sum(amount), 0) from public.credit_transactions where lot_id = l.id)`;
  expect(lots[0].n).toBe(0);
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof AppError ? e.code : "other";
  }
}

describe("grants", () => {
  it("one lot, one ledger row, balance up; the same key never grants twice", async () => {
    const u = await learner();
    const first = await grant(u.learnerId, { grantKey: "welcome", amount: 100 });
    const second = await grant(u.learnerId, { grantKey: "welcome", amount: 100 });
    expect(first).toMatchObject({ granted: true, balance: 100 });
    expect(second).toMatchObject({ granted: false, balance: 100 });
    expect(await balanceOf(u.learnerId)).toBe(100);
    await expectInvariants(u.learnerId);
  });

  it("free monthly credits are idempotent per month and expire at 23:59:59 IST on the last day", async () => {
    const u = await learner();
    const at = new Date("2026-10-15T08:00:00Z");
    await db.transaction((tx) => grantFreeMonthlyCredits(tx, u.learnerId, at));
    const again = await db.transaction((tx) => grantFreeMonthlyCredits(tx, u.learnerId, new Date("2026-10-20T08:00:00Z")));
    expect(again.granted).toBe(false);
    const next = await db.transaction((tx) => grantFreeMonthlyCredits(tx, u.learnerId, new Date("2026-11-01T00:00:01+05:30")));
    expect(next.granted).toBe(true);
    const lots = await pg<{ amount: number; bucket: string; expires_at: Date; grant_key: string }[]>`
      select l.amount, l.bucket, l.expires_at, l.grant_key from public.credit_lots l join public.credit_accounts a on a.id = l.credit_account_id
      where a.learner_id = ${u.learnerId} order by l.grant_key`;
    expect(lots.map((l) => l.grant_key)).toEqual(["monthly:2026-10", "monthly:2026-11"]);
    expect(lots[0]).toMatchObject({ amount: 30, bucket: "free_monthly" });
    expect(new Date(lots[0].expires_at).toISOString()).toBe(endOfIstMonth(at).toISOString());
    expect(new Date(lots[0].expires_at).toISOString()).toBe("2026-10-31T18:29:59.000Z"); // 23:59:59 IST
  });

  it("only active, onboarded learners without a running pass are eligible for the monthly 30", async () => {
    const onboarded = await learner();
    const fresh = await learner();
    await pg`update public.learners set onboarding_completed = true, exam_id = (select id from public.exams order by code limit 1) where id = ${onboarded.learnerId}`;
    const ids = await db.transaction((tx) => eligibleForFreeMonthly(tx, new Date()));
    expect(ids).toContain(onboarded.learnerId);
    expect(ids).not.toContain(fresh.learnerId);

    await pg`update public.users set status = 'consent_pending' where id = ${onboarded.id}`;
    expect(await db.transaction((tx) => eligibleForFreeMonthly(tx, new Date()))).not.toContain(onboarded.learnerId);
  });

  it("daily plan credits need a running pass", async () => {
    const u = await learner();
    expect((await db.transaction((tx) => grantDailyPlanCredits(tx, u.learnerId, new Date()))).granted).toBe(false);
  });
});

describe("spending order (BE-D33)", () => {
  it("takes the soonest-expiring lot first, then bucket order", async () => {
    const u = await learner();
    const t = Date.now();
    const late = await grant(u.learnerId, { bucket: "purchased", amount: 50, expiresAt: new Date(t + 90 * DAY) });
    const soon = await grant(u.learnerId, { bucket: "promotional", amount: 40, expiresAt: new Date(t + 5 * DAY) });
    const sameDayPlan = await grant(u.learnerId, { bucket: "daily_plan", amount: 30, expiresAt: new Date(t + 5 * DAY) });

    await reserve(u.learnerId, 50);
    const rem = async (id: string | null) => (await pg<{ remaining: number }[]>`select remaining from public.credit_lots where id = ${id}`)[0].remaining;
    // Same expiry: daily_plan before promotional; both before the later purchased lot.
    expect(await rem(sameDayPlan.lotId)).toBe(0);
    expect(await rem(soon.lotId)).toBe(20);
    expect(await rem(late.lotId)).toBe(50);
    await expectInvariants(u.learnerId);
  });

  it("a lot with no expiry is spent last", async () => {
    const u = await learner();
    const forever = await grant(u.learnerId, { amount: 10, expiresAt: null });
    const dated = await grant(u.learnerId, { amount: 10 });
    await reserve(u.learnerId, 10);
    const rem = async (id: string | null) => (await pg<{ remaining: number }[]>`select remaining from public.credit_lots where id = ${id}`)[0].remaining;
    expect(await rem(dated.lotId)).toBe(0);
    expect(await rem(forever.lotId)).toBe(10);
  });

  it("rejects with insufficient_credits and changes nothing", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 20 });
    expect(await codeOf(reserve(u.learnerId, 21))).toBe("insufficient_credits");
    expect(await balanceOf(u.learnerId)).toBe(20);
    const [{ n }] = await pg<{ n: number }[]>`select count(*)::int as n from public.credit_reservations r join public.credit_accounts a on a.id = r.credit_account_id where a.learner_id = ${u.learnerId}`;
    expect(n).toBe(0);
  });

  it("does not spend a lot that has already expired, even before the nightly job ran", async () => {
    const u = await learner();
    const at = new Date();
    await grant(u.learnerId, { amount: 30, expiresAt: new Date(at.getTime() - 1000) });
    await grant(u.learnerId, { amount: 10, expiresAt: new Date(at.getTime() + DAY) });
    expect(await codeOf(reserve(u.learnerId, 11, randomUUID(), at))).toBe("insufficient_credits");
    // The failed attempt rolled back; expiry is written by the job or by the next successful spend.
    await reserve(u.learnerId, 10, randomUUID(), at);
    expect(await balanceOf(u.learnerId)).toBe(0);
    await expectInvariants(u.learnerId);
  });
});

describe("reservations", () => {
  it("settle keeps the debit; settling twice is a no-op; releasing a settled one conflicts", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 100 });
    const r = await reserve(u.learnerId, 70);
    expect(r).toMatchObject({ status: "reserved", replay: false, balance: 30 });
    expect(await db.transaction((tx) => settleReservation(tx, r.reservationId, new Date()))).toBe("settled");
    expect(await db.transaction((tx) => settleReservation(tx, r.reservationId, new Date()))).toBe("settled");
    expect(await codeOf(db.transaction((tx) => releaseReservation(tx, r.reservationId, new Date())))).toBe("conflict");
    expect(await balanceOf(u.learnerId)).toBe(30);
    await expectInvariants(u.learnerId);
  });

  it("release restores the same lots and is idempotent", async () => {
    const u = await learner();
    const a = await grant(u.learnerId, { bucket: "promotional", amount: 30, expiresAt: new Date(Date.now() + 2 * DAY) });
    const b = await grant(u.learnerId, { bucket: "purchased", amount: 100, expiresAt: new Date(Date.now() + 90 * DAY) });
    const r = await reserve(u.learnerId, 50);
    expect(await balanceOf(u.learnerId)).toBe(80);
    await db.transaction((tx) => releaseReservation(tx, r.reservationId, new Date()));
    await db.transaction((tx) => releaseReservation(tx, r.reservationId, new Date()));
    const rem = async (id: string | null) => (await pg<{ remaining: number }[]>`select remaining from public.credit_lots where id = ${id}`)[0].remaining;
    expect(await rem(a.lotId)).toBe(30);
    expect(await rem(b.lotId)).toBe(100);
    expect(await balanceOf(u.learnerId)).toBe(130);
    expect(await codeOf(db.transaction((tx) => settleReservation(tx, r.reservationId, new Date())))).toBe("conflict");
    await expectInvariants(u.learnerId);
  });

  it("release into a lot that expired meanwhile becomes a 7-day promotional 'Returned credits' lot", async () => {
    const u = await learner();
    const t0 = new Date("2026-10-10T10:00:00Z");
    const expiring = await grant(u.learnerId, { bucket: "free_monthly", amount: 30, expiresAt: new Date(t0.getTime() + HOUR) });
    const r = await reserve(u.learnerId, 20, randomUUID(), t0);
    const later = new Date(t0.getTime() + 2 * HOUR);
    await db.transaction((tx) => releaseReservation(tx, r.reservationId, later));

    const lots = await pg<{ id: string; bucket: string; amount: number; remaining: number; expires_at: Date; description: string }[]>`
      select l.id, l.bucket, l.amount, l.remaining, l.expires_at, l.description from public.credit_lots l join public.credit_accounts a on a.id = l.credit_account_id
      where a.learner_id = ${u.learnerId} order by l.created_at`;
    const returned = lots.find((l) => l.id !== expiring.lotId)!;
    expect(returned).toMatchObject({ bucket: "promotional", amount: 20, remaining: 20, description: "Returned credits" });
    expect(new Date(returned.expires_at).toISOString()).toBe(endOfIstDay(new Date(later.getTime() + 7 * DAY)).toISOString());
    // The 10 left in the expired lot are removed by the expiry job; the returned 20 stay.
    await db.transaction((tx) => expireLearnerLots(tx, u.learnerId, later));
    expect(await balanceOf(u.learnerId)).toBe(20);
    await expectInvariants(u.learnerId);
  });

  it("the sweeper finds reservations older than 15 minutes and returns their credits", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 50 });
    const t0 = new Date();
    const r = await reserve(u.learnerId, 20, randomUUID(), t0);
    expect(await db.transaction((tx) => staleReservationIds(tx, new Date(t0.getTime() + 14 * 60_000)))).not.toContain(r.reservationId);
    const stale = await db.transaction((tx) => staleReservationIds(tx, new Date(t0.getTime() + 16 * 60_000)));
    expect(stale).toContain(r.reservationId);
    expect(await db.transaction((tx) => releaseReservation(tx, r.reservationId, new Date(t0.getTime() + 16 * 60_000), "expired"))).toBe("expired");
    expect(await balanceOf(u.learnerId)).toBe(50);
    const [row] = await pg<{ status: string }[]>`select status from public.credit_reservations where id = ${r.reservationId}`;
    expect(row.status).toBe("expired");
  });
});

describe("idempotency (BE-D35)", () => {
  it("the same key returns the first result and charges once", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 100 });
    const key = randomUUID();
    const ref = randomUUID();
    const first = await reserve(u.learnerId, 30, key, new Date(), ref);
    const second = await reserve(u.learnerId, 30, key, new Date(), ref);
    expect(second).toMatchObject({ reservationId: first.reservationId, replay: true, status: "reserved" });
    expect(await balanceOf(u.learnerId)).toBe(70);
    const [{ n }] = await pg<{ n: number }[]>`select count(*)::int as n from public.credit_transactions where reservation_id = ${first.reservationId}`;
    expect(n).toBe(1);
  });

  it("the same key for something different is a conflict", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 100 });
    const key = randomUUID();
    await reserve(u.learnerId, 30, key);
    expect(await codeOf(reserve(u.learnerId, 40, key))).toBe("conflict");
  });

  it("ten parallel presses with one key charge once", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 100 });
    const key = randomUUID();
    const ref = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve(u.learnerId, 25, key, new Date(), ref)));
    expect(new Set(results.map((r) => r.reservationId)).size).toBe(1);
    expect(results.filter((r) => !r.replay)).toHaveLength(1);
    expect(await balanceOf(u.learnerId)).toBe(75);
    await expectInvariants(u.learnerId);
  });
});

describe("concurrency (gate)", () => {
  it("20 parallel spends of 10 on a balance of 100 never overdraw: exactly 10 succeed", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 60, expiresAt: new Date(Date.now() + 2 * DAY) });
    await grant(u.learnerId, { bucket: "purchased", amount: 40, expiresAt: new Date(Date.now() + 90 * DAY) });

    const outcomes = await Promise.all(Array.from({ length: 20 }, () => codeOf(reserve(u.learnerId, 10))));
    expect(outcomes.filter((o) => o === "ok")).toHaveLength(10);
    expect(outcomes.filter((o) => o === "insufficient_credits")).toHaveLength(10);
    expect(await balanceOf(u.learnerId)).toBe(0);
    const [{ neg }] = await pg<{ neg: number }[]>`
      select count(*)::int as neg from public.credit_lots l join public.credit_accounts a on a.id = l.credit_account_id where a.learner_id = ${u.learnerId} and l.remaining < 0`;
    expect(neg).toBe(0);
    await expectInvariants(u.learnerId);
  });

  it("spends racing with releases and grants keep both invariants", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 200 });
    const first = await Promise.all(Array.from({ length: 8 }, () => reserve(u.learnerId, 10)));
    await Promise.all([
      ...first.slice(0, 4).map((r) => db.transaction((tx) => releaseReservation(tx, r.reservationId, new Date()))),
      ...first.slice(4).map((r) => db.transaction((tx) => settleReservation(tx, r.reservationId, new Date()))),
      ...Array.from({ length: 6 }, () => codeOf(reserve(u.learnerId, 10))),
      grant(u.learnerId, { amount: 25 }),
    ]);
    await expectInvariants(u.learnerId);
    expect(await balanceOf(u.learnerId)).toBeGreaterThanOrEqual(0);
  });
});

describe("expiry (BE-D36)", () => {
  it("a 'today' lot is usable at 23:59:58 IST and gone at 00:00:00 IST", async () => {
    const u = await learner();
    const day = new Date("2026-10-13T06:00:00Z");
    const expiresAt = endOfIstDay(day); // 23:59:59 IST
    expect(expiresAt.toISOString()).toBe("2026-10-13T18:29:59.000Z");
    await grant(u.learnerId, { bucket: "daily_plan", amount: 10, expiresAt });

    await reserve(u.learnerId, 5, randomUUID(), new Date("2026-10-13T18:29:58Z"));
    expect(await codeOf(reserve(u.learnerId, 5, randomUUID(), new Date("2026-10-13T18:30:00Z")))).toBe("insufficient_credits");

    const removed = await db.transaction((tx) => expireLearnerLots(tx, u.learnerId, new Date("2026-10-13T18:30:00Z")));
    expect(removed).toBe(5);
    expect(await balanceOf(u.learnerId)).toBe(0);
    const rows = await pg<{ transaction_type: string; amount: number }[]>`
      select t.transaction_type, t.amount from public.credit_transactions t join public.credit_accounts a on a.id = t.credit_account_id
      where a.learner_id = ${u.learnerId} order by t.created_at, t.amount`;
    expect(rows.map((r) => `${r.transaction_type}:${r.amount}`).sort()).toEqual(["consumption:-5", "expiration:-5", "promotion_grant:10"].sort());
    // Running it again does nothing.
    expect(await db.transaction((tx) => expireLearnerLots(tx, u.learnerId, new Date("2026-10-13T18:31:00Z")))).toBe(0);
    await expectInvariants(u.learnerId);
  });
});

describe("reads and RLS", () => {
  it("the balance summary counts only unexpired lots, per bucket", async () => {
    const u = await learner();
    await grant(u.learnerId, { bucket: "promotional", amount: 100 });
    await grant(u.learnerId, { bucket: "free_monthly", amount: 30, expiresAt: endOfIstMonth(new Date()) });
    await grant(u.learnerId, { bucket: "purchased", amount: 50, expiresAt: new Date(Date.now() - 1000) });
    const summary = await asUser(u.id, (tx) => getBalanceSummary(tx, u.learnerId, "free", new Date()));
    expect(summary.balance).toBe(130);
    expect(summary.buckets.map((b) => [b.key, b.amount])).toEqual([["free_monthly", 30], ["promotional", 100]]);
  });

  it("history is newest first, paged by 25 with a stable cursor, and private to the learner", async () => {
    const u = await learner();
    const other = await learner();
    await grant(u.learnerId, { amount: 500 });
    await db.transaction(async (tx) => {
      // One transaction = one timestamp: the cursor must still not skip or repeat rows.
      for (let i = 0; i < 30; i++) await reserveCredits(tx, { learnerId: u.learnerId, amount: 1, referenceType: "test", referenceId: randomUUID(), idempotencyKey: randomUUID(), description: `Spend ${i}`, now: new Date() });
    });
    const p1 = await asUser(u.id, (tx) => listCreditTransactions(tx, u.learnerId));
    expect(p1.rows).toHaveLength(25);
    expect(p1.next).not.toBeNull();
    const p2 = await asUser(u.id, (tx) => listCreditTransactions(tx, u.learnerId, p1.next!));
    expect(p2.rows).toHaveLength(6);
    expect(p2.next).toBeNull();
    const ids = [...p1.rows, ...p2.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(31);

    const theirs = await asUser(other.id, (tx) => listCreditTransactions(tx, u.learnerId));
    expect(theirs.rows).toHaveLength(0);
  });

  it("a learner cannot write the ledger", async () => {
    const u = await learner();
    await expect(asUser(u.id, (tx) => grantLot(tx, { learnerId: u.learnerId, bucket: "promotional", type: "promotion_grant", amount: 999, expiresAt: null, grantKey: "forged", description: "x" }))).rejects.toThrow();
    expect(await balanceOf(u.learnerId)).toBe(0);
  });

  it("the ledger is append-only: rows cannot be edited or deleted", async () => {
    const u = await learner();
    await grant(u.learnerId, { amount: 10 });
    await expect(pg`update public.credit_transactions set amount = 99 where credit_account_id = (select id from public.credit_accounts where learner_id = ${u.learnerId})`).rejects.toThrow();
    await expect(pg`delete from public.credit_transactions where credit_account_id = (select id from public.credit_accounts where learner_id = ${u.learnerId})`).rejects.toThrow();
  });
});
