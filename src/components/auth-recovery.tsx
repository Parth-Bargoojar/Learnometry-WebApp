"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, MailCheck } from "lucide-react";
import { SIGNUP_KEY, type SignupDraft } from "@/lib/guardian";
import { ErrorSummary, Field, PasswordInput, input } from "./auth-forms";
import { btn } from "./ui";

/*
  Verify email, forgot and reset password — Web App Structure §8.1.
  Supabase Auth sends the emails; these screens never reveal whether an
  account exists for an address.
*/

export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}

export function VerifyEmail() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const { left, start } = useCountdown(60);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the sign-up draft after mount
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, []);

  const email = draft?.email || "your email address";
  const next = draft?.role === "guardian" ? "/onboarding/child" : "/onboarding/about-you";

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-card-sm border-2 border-line bg-primary/15">
        <MailCheck aria-hidden="true" className="size-6 text-ink" />
      </span>
      <h1 className="mt-5 font-display text-2xl text-ink sm:text-[28px]">Check your inbox</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        We sent a link to <span className="break-all font-semibold text-ink">{email}</span>. Open it on this device to confirm your email and start setting up.
      </p>
      <button
        type="button"
        disabled={left > 0}
        onClick={() => {
          setSent((n) => n + 1);
          start();
        }}
        className={btn("secondary", "md", "mt-6 w-full")}
      >
        {left > 0 ? `Resend in ${left}s` : "Resend email"}
      </button>
      <p role="status" className="mt-2 min-h-5 text-center text-sm text-muted">
        {sent ? "Sent again. It can take a minute, so check spam too." : null}
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Wrong email?{" "}
        <Link href="/signup" className="font-semibold text-primary-text underline underline-offset-4">
          Change it
        </Link>
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-8 rounded-card-sm border border-dashed border-faint p-4 text-sm text-muted">
          <p className="font-semibold text-ink">Preview only</p>
          <p className="mt-1">In the product, the link in the email does this.</p>
          <button type="button" onClick={() => router.push(next)} className={btn("secondary", "sm", "mt-3")}>
            Simulate opening the link
          </button>
        </div>
      ) : null}
    </>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (sent) {
    return (
      <div role="status">
        <h1 className="font-display text-2xl text-ink sm:text-[28px]">Check your inbox</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">If an account exists for this email, we&apos;ve sent a reset link. It works for 1 hour.</p>
        <Link href="/login" className={btn("secondary", "md", "mt-6 w-full")}>
          Back to log in
        </Link>
        {process.env.NODE_ENV !== "production" ? (
          <Link href="/reset-password" className="mt-4 block text-center text-sm text-muted underline underline-offset-4">
            Preview: open the reset link
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl text-ink sm:text-[28px]">Reset your password</h1>
      <p className="mt-1.5 text-[15px] text-muted">Enter the email you signed up with and we&apos;ll send you a link.</p>
      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email"));
          if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError("Enter your email address, like name@example.com.");
            requestAnimationFrame(() => document.getElementById("email")?.focus());
            return;
          }
          setError(null);
          setPending(true);
          window.setTimeout(() => setSent(true), 600);
        }}
      >
        <Field id="email" label="Email" error={error ?? undefined}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!error}
            aria-describedby={error ? "email-err" : undefined}
            className={`${input} ${error ? "border-danger" : "border-border-subtle"}`}
          />
        </Field>
        <button type="submit" disabled={pending} className={btn("primary", "md", "w-full")}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary-text underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const mismatch = confirm.length > 0 && confirm !== pw;

  if (done) {
    return (
      <div role="status">
        <span className="flex size-12 items-center justify-center rounded-full border-2 border-line bg-success text-white">
          <Check aria-hidden="true" className="size-6" strokeWidth={3} />
        </span>
        <h1 className="mt-5 font-display text-2xl text-ink sm:text-[28px]">Password changed</h1>
        <p className="mt-2 text-[15px] text-muted">We signed you out on your other devices to keep your account safe.</p>
        <Link href="/login" className={btn("primary", "md", "mt-6 w-full")}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl text-ink sm:text-[28px]">Choose a new password</h1>
      <p className="mt-1.5 text-[15px] text-muted">At least 8 characters. A short phrase is easier to remember.</p>
      <ErrorSummary errors={errors} refEl={summary} />
      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (pw.length < 8) next["new-password"] = "Use at least 8 characters.";
          if (confirm !== pw) next["confirm-password"] = "The passwords don't match.";
          setErrors(next);
          if (Object.keys(next).length) {
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }
          setDone(true);
        }}
      >
        <Field id="new-password" label="New password" error={errors["new-password"]}>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            invalid={!!errors["new-password"]}
            describedBy={errors["new-password"] ? "new-password-err" : undefined}
            onChange={setPw}
          />
        </Field>
        <div>
          <Field id="confirm-password" label="Confirm new password" error={errors["confirm-password"]}>
            <PasswordInput id="confirm-password" autoComplete="new-password" invalid={!!errors["confirm-password"] || mismatch} describedBy="confirm-live" onChange={setConfirm} />
          </Field>
          {!errors["confirm-password"] ? (
            <p id="confirm-live" aria-live="polite" className={`mt-1.5 min-h-5 text-sm ${mismatch ? "text-danger-text" : "text-success-text"}`}>
              {confirm.length === 0 ? "" : mismatch ? "Doesn't match yet." : "Passwords match."}
            </p>
          ) : null}
        </div>
        <button type="submit" className={btn("primary", "md", "w-full")}>
          Save new password
        </button>
      </form>
    </>
  );
}
