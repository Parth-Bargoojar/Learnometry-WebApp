"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { CircleAlert, Eye, EyeOff, GraduationCap, Users } from "lucide-react";
import { signInAction, signInWithGoogleAction, signUpAction } from "@/app/(auth)/actions";
import { btn } from "./ui";
import { siteUrl } from "@/lib/site";
import { SIGNUP_KEY, type SignupDraft } from "@/lib/guardian";
import type { ErrorBody } from "@/lib/errors/app-error";

/*
  Auth forms (Web App Structure §8.1). Submits go to Server Actions (Supabase Auth on the
  server, BE-D73); the browser never talks to Supabase. Client checks are a courtesy: the
  server validates again and its field messages land in the same error summary.
*/

/** Field errors from the server, or the general message anchored to `fallbackField`. */
export function errorsFrom(error: ErrorBody, fallbackField: string): Record<string, string> {
  return error.fields && Object.keys(error.fields).length ? error.fields : { [fallbackField]: error.message };
}

function rememberDraft(draft: SignupDraft) {
  try {
    sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(draft));
  } catch {}
}

export const input =
  "mt-1.5 h-12 w-full rounded-input border border-control bg-surface px-3.5 text-base text-ink transition-colors focus:border-ink aria-[invalid=true]:border-danger";

export function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-text">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  autoComplete,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  autoComplete: string;
  invalid: boolean;
  describedBy?: string;
  onChange?: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${input} pr-12 ${invalid ? "border-danger" : "border-border-subtle"}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1 top-[calc(0.375rem+2px)] flex size-11 items-center justify-center rounded-btn text-muted hover:text-ink"
      >
        {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}

function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await signInWithGoogleAction();
        if (res.ok) {
          window.location.assign(res.data.url);
          return;
        }
        setPending(false);
        onError(res.error.message);
      }}
      className={btn("secondary", "md", "w-full")}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
        <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.1a11 11 0 0 0 0 10l3.7-2.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
      Continue with Google
    </button>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium text-muted">
      <span className="h-px flex-1 bg-border-subtle" />
      or
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

const LOGIN_NOTICE: Record<string, string> = {
  link: "That link has expired or was already used. Log in, or ask for a new one.",
  callback: "Google sign-in didn't finish. Try again, or use your email and password.",
  deletion_pending: "This account has been closed and is being deleted.",
  suspended: "This account is suspended. Contact support if you think that's a mistake.",
};

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-5 flex items-start gap-2 rounded-card-sm border border-border-subtle bg-sunken px-3 py-2.5 text-sm text-ink">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
      <span>{children}</span>
    </p>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    const found: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) found.email = "Enter your email address, like name@example.com.";
    if (!password) found.password = "Enter your password.";
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    const res = await signInAction({ email, password, next });
    if (!res.ok) {
      setPending(false);
      setErrors(errorsFrom(res.error, "password"));
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    if (res.data.needsVerification) rememberDraft({ role: "student", name: "", email });
    router.push(res.data.next);
    router.refresh();
  };

  return (
    <>
      <h1 className="font-display text-2xl text-ink sm:text-[28px]">Log in to Learnometry</h1>
      <p className="mt-1.5 text-[15px] text-muted">Pick up your plan where you left it.</p>
      {notice && LOGIN_NOTICE[notice] ? <Notice>{LOGIN_NOTICE[notice]}</Notice> : null}
      <ErrorSummary errors={errors} refEl={summary} />
      <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-err" : undefined}
            className={`${input} ${errors.email ? "border-danger" : "border-border-subtle"}`}
          />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput id="password" autoComplete="current-password" invalid={!!errors.password} describedBy={errors.password ? "password-err" : undefined} />
        </Field>
        <Link href="/forgot-password" className="-mt-1 inline-flex min-h-11 items-center self-end text-sm font-semibold text-primary-text underline underline-offset-4">
          Forgot password?
        </Link>
        <button type="submit" disabled={pending} className={btn("primary", "md", "w-full")}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <Divider />
      <GoogleButton onError={(message) => setErrors({ email: message })} />
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary-text underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignupForm({ defaultRole = "student", guardianOpen = false }: { defaultRole?: "student" | "guardian"; guardianOpen?: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "guardian">(defaultRole);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  // Guardian accounts open with the guardian stage (BE-D50): until then the choice explains itself.
  const blocked = role === "guardian" && !guardianOpen;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (blocked) return;
    const d = new FormData(e.currentTarget);
    const name = String(d.get("name")).trim();
    const email = String(d.get("email")).trim();
    const password = String(d.get("new-password"));
    const next: Record<string, string> = {};
    if (!name) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter your email address, like name@example.com.";
    if (password.length < 8) next["new-password"] = "Use at least 8 characters.";
    if (!d.get("terms")) next.terms = "Agree to the Terms and Privacy Policy to continue.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    const res = await signUpAction({ role, name, email, password, terms: true });
    if (!res.ok) {
      setPending(false);
      setErrors(errorsFrom(res.error, "email"));
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    rememberDraft({ role, name, email });
    router.push("/verify-email");
  };

  const roles = [
    { v: "student" as const, t: "I'm a student", d: "Take a diagnostic and get a study plan.", i: GraduationCap },
    { v: "guardian" as const, t: "I'm a parent or guardian", d: "Set up an account for your child and approve their access.", i: Users },
  ];

  return (
    <>
      <h1 className="font-display text-2xl text-ink sm:text-[28px]">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-muted">Your first diagnostic and study plan are free.</p>
      <ErrorSummary errors={errors} refEl={summary} />
      <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Who is this account for?</legend>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {roles.map((r) => (
              <label key={r.v} className={`flex cursor-pointer items-center gap-3 rounded-card-sm border-2 p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${role === r.v ? "border-line bg-primary/10" : "border-border-subtle"}`}>
                <input type="radio" name="role" value={r.v} checked={role === r.v} onChange={() => setRole(r.v)} className="sr-only" />
                <r.i aria-hidden="true" className="size-5 shrink-0 text-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{r.t}</span>
                  <span className="block text-sm text-muted">{r.d}</span>
                </span>
                <span aria-hidden="true" className={`size-5 shrink-0 rounded-full border-2 border-faint ${role === r.v ? "bg-primary shadow-[inset_0_0_0_3px_var(--color-surface)]" : ""}`} />
              </label>
            ))}
          </div>
        </fieldset>
        {blocked ? <Notice>Parent and guardian accounts open soon. Students aged 18 and over can sign up now.</Notice> : null}
        <Field id="name" label={role === "student" ? "Your name" : "Your name (parent or guardian)"} error={errors.name}>
          <input id="name" name="name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-err" : undefined} className={`${input} ${errors.name ? "border-danger" : "border-border-subtle"}`} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} className={`${input} ${errors.email ? "border-danger" : "border-border-subtle"}`} />
        </Field>
        <Field id="new-password" label="Password" error={errors["new-password"]} help="At least 8 characters. A short phrase is easier to remember.">
          <PasswordInput id="new-password" autoComplete="new-password" invalid={!!errors["new-password"]} describedBy={errors["new-password"] ? "new-password-err" : "new-password-help"} />
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="terms" aria-invalid={!!errors.terms} aria-describedby={errors.terms ? "terms-err" : undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary-deep)]" />
            <span>
              I agree to the{" "}
              <a href={siteUrl("/terms")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">Terms</a> and{" "}
              <a href={siteUrl("/privacy")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">Privacy Policy</a>.
            </span>
          </label>
          {errors.terms ? (
            <p id="terms-err" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-text">
              <CircleAlert aria-hidden="true" className="size-4" />
              {errors.terms}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={pending || blocked} className={btn("primary", "md", "w-full")}>
          {pending ? "Creating your account…" : "Create account"}
        </button>
      </form>
      <Divider />
      <GoogleButton onError={(message) => setErrors({ email: message })} />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary-text underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}

/** Focusable error summary with links to each field (ui-ux-pro-max "focusable error summary"). */
export function ErrorSummary({ errors, refEl }: { errors: Record<string, string>; refEl: React.RefObject<HTMLDivElement | null> }) {
  const list = Object.entries(errors);
  if (!list.length) return null;
  return (
    <div ref={refEl} tabIndex={-1} role="alert" aria-labelledby="err-title" className="mt-5 rounded-card-sm border-2 border-danger bg-danger/5 p-4 outline-none">
      <h2 id="err-title" className="font-semibold text-ink">
        There {list.length === 1 ? "is a problem" : `are ${list.length} problems`}
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {list.map(([id, msg]) => (
          <li key={id}>
            <a href={`#${id}`} className="text-sm font-medium text-danger-text underline underline-offset-4">
              {msg}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
