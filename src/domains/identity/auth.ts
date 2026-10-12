import "server-only";
import { requireEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { isFlagOn } from "@/lib/flags";
import { logger } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENTS, sendEvent } from "@/inngest/client";
import { landingPathFor, requestAccountDeletion, resolveDeletionAtSignIn, type DeletionRequest } from "./service";
import { safeNextPath } from "./rules";
import type { z } from "zod";
import type { forgotPasswordSchema, resendSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

/*
  Supabase Auth from server actions (BE-D73). Email confirmation is required (BE-D26): a
  sign-up produces no session until the emailed link is opened, and every message about an
  address is the same whether or not it has an account, so nothing here reveals who is
  registered.
*/

const appUrl = () => requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");

/** Errors Supabase raises for the person, mapped to copy in the app's voice. */
function passwordProblem(message: string): AppError {
  if (/weak|short|characters|pwned|compromised|leaked/i.test(message)) {
    return new AppError("validation_failed", { fields: { "new-password": "Choose a stronger password. Try a longer phrase." }, message: "Choose a stronger password. Try a longer phrase." });
  }
  if (/same|different/i.test(message)) {
    return new AppError("validation_failed", { fields: { "new-password": "Choose a password you haven't used here before." }, message: "Choose a password you haven't used here before." });
  }
  return new AppError("internal");
}

export async function signUp(input: z.infer<typeof signUpSchema>): Promise<{ verifyEmailSent: true }> {
  if (input.role === "guardian" && !(await isFlagOn("minor_signup"))) {
    throw new AppError("feature_disabled", {
      message: "Parent and guardian accounts open soon. Students aged 18 and over can sign up now.",
    });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // The role is advisory: the database trigger only honours learner and guardian.
      data: { name: input.name, role: input.role === "guardian" ? "guardian" : "learner" },
      emailRedirectTo: `${appUrl()}/auth/confirm`,
    },
  });
  if (error) {
    if (error.status === 422 || /password/i.test(error.message)) throw passwordProblem(error.message);
    if (error.status === 429 || /rate/i.test(error.message)) throw new AppError("rate_limited", { retryAfter: 60 });
    logger.error("signUp failed", { status: error.status, code: error.code });
    throw new AppError("internal");
  }
  // Same answer for a new address and an existing one.
  return { verifyEmailSent: true };
}

export interface SignInResult {
  next: string;
  needsVerification?: boolean;
  deletionCancelled?: boolean;
}

export async function signIn(input: z.infer<typeof signInSchema>): Promise<SignInResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { next: "/verify-email", needsVerification: true };
    if (error?.status === 429 || error?.code === "over_request_rate_limit") throw new AppError("rate_limited", { retryAfter: 60 });
    if (error && error.status && error.status >= 500) throw new AppError("internal");
    // Wrong email and wrong password look identical.
    throw new AppError("unauthenticated", { message: "That email and password don't match. Try again, or reset your password." });
  }

  const outcome = await resolveDeletionAtSignIn(data.user.id);
  if (outcome === "blocked") {
    await supabase.auth.signOut();
    throw new AppError("forbidden", { message: "This account has been closed and is being deleted." });
  }
  if (outcome === "cancelled") await sendEvent(EVENTS.accountDeletionCancelled, { userId: data.user.id });

  const landing = await landingPathFor(data.user.id);
  // A requested page is honoured only for a fully set-up account; onboarding and 2FA come first.
  const setUp = landing === "/dashboard";
  return { next: setUp ? safeNextPath(input.next, landing) : landing, deletionCancelled: outcome === "cancelled" };
}

/** Starts the Google flow (PKCE). Returns the provider URL for a full-page redirect. */
export async function signInWithGoogle(): Promise<{ url: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${appUrl()}/auth/callback` } });
  if (error || !data.url) {
    logger.warn("google sign-in unavailable", { code: error?.code });
    throw new AppError("feature_disabled", { message: "Google sign-in isn't available yet. Use your email and password." });
  }
  return { url: data.url };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

/** Ends every other session of this account (password reset, "sign out of other devices"). */
export async function signOutOtherSessions(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new AppError("internal");
}

export async function resendVerification(input: z.infer<typeof resendSchema>): Promise<{ sentAt: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: input.email, options: { emailRedirectTo: `${appUrl()}/auth/confirm` } });
  if (error && (error.status === 429 || /rate|seconds/i.test(error.message))) throw new AppError("rate_limited", { retryAfter: 60 });
  // Unknown and already-confirmed addresses get the same answer.
  return { sentAt: new Date().toISOString() };
}

export async function requestPasswordReset(input: z.infer<typeof forgotPasswordSchema>): Promise<{ sent: true }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${appUrl()}/auth/confirm` });
  if (error && (error.status === 429 || /rate/i.test(error.message))) throw new AppError("rate_limited", { retryAfter: 60 });
  return { sent: true };
}

/** Needs the recovery session that `/auth/confirm` established from the emailed link. */
export async function resetPassword(input: z.infer<typeof resetPasswordSchema>): Promise<{ changed: true }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AppError("unauthenticated", { message: "This reset link has expired. Ask for a new one." });
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw passwordProblem(error.message);
  await signOutOtherSessions();
  return { changed: true };
}

export async function changeEmail(email: string): Promise<{ pendingConfirmation: true }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${appUrl()}/auth/confirm?next=/settings/profile` });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      // Do not reveal that the address is taken: report the same as success.
      return { pendingConfirmation: true };
    }
    if (error.status === 429) throw new AppError("rate_limited", { retryAfter: 60 });
    throw new AppError("validation_failed", { fields: { email: "Enter an email like name@example.com." }, message: "Enter an email like name@example.com." });
  }
  return { pendingConfirmation: true };
}

/** Deletion request: the database change, then end every session, then queue the erase job. */
export async function closeAccount(userId: string): Promise<DeletionRequest> {
  const result = await requestAccountDeletion(userId);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  await sendEvent(EVENTS.accountDeletionRequested, { userId, eraseBy: result.eraseBy.toISOString() });
  return result;
}

/* ---------- Admin second factor (K1, BE-D26) ---------- */

export interface TotpState {
  /** A verified authenticator exists: the screen asks for a code. Otherwise it offers enrolment. */
  factorId: string | null;
}

export async function totpState(): Promise<TotpState> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp?.find((f) => f.status === "verified");
  return { factorId: verified?.id ?? null };
}

export interface TotpEnrolment {
  factorId: string;
  /** SVG data URI of the QR code. */
  qr: string;
  secret: string;
}

export async function enrollTotp(): Promise<TotpEnrolment> {
  const supabase = await createSupabaseServerClient();
  // A half-finished earlier attempt would block a new enrolment: drop it first.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Learnometry admin" });
  if (error || !data) throw new AppError("internal");
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms a code and upgrades the session to AAL2; the refreshed cookie is written by the client library. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr || !challenge) throw new AppError("internal");
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) {
    if (error.status === 429) throw new AppError("rate_limited", { retryAfter: 30 });
    throw new AppError("validation_failed", { fields: { code: "That code didn't work. Wait for a new one and try again." }, message: "That code didn't work. Wait for a new one and try again." });
  }
}
