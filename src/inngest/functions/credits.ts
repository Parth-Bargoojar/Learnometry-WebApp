import "server-only";
import { eligibleForFreeMonthly, grantDailyPlanCredits, grantFreeMonthlyCredits, learnersWithDailyPass } from "@/domains/credits/service";
import { expireLearnerLots, findLedgerDrift, learnersWithExpiredLots, releaseReservation, staleReservationIds } from "@/domains/credits/spend";
import { system } from "@/lib/db/system";
import { logger } from "@/lib/observability/log";
import { now } from "@/lib/time";
import { inngest } from "../client";

/*
  Credit jobs (ARCHITECTURE §5, BE-D36). The rules live in domains/credits; these functions only
  decide WHEN and fan out one step per learner so a failure retries that learner alone. Every
  handler is idempotent: grants carry natural keys, expiry and release are no-ops when done.
*/

/** 1st of the month 00:00 IST — 30 free credits for everyone eligible. */
export const creditsMonthlyRefill = inngest.createFunction(
  { id: "credits-monthly-refill", triggers: [{ cron: "TZ=Asia/Kolkata 0 0 1 * *" }] },
  async ({ step }) => {
    const at = new Date(await step.run("clock", () => now().toISOString()));
    const ids = await step.run("find-eligible", () => system((tx) => eligibleForFreeMonthly(tx, at)));
    let granted = 0;
    for (const id of ids) {
      const r = await step.run(`grant-${id}`, () => system((tx) => grantFreeMonthlyCredits(tx, id, at)));
      if (r.granted) granted++;
    }
    return { eligible: ids.length, granted };
  },
);

/** Daily 00:00 IST — top up plan credits for running passes (no passes exist before BE-10). */
export const creditsDailyRefill = inngest.createFunction(
  { id: "credits-daily-refill", triggers: [{ cron: "TZ=Asia/Kolkata 0 0 * * *" }] },
  async ({ step }) => {
    const at = new Date(await step.run("clock", () => now().toISOString()));
    const ids = await step.run("find-passes", () => system((tx) => learnersWithDailyPass(tx, at)));
    let granted = 0;
    for (const id of ids) {
      const r = await step.run(`grant-${id}`, () => system((tx) => grantDailyPlanCredits(tx, id, at)));
      if (r.granted) granted++;
    }
    return { passes: ids.length, granted };
  },
);

/** Daily 00:05 IST — zero expired lots and write the `expiration` rows. */
export const creditsExpire = inngest.createFunction(
  { id: "credits-expire", triggers: [{ cron: "TZ=Asia/Kolkata 5 0 * * *" }] },
  async ({ step }) => {
    const at = new Date(await step.run("clock", () => now().toISOString()));
    const ids = await step.run("find-expired", () => system((tx) => learnersWithExpiredLots(tx, at)));
    let removed = 0;
    for (const id of ids) removed += await step.run(`expire-${id}`, () => system((tx) => expireLearnerLots(tx, id, at)));
    return { learners: ids.length, removed };
  },
);

/** Every 5 min — give back credits held by a reservation nobody settled in 15 min (BE-D34). */
export const creditsReservationSweeper = inngest.createFunction(
  { id: "credits-reservation-sweeper", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const at = new Date(await step.run("clock", () => now().toISOString()));
    const ids = await step.run("find-stale", () => system((tx) => staleReservationIds(tx, at)));
    for (const id of ids) await step.run(`release-${id}`, () => system((tx) => releaseReservation(tx, id, at, "expired")));
    return { released: ids.length };
  },
);

/** Daily 04:00 IST — re-derive balances and lot remainders from the ledger; alert on any drift. */
export const creditsBalanceAudit = inngest.createFunction(
  { id: "credits-balance-audit", triggers: [{ cron: "TZ=Asia/Kolkata 0 4 * * *" }] },
  async ({ step }) => {
    const drift = await step.run("audit", () => system((tx) => findLedgerDrift(tx)));
    if (drift.length > 0) logger.error("credits.balance_drift", { count: drift.length, sample: drift.slice(0, 10) });
    return { drift: drift.length };
  },
);
