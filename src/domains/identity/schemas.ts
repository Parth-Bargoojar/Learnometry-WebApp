import { z } from "zod";
import { LEARNER_STEPS } from "./rules";
import { DAILY_MINUTE_PRESETS } from "@/domains/credits/costs";

/*
  Inputs for the identity operations (API.md §1). Messages are the copy the forms already use
  (Web App Structure §8.1) so a server-side failure reads the same as a client-side one.
*/
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^\S+@\S+\.\S+$/, "Enter your email address, like name@example.com.");

const password = z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer.");

const name = z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer.");

export const signUpSchema = z.object({
  role: z.enum(["student", "guardian"]),
  name,
  email,
  password,
  terms: z.literal(true, { error: "Agree to the Terms and Privacy Policy to continue." }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });

export const resendSchema = z.object({ email });

const dobParts = z.object({ day: z.coerce.number().int().min(1).max(31), month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(1900).max(2100) });

export const onboardingInputSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("about-you"), dob: dobParts, classLevel: z.enum(["Class 11", "Class 12", "Dropper", "Other"]).optional() }),
  z.object({ step: z.literal("exam"), exam: z.enum(["JEE Main", "NEET", "CBSE Class 11"]) }),
  z.object({
    step: z.literal("exam-date"),
    notSure: z.boolean().default(false),
    month: z.string().optional(),
    year: z.coerce.number().int().optional(),
  }),
  z.object({ step: z.literal("study-time"), minutes: z.coerce.number().int().refine((m) => (DAILY_MINUTE_PRESETS as readonly number[]).includes(m), "Choose how much time you have each day.") }),
]);
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export const isLearnerStep = (s: string): s is (typeof LEARNER_STEPS)[number] => (LEARNER_STEPS as readonly string[]).includes(s);

export const profileSchema = z.object({
  firstName: name,
  lastName: z.string().trim().max(80, "Use 80 characters or fewer.").default(""),
});

export const studySettingsSchema = z.object({
  // Presets plus custom times: 15–240 minutes in 15-minute steps (§1.9).
  minutes: z.coerce.number().int().min(15, "Choose a study time from the list.").max(240, "Choose a study time from the list.").refine((m) => m % 15 === 0, "Choose a study time from the list."),
  notSure: z.boolean().default(false),
  month: z.string().optional(),
  year: z.coerce.number().int().optional(),
  exam: z.enum(["JEE Main", "NEET", "CBSE Class 11"]).optional(),
});

export const appearanceSchema = z.object({ theme: z.enum(["system", "light", "dark"]) });

export const engineSchema = z.object({ engine: z.enum(["fast", "standard"]) });

export const deletionSchema = z.object({ confirmation: z.literal(true, { error: "Confirm that you want to delete your account." }) });

export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.") });
