"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, MailCheck } from "lucide-react";
import { requestPasswordResetAction, resendVerificationAction, resetPasswordAction } from "@/app/(auth)/actions";
import { SIGNUP_KEY, type SignupDraft } from "@/lib/guardian";
import { ErrorSummary, Field, Notice, PasswordInput, errorsFrom, input } from "./auth-forms";
import { btn } from "./ui";

/*
  Verify email, forgot and reset password — Web App Structure §8.1.
  Supabase Auth sends the emails (Server Actions, BE-D73); these screens never reveal
  whether an account exists for an address.
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
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const { left, start } = useCountdown(60);
  const [notice, setNotice] = useState("");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the sign-up draft after mount
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, []);

  const known = draft?.email ?? "";
  const email = known || typed.trim();

  const resend = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setNotice("Enter the email you signed up with.");
      return;
    }
    setPending(true);
    const res = await resendVerificationAction({ email });
    setPending(false);
    if (res.ok) {
      setNotice("Sent again. It can take a minute, so check spam too.");
      start();
    } else {
      setNotice(res.error.message);
      if (res.error.code === "rate_limited") start();
    }
  };

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-card-sm border border-line bg-primary/15">
        <MailCheck aria-hidden="true" className="size-6 text-ink" />
      </span>
      <h1 className="mt-5 font-display text-2xl text-ink sm:text-[28px]">Check your inbox</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        We sent a link to <span className="break-all font-semibold text-ink">{known || "your email address"}</span>. Open it to confirm your email and start setting up. It works on any device.
      </p>
      {!known ? (
        <div className="mt-5">
          <Field id="email" label="Email you signed up with">
            <input id="email" type="email" autoComplete="email" inputMode="email" value={typed} onChange={(e) => setTyped(e.target.value)} className={`${input} border-border-subtle`} />
          </Field>
        </div>
      ) : null}
      <button type="button" disabled={left > 0 || pending} onClick={resend} className={btn("secondary", "md", "mt-6 w-full")}>
        {left > 0 ? `Resend in ${left}s` : pending ? "Sending…" : "Resend email"}
      </button>
      <p role="status" className="mt-2 min-h-5 text-center text-sm text-muted">
        {notice}
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Wrong email?{" "}
        <Link href="/signup" className="font-semibold text-primary-text underline underline-offset-4">
          Change it
        </Link>
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-8 rounded-card-sm border border-dashed border-faint p-4 text-sm text-muted">
          <span className="font-semibold text-ink">Development only.</span> Emails from the local stack arrive in the{" "}
          <a href="http://127.0.0.1:54324" target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">
            Mailpit inbox
          </a>
          .
        </p>
      ) : null}
    </>
  );
}

export function ForgotPasswordForm({ expired = false }: { expired?: boolean }) {
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
          <a href="http://127.0.0.1:54324" target="_blank" rel="noopener" className="mt-4 block text-center text-sm text-muted underline underline-offset-4">
            Development: open the Mailpit inbox
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl text-ink sm:text-[28px]">Reset your password</h1>
      <p className="mt-1.5 text-[15px] text-muted">Enter the email you signed up with and we&apos;ll send you a link.</p>
      {expired ? <Notice>That reset link has expired or was already used. Ask for a new one.</Notice> : null}
      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email")).trim();
          if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError("Enter your email address, like name@example.com.");
            requestAnimationFrame(() => document.getElementById("email")?.focus());
            return;
          }
          setError(null);
          setPending(true);
          const res = await requestPasswordResetAction({ email });
          if (res.ok) {
            setSent(true);
            return;
          }
          setPending(false);
          setError(res.error.fields?.email ?? res.error.message);
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
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const mismatch = confirm.length > 0 && confirm !== pw;

  if (done) {
    return (
      <div role="status">
        <span className="flex size-12 items-center justify-center rounded-full border border-line bg-success text-white">
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
        onSubmit={async (e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (pw.length < 8) next["new-password"] = "Use at least 8 characters.";
          if (confirm !== pw) next["confirm-password"] = "The passwords don't match.";
          setErrors(next);
          if (Object.keys(next).length) {
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }
          setPending(true);
          const res = await resetPasswordAction({ password: pw });
          setPending(false);
          if (res.ok) {
            setDone(true);
            return;
          }
          setErrors(errorsFrom(res.error, "new-password"));
          requestAnimationFrame(() => summary.current?.focus());
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
        <button type="submit" disabled={pending} className={btn("primary", "md", "w-full")}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </>
  );
}
