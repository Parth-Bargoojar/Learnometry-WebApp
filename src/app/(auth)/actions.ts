"use server";

import {
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
} from "@/domains/identity/auth";
import { forgotPasswordSchema, resendSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/domains/identity/schemas";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";

/* Server Actions for the auth screens (API.md §1). Thin: parse, call the service, map the result. */

export async function signUpAction(input: unknown) {
  return run(() => signUp(parseInput(signUpSchema, input, { password: "new-password" })));
}

export async function signInAction(input: unknown) {
  return run(() => signIn(parseInput(signInSchema, input)));
}

/** Returns the provider URL; the form navigates to it (full-page redirect). */
export async function signInWithGoogleAction() {
  return run(() => signInWithGoogle());
}

export async function resendVerificationAction(input: unknown) {
  return run(() => resendVerification(parseInput(resendSchema, input)));
}

export async function requestPasswordResetAction(input: unknown) {
  return run(() => requestPasswordReset(parseInput(forgotPasswordSchema, input)));
}

export async function resetPasswordAction(input: unknown) {
  return run(() => resetPassword(parseInput(resetPasswordSchema, input, { password: "new-password" })));
}

/** The client clears its device data first, then calls this, then goes to /login. */
export async function signOutAction() {
  return run(async () => {
    await signOut();
    return { signedOut: true as const };
  });
}
