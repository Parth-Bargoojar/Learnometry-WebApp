"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeQuestions } from "@/domains/content/service";
import { requireActionAdmin } from "@/lib/auth/session";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";

/* Review, publish and suspend (API.md `adminReviewQuestion` / `adminPublishQuestions` / `adminSuspendQuestions`, K2, K6). */

const schema = z.object({
  action: z.enum(["review", "publish", "suspend"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().trim().min(1).max(500),
});

export async function changeQuestionsAction(input: unknown) {
  return run(async () => {
    const admin = await requireActionAdmin();
    const result = await changeQuestions({ userId: admin.userId, role: admin.role }, parseInput(schema, input));
    revalidatePath("/admin/questions", "layout");
    return result;
  });
}
