"use server";

import { revalidatePath } from "next/cache";
import { onboardingInputSchema } from "@/domains/identity/schemas";
import { saveOnboardingStep } from "@/domains/identity/service";
import { requireActionViewer } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";

/** Save one onboarding step (API.md `saveOnboardingStep`). */
export async function saveOnboardingStepAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionViewer();
    if (viewer.role !== "learner") throw new AppError("forbidden");
    const result = await saveOnboardingStep(viewer.userId, parseInput(onboardingInputSchema, input));
    revalidatePath("/", "layout");
    return result;
  });
}
