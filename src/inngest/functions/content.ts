import "server-only";
import { runLlmValidators } from "@/domains/content/llm-validation";
import { system } from "@/lib/db/system";
import { EVENTS, inngest } from "../client";

/*
  Content jobs (ARCHITECTURE §5). `content.imported` carries the rows a `content:import` created or
  changed; each gets its semantic validators recorded. Idempotent per (question, version).
*/
export const contentValidateLlm = inngest.createFunction(
  { id: "content-validate-llm", triggers: [{ event: EVENTS.contentImported }], concurrency: 4 },
  async ({ event, step }) => {
    const { items } = event.data as { items: { questionId: string; version: number }[] };
    let validated = 0;
    for (const { questionId, version } of items) {
      const done = await step.run(`validate-${questionId}-${version}`, () => system((tx) => runLlmValidators(tx, questionId, version)));
      if (done.length > 0) validated++;
    }
    return { validated, skipped: items.length - validated };
  },
);
