"use server";

import { revalidatePath } from "next/cache";
import { changeEmail, closeAccount, signOutOtherSessions } from "@/domains/identity/auth";
import { appearanceSchema, deletionSchema, engineSchema, profileSchema, studySettingsSchema } from "@/domains/identity/schemas";
import { updateAppearance, updateEngine, updateProfile, updateStudySettings } from "@/domains/identity/service";
import { requireActionLearner, requireActionViewer } from "@/lib/auth/session";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";
import { z } from "zod";

/* Settings (API.md §1): profile, study setup, appearance, engine, account. Each re-checks the session. */

const profileInput = profileSchema.extend({
  classLabel: z.enum(["Class 11", "Class 12", "Dropper", "Other"]).optional(),
  email: z.string().trim().toLowerCase().max(254).regex(/^\S+@\S+\.\S+$/, "Enter an email like name@example.com."),
});

export async function updateProfileAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionViewer();
    const p = parseInput(profileInput, input, { firstName: "first", lastName: "last" });
    await updateProfile(viewer.userId, { firstName: p.firstName, lastName: p.lastName, classLabel: p.classLabel });
    const emailChanged = p.email !== viewer.email.toLowerCase();
    if (emailChanged) await changeEmail(p.email);
    revalidatePath("/", "layout");
    return { emailChanged };
  });
}

export async function updateStudySettingsAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionLearner();
    const result = await updateStudySettings(viewer.userId, parseInput(studySettingsSchema, input));
    revalidatePath("/", "layout");
    return result;
  });
}

export async function updateAppearanceAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionViewer();
    await updateAppearance(viewer.userId, parseInput(appearanceSchema, input).theme);
    return { saved: true as const };
  });
}

export async function updateEngineAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionLearner();
    await updateEngine(viewer.userId, parseInput(engineSchema, input).engine, viewer.plan);
    revalidatePath("/settings/ai");
    return { saved: true as const };
  });
}

export async function signOutOtherDevicesAction() {
  return run(async () => {
    await requireActionViewer();
    await signOutOtherSessions();
    return { signedOut: true as const };
  });
}

export async function deleteAccountAction(input: unknown) {
  return run(async () => {
    const viewer = await requireActionViewer();
    parseInput(deletionSchema, input);
    const result = await closeAccount(viewer.userId);
    return { eraseBy: result.eraseBy.toISOString(), cancellableUntil: result.cancellableUntil.toISOString() };
  });
}
