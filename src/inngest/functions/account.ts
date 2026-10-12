import "server-only";
import { accountsDueForErasure, cleanupUnverifiedAccounts, eraseAccount } from "@/domains/identity/service";
import { EVENTS, inngest } from "../client";

/*
  Account lifecycle jobs (ARCHITECTURE §5). All handlers are idempotent: `eraseAccount` is a
  no-op for an account that is gone or reactivated, and the cleanup only deletes what is
  older than the cutoff. The business rules live in domains/identity/service.ts; these
  functions only decide WHEN.
*/

/** Waits until the erase date unless the person signs back in within 48 h (event), then erases. */
export const accountErase = inngest.createFunction(
  { id: "account-erase", triggers: [{ event: EVENTS.accountDeletionRequested }] },
  async ({ event, step }) => {
    const { userId, eraseBy } = event.data as { userId: string; eraseBy: string };
    const cancelled = await step.waitForEvent("wait-for-cancellation", {
      event: EVENTS.accountDeletionCancelled,
      timeout: new Date(eraseBy),
      if: "event.data.userId == async.data.userId",
    });
    if (cancelled) return { status: "cancelled" as const };
    const outcome = await step.run("erase", () => eraseAccount(userId));
    return { status: outcome };
  },
);

/** Safety net: erases anything whose date has passed even if its event was lost. 02:00 IST. */
export const accountEraseDue = inngest.createFunction(
  { id: "account-erase-due", triggers: [{ cron: "TZ=Asia/Kolkata 0 2 * * *" }] },
  async ({ step }) => {
    const ids = await step.run("find-due", () => accountsDueForErasure());
    let erased = 0;
    for (const userId of ids) {
      const outcome = await step.run(`erase-${userId}`, () => eraseAccount(userId));
      if (outcome === "erased") erased++;
    }
    return { due: ids.length, erased };
  },
);

/** Removes never-verified sign-ups and unconsented minors after seven days. 03:00 IST. */
export const accountUnverifiedCleanup = inngest.createFunction(
  { id: "account-unverified-cleanup", triggers: [{ cron: "TZ=Asia/Kolkata 0 3 * * *" }] },
  async ({ step }) => ({ removed: await step.run("cleanup", () => cleanupUnverifiedAccounts()) }),
);
