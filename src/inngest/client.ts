import "server-only";
import { Inngest } from "inngest";
import { logger } from "@/lib/observability/log";

/*
  One Inngest app (ARCHITECTURE §5). Locally, run the dev server (`npx inngest-cli dev`) and set
  INNGEST_DEV=1; deployed environments use INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
*/
export const inngest = new Inngest({ id: "learnometry" });

/** Event names in one place (TRD §22 style: `domain.past-tense-verb`). */
export const EVENTS = {
  accountDeletionRequested: "account.deletion_requested",
  accountDeletionCancelled: "account.deletion_cancelled",
} as const;

/**
 * Enqueue after the database transaction has committed (WORKFLOW §6). A failed enqueue is
 * logged, never thrown: the jobs that matter have a sweeper that finds the work anyway.
 */
export async function sendEvent(name: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    await inngest.send({ name, data });
    return true;
  } catch (err) {
    logger.warn("inngest.send failed", { event: name, err });
    return false;
  }
}
