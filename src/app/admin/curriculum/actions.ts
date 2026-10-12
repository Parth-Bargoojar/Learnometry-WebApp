"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { discardCurriculumDraft, publishCurriculum, saveCurriculumDraft } from "@/domains/curriculum/service";
import { requireActionAdmin } from "@/lib/auth/session";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";

/* Curriculum draft and publish (API.md `adminEditCurriculumDraft` / `adminPublishCurriculum`, K2, K7). */

const exam = z.string().regex(/^[a-z0-9_]{2,30}$/);
const code = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const edge = z.object({ from: code, to: code });

export async function saveCurriculumDraftAction(input: unknown) {
  return run(async () => {
    const admin = await requireActionAdmin();
    const { exam: e, edges } = parseInput(z.object({ exam, edges: z.array(edge).max(500) }), input);
    return saveCurriculumDraft({ userId: admin.userId, role: admin.role }, e, edges);
  });
}

export async function discardCurriculumDraftAction(input: unknown) {
  return run(async () => {
    await requireActionAdmin();
    const { exam: e } = parseInput(z.object({ exam }), input);
    await discardCurriculumDraft(e);
    revalidatePath("/admin/curriculum");
    return { discarded: true as const };
  });
}

export async function publishCurriculumAction(input: unknown) {
  return run(async () => {
    const admin = await requireActionAdmin();
    const { exam: e, reason } = parseInput(z.object({ exam, reason: z.string().trim().min(1).max(500) }), input);
    const result = await publishCurriculum({ userId: admin.userId, role: admin.role }, e, reason);
    revalidatePath("/admin/curriculum");
    return result;
  });
}
