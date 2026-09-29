"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, CircleCheck, ExternalLink, Lock, MailCheck, X } from "lucide-react";
import { COST, DAILY_MINUTE_PRESETS } from "@/lib/config";
import { TODAY } from "@/lib/data";
import { fullDate, shortDate } from "@/lib/format";
import {
  CONSENT,
  CONSENT_TERMS,
  MIN_AGE,
  PREVIEW_CONSENT_TOKEN,
  SIGNUP_KEY,
  addDays,
  ageOn,
  isEmail,
  isIndianMobile,
  maskContact,
  type ConsentRequest,
  type SignupDraft,
} from "@/lib/guardian";
import { SHARED, readShared, useShared, writeShared } from "@/lib/local-store";
import { Mascot } from "./feedback";
import { useCountdown } from "./auth-recovery";
import { Cost, btn } from "./ui";
import { siteUrl } from "@/lib/site";

/*
  Onboarding — Web App Structure §8.2, decisions D4 and D5.
  Learner path: date of birth first; under 18 nothing else is collected until a
  guardian consents. Guardian path: the guardian adds the child, consents inline,
  sets up the child's exam and time, and the child gets an invite.
  Answers persist in session storage so Back and refresh keep them (the API
  persists them in production).
*/

type Answers = {
  day?: string;
  month?: string;
  year?: string;
  cls?: string;
  guardianName?: string;
  relation?: string;
  guardianContact?: string;
  confirmGuardian?: boolean;
  exam?: string;
  subjects?: string[];
  examMonth?: string;
  examYear?: string;
  notSure?: boolean;
  minutes?: number;
  childName?: string;
  childEmail?: string;
  declaration?: boolean;
};

const KEY = "lm-onboarding";
const STEPS_ADULT = ["about-you", "exam", "subjects", "exam-date", "study-time"];
const STEPS_MINOR = ["about-you", "guardian", "exam", "subjects", "exam-date", "study-time"];
const STEPS_GUARDIAN = ["child", "consent", "exam", "subjects", "exam-date", "study-time"];
const TITLES: Record<string, string> = {
  child: "Your child",
  consent: "Consent",
  "about-you": "About you",
  guardian: "Parent or guardian",
  exam: "Your exam",
  subjects: "Subjects",
  "exam-date": "Exam date",
  "study-time": "Daily time",
};

function ageFrom(a: Answers) {
  if (!a.day || !a.month || !a.year) return null;
  const iso = `${a.year}-${a.month.padStart(2, "0")}-${a.day.padStart(2, "0")}`;
  // Reject impossible dates like 31 Feb rather than rolling them over.
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return ageOn(iso, TODAY);
}

export function Onboarding({ step }: { step: string }) {
  const router = useRouter();
  const [a, setA] = useState<Answers>({});
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-held answers after mount
      if (raw) setA(JSON.parse(raw));
      const d = sessionStorage.getItem(SIGNUP_KEY);
      if (d) setDraft(JSON.parse(d));
    } catch {}
    setLoaded(true);
  }, []);

  const update = (patch: Partial<Answers>) => {
    setError(null);
    setA((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const age = ageFrom(a);
  // The guardian path is chosen at sign-up; its own steps also imply it after a refresh.
  const guardianPath = draft?.role === "guardian" || step === "child" || step === "consent" || step === "invite-sent";
  const minor = !guardianPath && age !== null && age < 18;
  const steps = guardianPath ? STEPS_GUARDIAN : minor ? STEPS_MINOR : STEPS_ADULT;
  const idx = steps.indexOf(step);
  const go = (s: string) => router.push(`/onboarding/${s}`);
  const child = guardianPath ? a.childName?.trim() || "your child" : null;

  if (!loaded) return <div className="min-h-screen" />;

  if (step === "waiting")
    return (
      <Frame progress={null} title="Waiting for approval">
        <Waiting a={a} learnerName={draft?.name?.split(" ")[0] || ""} onApproved={() => go("exam")} />
      </Frame>
    );
  if (step === "ready") return <Frame progress={null} title="All set"><Ready a={a} /></Frame>;
  if (step === "invite-sent") return <Frame progress={null} title="Invite sent"><InviteSent a={a} /></Frame>;

  const next = () => {
    if (step === "child") {
      const name = a.childName?.trim();
      if (!name) return setError("Enter your child's first name.");
      if (age === null) return setError(`Enter ${name}'s full date of birth.`);
      if (age < MIN_AGE) return setError(`Learnometry is for students aged ${MIN_AGE} and over.`);
      if (age >= 18) return setError(`${name} is 18 or older and can sign up without a guardian account.`);
      if (!a.cls) return setError(`Choose ${name}'s class.`);
      if (!a.childEmail || !isEmail(a.childEmail)) return setError(`Enter ${name}'s email, like name@example.com. Their login invite goes there.`);
      if (draft?.email && a.childEmail.trim().toLowerCase() === draft.email.toLowerCase())
        return setError(`Use ${name}'s own email. Yours is already your guardian login.`);
      return go("consent");
    }
    if (step === "consent") {
      if (!a.declaration) return setError(`Confirm you are ${child}'s parent or legal guardian and 18 or older.`);
      return go("exam");
    }
    if (step === "about-you") {
      if (age === null) return setError("Enter your full date of birth.");
      if (age < 13) return setError("Learnometry is for students aged 13 and over.");
      if (!a.cls) return setError("Choose your class.");
      return go(minor ? "guardian" : "exam");
    }
    if (step === "guardian") {
      if (!a.guardianName?.trim()) return setError("Enter your parent or guardian's name.");
      const contact = a.guardianContact?.trim() ?? "";
      if (!isEmail(contact) && !isIndianMobile(contact)) return setError("Enter their email, or a 10-digit Indian mobile number.");
      if (draft?.email && contact.toLowerCase() === draft.email.toLowerCase()) return setError("That's your own email. Enter your parent or guardian's contact.");
      if (!a.confirmGuardian) return setError("Confirm this is your parent or legal guardian.");
      return go("waiting");
    }
    if (step === "exam" && !a.exam) return setError("Choose your exam.");
    if (step === "exam-date" && !a.notSure && (!a.examMonth || !a.examYear)) return setError("Choose a month and year, or tick “Not sure yet”.");
    if (step === "study-time" && !a.minutes) return setError("Choose how much time you have each day.");
    const n = steps[idx + 1];
    go(n ?? (guardianPath ? "invite-sent" : "ready"));
  };

  // Back from "exam" lands on the guardian or consent step: the waiting screen is done.
  const back = () => (idx <= 0 ? router.push("/signup") : go(steps[idx - 1]));

  return (
    <Frame progress={{ n: idx + 1, of: steps.length }} title={TITLES[step]}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        className="flex flex-1 flex-col"
      >
        <div className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-8 pt-8 sm:pt-12">
          {step === "child" ? <ChildDetails a={a} update={update} /> : null}
          {step === "consent" ? <InlineConsent a={a} update={update} child={child ?? "your child"} /> : null}
          {step === "about-you" ? <AboutYou a={a} update={update} /> : null}
          {step === "guardian" ? <Guardian a={a} update={update} /> : null}
          {step === "exam" ? <Exam a={a} update={update} child={child} /> : null}
          {step === "subjects" ? <Subjects child={child} /> : null}
          {step === "exam-date" ? <ExamDate a={a} update={update} child={child} /> : null}
          {step === "study-time" ? <StudyTime a={a} update={update} child={child} /> : null}
          {error ? (
            <p role="alert" className="mt-5 flex items-center gap-2 rounded-card-sm border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger-text">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
        <div className="sticky bottom-0 border-t border-border-subtle bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex h-[72px] max-w-[560px] items-center justify-between gap-3 px-4">
            <button type="button" onClick={back} className={btn("ghost", "md")}>
              <ArrowLeft aria-hidden="true" className="size-5" /> Back
            </button>
            <button type="submit" className={btn("primary", "md", "min-w-[9rem]")}>
              {step === "consent" ? "Give consent" : "Continue"} <ArrowRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </form>
    </Frame>
  );
}

function Frame({ progress, title, children }: { progress: { n: number; of: number } | null; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-[960px] items-center gap-3 px-4 sm:h-16">
          <Image src="/logo-mark.png" alt="" width={64} height={64} sizes="32px" className="size-8" />
          <p className="text-sm font-semibold text-ink">
            {progress ? (
              <>
                Step {progress.n} of {progress.of} <span className="font-normal text-muted">· {title}</span>
              </>
            ) : (
              title
            )}
          </p>
          <a href={siteUrl("/")} className="ml-auto flex h-11 items-center gap-1.5 rounded-btn px-2 text-sm font-semibold text-muted hover:text-ink">
            <X aria-hidden="true" className="size-4" /> Save &amp; exit
          </a>
        </div>
        {progress ? (
          <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={progress.of} aria-valuenow={progress.n} className="h-1 bg-sunken">
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(progress.n / progress.of) * 100}%` }} />
          </div>
        ) : null}
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

function Heading({ title, help }: { title: string; help: string }) {
  return (
    <>
      <h1 className="font-display text-[26px] leading-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{help}</p>
    </>
  );
}

function OptionCard({ selected, onSelect, title, desc, type = "radio", name }: { selected: boolean; onSelect: () => void; title: string; desc?: string; type?: "radio" | "checkbox"; name: string }) {
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-card border-2 bg-surface p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        selected ? "border-primary bg-primary/10" : "border-border-subtle hover:border-faint"
      }`}
    >
      <input type={type} name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {desc ? <span className="block text-sm text-muted">{desc}</span> : null}
      </span>
      <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-line bg-ink text-on-ink" : "border-border-subtle"}`}>
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}

const sel = "mt-1.5 h-12 w-full rounded-input border border-border-subtle bg-surface px-3 text-base text-ink focus:border-line";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DobFields({ a, update, legend }: { a: Answers; update: (p: Partial<Answers>) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-1 grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
        <div>
          <label htmlFor="dob-d" className="sr-only">Day</label>
          <select id="dob-d" value={a.day ?? ""} onChange={(e) => update({ day: e.target.value })} className={sel} autoComplete="bday-day">
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dob-m" className="sr-only">Month</label>
          <select id="dob-m" value={a.month ?? ""} onChange={(e) => update({ month: e.target.value })} className={sel} autoComplete="bday-month">
            <option value="">Month</option>
            {MONTHS_SHORT.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dob-y" className="sr-only">Year</label>
          <select id="dob-y" value={a.year ?? ""} onChange={(e) => update({ year: e.target.value })} className={sel} autoComplete="bday-year">
            <option value="">Year</option>
            {Array.from({ length: 16 }, (_, i) => 2013 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

function ClassField({ a, update, legend = "Class" }: { a: Answers; update: (p: Partial<Answers>) => void; legend?: string }) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {["Class 11", "Class 12", "Dropper", "Other"].map((c) => (
          <OptionCard key={c} name="cls" title={c} selected={a.cls === c} onSelect={() => update({ cls: c })} />
        ))}
      </div>
    </fieldset>
  );
}

function AboutYou({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  return (
    <>
      <div className="mb-6">
        <Mascot size="md" />
      </div>
      <Heading title="First, a bit about you" help="We ask your age because students under 18 need a parent or guardian's consent (DPDP Act 2023)." />
      <div className="mt-7">
        <DobFields a={a} update={update} legend="Date of birth" />
      </div>
      <ClassField a={a} update={update} />
    </>
  );
}

function Guardian({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  return (
    <>
      <Heading title="Add a parent or guardian" help="We'll send them a link to approve your account. Setup continues as soon as they approve." />
      <div className="mt-7 flex flex-col gap-4">
        <div>
          <label htmlFor="g-name" className="text-sm font-semibold text-ink">Their name</label>
          <input id="g-name" value={a.guardianName ?? ""} onChange={(e) => update({ guardianName: e.target.value })} className={sel} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="g-rel" className="text-sm font-semibold text-ink">Relationship</label>
          <select id="g-rel" value={a.relation ?? "Parent"} onChange={(e) => update({ relation: e.target.value })} className={sel}>
            <option>Parent</option>
            <option>Legal guardian</option>
          </select>
        </div>
        <div>
          <label htmlFor="g-contact" className="text-sm font-semibold text-ink">Their email or mobile number</label>
          <input
            id="g-contact"
            value={a.guardianContact ?? ""}
            onChange={(e) => update({ guardianContact: e.target.value })}
            className={sel}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="g-help"
          />
          <p id="g-help" className="mt-1.5 text-xs text-muted">We only use this to ask for consent, and to send them your progress if they want it.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" checked={!!a.confirmGuardian} onChange={(e) => update({ confirmGuardian: e.target.checked })} className="mt-0.5 size-5 accent-[var(--color-primary-deep)]" />
          This is my parent or legal guardian.
        </label>
      </div>
    </>
  );
}

/**
 * Consent pending (§8.2, D4). Listens for the guardian's decision and moves on by
 * itself; production uses a realtime subscription on the relationship row.
 */
function Waiting({ a, learnerName, onApproved }: { a: Answers; learnerName: string; onApproved: () => void }) {
  const [req, setReq] = useShared<ConsentRequest | null>(SHARED.consent, null);
  const { left, start } = useCountdown(CONSENT.resendSeconds);
  const [notice, setNotice] = useState("");
  const contact = a.guardianContact?.trim() ?? "";
  const guardianFirst = a.guardianName?.trim().split(/\s+/)[0] || "your guardian";
  const approvedRef = useRef(onApproved);

  useEffect(() => {
    approvedRef.current = onApproved;
  });

  // Create the pending request, or a fresh one after "Change contact".
  useEffect(() => {
    if (!contact) return;
    const current = readShared<ConsentRequest | null>(SHARED.consent, null);
    if (current && current.contact === contact) return;
    writeShared<ConsentRequest>(SHARED.consent, {
      token: PREVIEW_CONSENT_TOKEN,
      learnerFirstName: learnerName || "Your child",
      guardianName: a.guardianName?.trim() ?? "",
      relation: a.relation ?? "Parent",
      contact,
      status: "pending",
      sentOn: TODAY,
      sendsToday: 1,
    });
    start();
    // Runs once per contact; `start` and the names are stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  const status = req?.contact === contact ? req.status : "pending";

  useEffect(() => {
    if (status !== "verified") return;
    const t = window.setTimeout(() => approvedRef.current(), 1600);
    return () => window.clearTimeout(t);
  }, [status]);

  if (!contact) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10">
        <Heading title="Add your guardian first" help="We need their email or mobile number to ask for approval." />
        <Link href="/onboarding/guardian" className={btn("primary", "md", "mt-6")}>
          Add guardian
        </Link>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div role="status" className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10">
        <span className="flex size-12 items-center justify-center rounded-full border border-line bg-success text-white">
          <Check aria-hidden="true" className="size-6" strokeWidth={3} />
        </span>
        <div className="mt-5">
          <Heading title={`${guardianFirst} approved your account`} help="Thanks for waiting. Taking you to the next step…" />
        </div>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10">
        <Heading
          title={`${guardianFirst} didn't approve`}
          help={`We can't set up your account without a parent or guardian's consent. What you entered will be deleted within ${CONSENT.deletionBusinessDays} business days.`}
        />
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/onboarding/guardian" className={btn("secondary")}>
            Ask a different guardian
          </Link>
          <a href={siteUrl("/faq")} className={btn("ghost")}>
            Questions? Read the FAQ
          </a>
        </div>
      </div>
    );
  }

  const sends = req?.sendsToday ?? 1;
  const deadline = addDays(req?.sentOn ?? TODAY, CONSENT.pendingDays);
  const outOfSends = sends >= CONSENT.sendsPerDay;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10">
      <span className="flex size-12 items-center justify-center rounded-card-sm border border-line bg-primary/15">
        <MailCheck aria-hidden="true" className="size-6 text-ink" />
      </span>
      <div className="mt-5">
        <Heading
          title={`We've asked ${guardianFirst} to approve`}
          help={`The link went to ${maskContact(contact)}. As soon as ${guardianFirst} approves, this page moves on by itself and we email you too.`}
        />
      </div>
      <ul className="mt-6 flex flex-col gap-2.5 text-[15px] text-ink">
        <li className="flex items-center gap-2.5">
          <CircleCheck aria-hidden="true" className="size-5 text-success" />
          Account created
        </li>
        <li className="flex items-center gap-2.5">
          <Lock aria-hidden="true" className="size-5 text-muted" />
          Exam, subjects and study time unlock after approval
        </li>
        <li className="flex items-start gap-2.5">
          <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
          If there&apos;s no approval by {shortDate(deadline)}, we delete what you entered
        </li>
      </ul>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={left > 0 || outOfSends}
          onClick={() => {
            if (!req) return;
            setReq({ ...req, sendsToday: sends + 1 });
            setNotice(`Sent again to ${maskContact(contact)}.`);
            start();
          }}
          className={btn("secondary")}
        >
          {left > 0 ? `Resend in ${left}s` : "Resend link"}
        </button>
        <Link href="/onboarding/guardian" className={btn("ghost")}>
          Change contact
        </Link>
      </div>
      <p role="status" className="mt-3 text-sm text-muted">
        {notice ? `${notice} ` : ""}
        {outOfSends ? "That's the most we can send today. Try again tomorrow." : "Ask them to check spam if it hasn't arrived in a few minutes."}
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-10 rounded-card-sm border border-dashed border-faint p-4 text-sm text-muted">
          <p className="font-semibold text-ink">Preview only</p>
          <p className="mt-1">Open the guardian&apos;s link in a new tab. Giving consent there continues this page by itself.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/consent/${PREVIEW_CONSENT_TOKEN}`} target="_blank" rel="noopener" className={btn("secondary", "sm")}>
              Open guardian&apos;s link <ExternalLink aria-hidden="true" className="size-4" />
            </a>
            <button type="button" onClick={() => req && setReq({ ...req, status: "verified", decidedOn: TODAY })} className={btn("ghost", "sm")}>
              Simulate approval
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Guardian-initiated path (D5): child → consent → setup → invite ---------- */

function ChildDetails({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  const name = a.childName?.trim() || "your child";
  return (
    <>
      <Heading title="Add your child" help="You'll set up their exam and study time next. They get an invite to create their own login." />
      <div className="mt-7 flex flex-col gap-6">
        <div>
          <label htmlFor="c-name" className="text-sm font-semibold text-ink">Their first name</label>
          <input id="c-name" value={a.childName ?? ""} onChange={(e) => update({ childName: e.target.value })} className={sel} autoComplete="off" />
        </div>
        <DobFields a={a} update={update} legend={`${name === "your child" ? "Their" : `${name}'s`} date of birth`} />
      </div>
      <ClassField a={a} update={update} legend={`${name === "your child" ? "Their" : `${name}'s`} class`} />
      <div className="mt-6">
        <label htmlFor="c-email" className="text-sm font-semibold text-ink">
          {name === "your child" ? "Their" : `${name}'s`} email
        </label>
        <input
          id="c-email"
          type="email"
          inputMode="email"
          value={a.childEmail ?? ""}
          onChange={(e) => update({ childEmail: e.target.value })}
          className={sel}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="c-email-help"
        />
        <p id="c-email-help" className="mt-1.5 text-xs text-muted">Their login invite goes here. It must be different from your email.</p>
      </div>
    </>
  );
}

function InlineConsent({ a, update, child }: { a: Answers; update: (p: Partial<Answers>) => void; child: string }) {
  const lists: [string, readonly string[]][] = [
    ["What we collect", CONSENT_TERMS.collect],
    ["What we never do", CONSENT_TERMS.never],
    ["What you can do", CONSENT_TERMS.rights],
  ];
  return (
    <>
      <Heading title={`Your consent for ${child}`} help="As their parent or guardian, you give consent here. No separate email or code is needed." />
      <div className="mt-7 flex flex-col gap-5 rounded-card border border-border-subtle bg-surface p-5">
        {lists.map(([title, items]) => (
          <section key={title} aria-label={title}>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
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
        <p className="border-t border-border-subtle pt-4 text-sm text-muted">
          Read the full{" "}
          <a href={siteUrl("/guardian-consent")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">
            Guardian Consent Policy
          </a>{" "}
          and{" "}
          <a href={siteUrl("/privacy")} target="_blank" rel="noopener" className="font-semibold text-primary-text underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-card-sm border border-line bg-primary/10 p-4 text-[15px] font-medium text-ink">
        <input type="checkbox" checked={!!a.declaration} onChange={(e) => update({ declaration: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary-deep)]" />
        I am {child}&apos;s parent or legal guardian and I am 18 or older.
      </label>
      <p className="mt-3 text-sm text-muted">We record today&apos;s date and the policy version. You can withdraw consent at any time from your guardian settings.</p>
    </>
  );
}

function Exam({ a, update, child }: { a: Answers; update: (p: Partial<Answers>) => void; child: string | null }) {
  const exams = [
    ["JEE Main", "Engineering entrance · NTA pattern, +4/−1"],
    ["NEET", "Medical entrance · NMC syllabus, +4/−1"],
    ["CBSE Class 11", "Board exam · no negative marking"],
  ];
  return (
    <>
      <Heading title={child ? `Which exam is ${child} preparing for?` : "Which exam are you preparing for?"} help="We only use questions and concepts from this syllabus." />
      <fieldset className="mt-7">
        <legend className="sr-only">Exam</legend>
        <div className="flex flex-col gap-3">
          {exams.map(([t, d]) => (
            <OptionCard key={t} name="exam" title={t} desc={d} selected={a.exam === t} onSelect={() => update({ exam: t })} />
          ))}
        </div>
      </fieldset>
    </>
  );
}

function Subjects({ child }: { child: string | null }) {
  return (
    <>
      <Heading title="Which subjects should we cover?" help={child ? `${child}'s diagnostic will cover these chapters.` : "Your diagnostic will cover these chapters."} />
      <div className="mt-7 flex flex-col gap-3">
        <div className="rounded-card border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink">Physics · Class 11 Mechanics</p>
            <span className="flex size-6 items-center justify-center rounded-full bg-ink text-on-ink"><Check aria-hidden="true" className="size-3.5" strokeWidth={3} /></span>
          </div>
          <p className="mt-1 text-sm text-muted">Motion in a Straight Line · Motion in a Plane · Laws of Motion · Work, Energy and Power · Rotational Motion · Gravitation</p>
        </div>
        {["Chemistry", "Mathematics", "Biology"].map((s) => (
          <div key={s} aria-disabled="true" className="flex items-center justify-between rounded-card border border-dashed border-border-subtle p-4 opacity-70">
            <p className="font-semibold text-muted">{s}</p>
            <span className="text-xs font-semibold text-muted">Coming later</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ExamDate({ a, update, child }: { a: Answers; update: (p: Partial<Answers>) => void; child: string | null }) {
  return (
    <>
      <Heading title={child ? `When is ${child}'s exam?` : "When is your exam?"} help="The plan gets more focused as the date gets closer." />
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="em" className="text-sm font-semibold text-ink">Month</label>
          <select id="em" disabled={a.notSure} value={a.examMonth ?? ""} onChange={(e) => update({ examMonth: e.target.value })} className={sel}>
            <option value="">Month</option>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ey" className="text-sm font-semibold text-ink">Year</label>
          <select id="ey" disabled={a.notSure} value={a.examYear ?? ""} onChange={(e) => update({ examYear: e.target.value })} className={sel}>
            <option value="">Year</option>
            {[2027, 2028, 2029].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
        <input type="checkbox" checked={!!a.notSure} onChange={(e) => update({ notSure: e.target.checked })} className="size-5 accent-[var(--color-primary-deep)]" />
        Not sure yet
      </label>
    </>
  );
}

function StudyTime({ a, update, child }: { a: Answers; update: (p: Partial<Answers>) => void; child: string | null }) {
  return (
    <>
      <Heading
        title={child ? `How much time can ${child} give Learnometry each day?` : "How much time can you give Learnometry each day?"}
        help="The plan never schedules more than this. Coaching hours are separate."
      />
      <fieldset className="mt-7">
        <legend className="sr-only">Minutes per day</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DAILY_MINUTE_PRESETS.map((m) => (
            <label
              key={m}
              className={`flex h-16 cursor-pointer flex-col items-center justify-center rounded-card border-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                a.minutes === m ? "border-primary bg-primary/10" : "border-border-subtle bg-surface"
              }`}
            >
              <input type="radio" name="minutes" checked={a.minutes === m} onChange={() => update({ minutes: m })} className="sr-only" />
              <span className="font-display text-xl tabular-nums text-ink">{m}</span>
              <span className="text-xs text-muted">min</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 text-sm text-muted">{child ? `${child} can change this any time in Settings.` : "You can change this any time in Settings."}</p>
    </>
  );
}

function Ready({ a }: { a: Answers }) {
  const rows = [
    ["Exam", a.exam ?? "JEE Main"],
    ["Subject", "Physics · Class 11 Mechanics"],
    ["Exam date", a.notSure ? "Not sure yet" : `${a.examMonth ?? "January"} ${a.examYear ?? "2027"}`],
    ["Daily time", `${a.minutes ?? 60} min`],
  ];
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10 text-center sm:pt-14">
      <Mascot size="lg" className="mx-auto" />
      <h1 className="mt-6 font-display text-3xl text-ink">You&apos;re set up</h1>
      <p className="mt-2 text-[15px] text-muted">Your 100 welcome credits are ready. They cover your diagnostic and your first study plan.</p>
      <dl className="mt-7 divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface text-left">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-sm font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/assess/diagnostic" className={btn("primary", "lg", "w-full sm:w-auto")}>
          Start diagnostic <Cost credits={COST.fullDiagnostic} />
        </Link>
        <Link href="/dashboard?state=new" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          Go to home
        </Link>
      </div>
    </div>
  );
}

function InviteSent({ a }: { a: Answers }) {
  const child = a.childName?.trim() || "your child";
  const rows = [
    ["Exam", a.exam ?? "JEE Main"],
    ["Subject", "Physics · Class 11 Mechanics"],
    ["Exam date", a.notSure ? "Not sure yet" : `${a.examMonth ?? "January"} ${a.examYear ?? "2027"}`],
    ["Daily time", `${a.minutes ?? 60} min`],
  ];
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10 text-center sm:pt-14">
      <Mascot size="md" className="mx-auto" />
      <h1 className="mt-6 font-display text-3xl text-ink">Invite sent to {child}</h1>
      <p className="mt-2 text-[15px] text-muted">
        We emailed a login invite to {a.childEmail ? maskContact(a.childEmail) : "their email"}. It works until {fullDate(addDays(TODAY, CONSENT.pendingDays))}, and you can
        resend it from your guardian portal. Consent was recorded today.
      </p>
      <dl className="mt-7 divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface text-left">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-sm font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted">{child} starts with 100 welcome credits: enough for the first diagnostic and study plan.</p>
      <Link href="/guardian" className={btn("primary", "lg", "mt-8 w-full sm:w-auto")}>
        Go to your guardian portal <ArrowRight aria-hidden="true" className="size-5" />
      </Link>
    </div>
  );
}
