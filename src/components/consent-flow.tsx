"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, Clock, ShieldCheck } from "lucide-react";
import { TODAY } from "@/lib/data";
import { fullDate, shortDate } from "@/lib/format";
import {
  CONSENT,
  CONSENT_TERMS,
  PREVIEW_CONSENT_TOKEN,
  addBusinessDays,
  addDays,
  maskContact,
  type ConsentRequest,
} from "@/lib/guardian";
import { SHARED, useShared } from "@/lib/local-store";
import { siteUrl } from "@/lib/site";
import { Dialog } from "./dialog";
import { Mascot } from "./feedback";
import { useCountdown } from "./auth-recovery";
import { btn } from "./ui";

/*
  Guardian consent landing — Web App Structure §8.18, decision D4.
  Public, no login. Verify with a one-time code, read what you're agreeing to,
  declare you're the parent or lawful guardian and 18+, then give or decline.
  API: GET /api/consent/:token · POST …/otp · POST …/verify · POST …/decision.
*/

/** The code the preview accepts. Production codes are random and sent by email/SMS. */
const PREVIEW_OTP = "246810";

/** What the page shows before onboarding has created a request in this browser. */
const SAMPLE: ConsentRequest = {
  token: PREVIEW_CONSENT_TOKEN,
  learnerFirstName: "Aarav",
  guardianName: "Priya Sharma",
  relation: "Parent",
  contact: "priya.sharma@example.com",
  status: "pending",
  sentOn: TODAY,
  sendsToday: 1,
};

type Step = "intro" | "verify" | "agree" | "given" | "declined";

export function ConsentFlow({ token }: { token: string }) {
  const [stored, setStored] = useShared<ConsentRequest | null>(SHARED.consent, null);
  const [step, setStep] = useState<Step>("intro");
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  if (token !== PREVIEW_CONSENT_TOKEN) {
    return (
      <Shell>
        <span className="flex size-12 items-center justify-center rounded-card-sm bg-sunken">
          <Clock aria-hidden="true" className="size-6 text-muted" />
        </span>
        <h1 className="mt-5 font-display text-2xl text-ink sm:text-[28px]">This link has expired</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Consent links work for {CONSENT.pendingDays} days and only once. Ask your child to send a new one from their Learnometry setup screen. Nothing was shared
          while you waited.
        </p>
        <a href={siteUrl("/guardian-consent")} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          How guardian consent works
        </a>
      </Shell>
    );
  }

  const req = stored ?? SAMPLE;
  const name = req.learnerFirstName;
  const decide = (status: "verified" | "declined") => {
    setStored({ ...req, status, decidedOn: TODAY });
    setStep(status === "verified" ? "given" : "declined");
  };

  if (step === "given") {
    return (
      <Shell>
        <div role="status" className="flex flex-col items-center text-center">
          <Mascot size="md" />
          <h1 ref={heading} tabIndex={-1} className="mt-5 font-display text-2xl text-ink outline-none sm:text-[28px]">
            Thank you. {name} can start now.
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Consent recorded on {fullDate(TODAY)}. You can withdraw it at any time, and withdrawing is as easy as giving it.
          </p>
        </div>
        <div className="mt-7 rounded-card border border-border-subtle bg-sunken p-4">
          <p className="font-semibold text-ink">See {name}&apos;s progress</p>
          <p className="mt-1 text-sm text-muted">
            A free guardian account shows scores, weak topics and plan progress, and lets you approve purchases. Consent doesn&apos;t require one.
          </p>
          <Link href="/signup?role=guardian" className={btn("primary", "md", "mt-4 w-full sm:w-auto")}>
            Create a guardian account
          </Link>
        </div>
        <p className="mt-5 text-center text-sm text-muted">You can close this page.</p>
      </Shell>
    );
  }

  if (step === "declined") {
    return (
      <Shell>
        <div role="status">
          <h1 ref={heading} tabIndex={-1} className="font-display text-2xl text-ink outline-none sm:text-[28px]">
            You declined
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            We&apos;ve told {name}. What {name} entered will be deleted by {fullDate(addBusinessDays(TODAY, CONSENT.deletionBusinessDays))}, and nothing else is
            collected. If this was a mistake, {name} can send you a new link.
          </p>
        </div>
      </Shell>
    );
  }

  // A link whose decision was already recorded (the real API marks tokens used).
  if (req.status !== "pending") {
    return (
      <Shell>
        <h1 className="font-display text-2xl text-ink sm:text-[28px]">This link has already been used</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {req.status === "verified" ? `You gave consent for ${name} on ${fullDate(req.decidedOn ?? TODAY)}.` : `You declined ${name}'s request.`} To change it, write to
          us from this email address, or use your guardian account.
        </p>
        <Link href="/guardian/settings" className={btn("secondary", "md", "mt-6")}>
          Guardian settings
        </Link>
      </Shell>
    );
  }

  const n = { intro: 1, verify: 2, agree: 3 }[step];

  return (
    <Shell>
      <p className="text-sm font-semibold text-muted">
        Step {n} of 3
        <span className="sr-only"> of approving {name}&apos;s account</span>
      </p>
      <div role="progressbar" aria-label="Consent progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={n} className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(n / 3) * 100}%` }} />
      </div>

      {step === "intro" ? (
        <>
          <h1 ref={heading} tabIndex={-1} className="mt-6 font-display text-2xl leading-tight text-ink outline-none sm:text-[28px]">
            {name} has asked you to approve their Learnometry account
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Learnometry is a study app for JEE, NEET and CBSE students. It finds the concepts behind wrong answers and builds a study plan around them. Because {name} is
            under 18, the law (DPDP Act 2023) needs your consent first.
          </p>
          <dl className="mt-5 divide-y divide-border-subtle rounded-card-sm border border-border-subtle text-sm">
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">Requested</dt>
              <dd className="font-medium text-ink">{shortDate(req.sentOn)}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">You were named as</dt>
              <dd className="font-medium text-ink">
                {req.guardianName} · {req.relation}
              </dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">Link works until</dt>
              <dd className="font-medium text-ink">{shortDate(addDays(req.sentOn, CONSENT.pendingDays))}</dd>
            </div>
          </dl>
          <button type="button" onClick={() => setStep("verify")} className={btn("primary", "md", "mt-6 w-full")}>
            Continue
          </button>
          <p className="mt-4 text-sm text-muted">
            Don&apos;t know {name}? You can ignore this. Nothing happens without your approval, and what {name} entered is deleted after {CONSENT.pendingDays} days.
          </p>
        </>
      ) : null}

      {step === "verify" ? <Verify req={req} headingRef={heading} onVerified={() => setStep("agree")} /> : null}

      {step === "agree" ? <Agree name={name} headingRef={heading} onGive={() => decide("verified")} onDecline={() => decide("declined")} /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}

function Verify({ req, headingRef, onVerified }: { req: ConsentRequest; headingRef: React.RefObject<HTMLHeadingElement | null>; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sends, setSends] = useState(0);
  const { left, start } = useCountdown(CONSENT.resendSeconds);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = tries >= CONSENT.otpAttempts;
  const where = req.contact.includes("@") ? "email" : "phone";

  const send = () => {
    setSent(true);
    setSends((s) => s + 1);
    setTries(0);
    setCode("");
    setError(null);
    start();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-2xl leading-tight text-ink outline-none sm:text-[28px]">
        First, confirm it&apos;s you
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        We&apos;ll send a {CONSENT.otpLength}-digit code to the {where} {req.learnerFirstName} gave us: <span className="font-semibold text-ink">{maskContact(req.contact)}</span>.
      </p>

      {!sent ? (
        <button type="button" onClick={send} className={btn("primary", "md", "mt-6 w-full")}>
          Send code
        </button>
      ) : (
        <form
          noValidate
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (locked) return;
            if (!/^\d{6}$/.test(code)) {
              setError(`Enter the ${CONSENT.otpLength}-digit code.`);
              return;
            }
            if (code !== PREVIEW_OTP) {
              const t = tries + 1;
              setTries(t);
              setError(t >= CONSENT.otpAttempts ? "Too many tries. Send a new code to continue." : `That code doesn't match. ${CONSENT.otpAttempts - t} ${CONSENT.otpAttempts - t === 1 ? "try" : "tries"} left.`);
              return;
            }
            onVerified();
          }}
        >
          <label htmlFor="otp" className="text-sm font-semibold text-ink">
            {CONSENT.otpLength}-digit code
          </label>
          <input
            ref={inputRef}
            id="otp"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, CONSENT.otpLength));
              setError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={CONSENT.otpLength}
            disabled={locked}
            aria-invalid={!!error}
            aria-describedby={error ? "otp-err otp-help" : "otp-help"}
            className={`mt-1.5 h-14 w-full rounded-input border bg-surface px-4 text-center font-display text-2xl tracking-[0.4em] text-ink tabular-nums focus:border-ink ${
              error ? "border-danger" : "border-control"
            }`}
          />
          {error ? (
            <p id="otp-err" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger-text">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <p id="otp-help" className="mt-2 text-xs text-muted">
            The code works for {CONSENT.otpValidMinutes} minutes.
          </p>
          <button type="submit" disabled={locked} className={btn("primary", "md", "mt-5 w-full")}>
            Verify
          </button>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">Didn&apos;t get it? Check spam.</span>
            <button
              type="button"
              onClick={send}
              disabled={left > 0 || sends >= CONSENT.sendsPerDay}
              className="inline-flex min-h-11 items-center font-semibold text-primary-text underline underline-offset-4 disabled:text-muted disabled:no-underline"
            >
              {sends >= CONSENT.sendsPerDay ? "No more codes today" : left > 0 ? `Resend in ${left}s` : "Send a new code"}
            </button>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <p className="mt-4 rounded-card-sm border border-dashed border-faint p-3 text-xs text-muted">
              Preview only: the code is <span className="font-semibold tabular-nums text-ink">{PREVIEW_OTP}</span>.
            </p>
          ) : null}
        </form>
      )}
    </>
  );
}

function Agree({
  name,
  headingRef,
  onGive,
  onDecline,
}: {
  name: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onGive: () => void;
  onDecline: () => void;
}) {
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const lists: [string, readonly string[]][] = [
    ["What we collect", CONSENT_TERMS.collect],
    ["What we never do", CONSENT_TERMS.never],
    ["What you can do", CONSENT_TERMS.rights],
  ];
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-2xl leading-tight text-ink outline-none sm:text-[28px]">
        What you&apos;re agreeing to
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-success-text">
        <ShieldCheck aria-hidden="true" className="size-4" /> Verified
      </p>
      <div className="mt-5 flex flex-col gap-5">
        {lists.map(([title, items]) => (
          <section key={title} aria-label={title}>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {items.map((t) => (
                <li key={t} className="flex gap-2 text-[15px] text-ink">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">
        Full details:{" "}
        <a href={siteUrl("/guardian-consent")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">
          Guardian Consent Policy
        </a>{" "}
        ·{" "}
        <a href={siteUrl("/privacy")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">
          Privacy Policy
        </a>
      </p>

      <div className="mt-6">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-card-sm border-2 p-4 text-[15px] font-medium text-ink ${error ? "border-danger bg-danger/5" : "border-line bg-primary/10"}`}
        >
          <input
            type="checkbox"
            checked={declared}
            onChange={(e) => {
              setDeclared(e.target.checked);
              setError(false);
            }}
            aria-invalid={error}
            aria-describedby={error ? "decl-err" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary-deep)]"
          />
          I am {name}&apos;s parent or legal guardian and I am 18 or older.
        </label>
        {error ? (
          <p id="decl-err" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger-text">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            Tick the box to confirm before giving consent.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" onClick={() => (declared ? onGive() : setError(true))} className={btn("primary", "md", "w-full sm:flex-1")}>
          Give consent
        </button>
        <button type="button" onClick={() => setConfirmDecline(true)} className={btn("secondary", "md", "w-full sm:flex-1")}>
          Decline
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">We record the date, the method and the policy version with your consent.</p>

      <Dialog
        open={confirmDecline}
        onClose={() => setConfirmDecline(false)}
        title={`Decline ${name}'s request?`}
        description={`We'll tell ${name}, and what they entered is deleted within ${CONSENT.deletionBusinessDays} business days.`}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setConfirmDecline(false)} className={btn("secondary")}>
            Go back
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDecline(false);
              onDecline();
            }}
            className={btn("destructive")}
          >
            Decline
          </button>
        </div>
      </Dialog>
    </>
  );
}
