"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Lock, MailCheck, X } from "lucide-react";
import { COST, DAILY_MINUTE_PRESETS } from "@/lib/config";
import { Mascot } from "./feedback";
import { Cost, btn } from "./ui";
import { siteUrl } from "@/lib/site";

/*
  Onboarding — Web App Structure §8.2, decision D4: date of birth first; under 18
  nothing else is collected until a guardian consents. Answers persist in session
  storage so Back and refresh keep them (the API persists them in production).
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
};

const KEY = "lm-onboarding";
const STEPS_ADULT = ["about-you", "exam", "subjects", "exam-date", "study-time"];
const STEPS_MINOR = ["about-you", "guardian", "exam", "subjects", "exam-date", "study-time"];
const TITLES: Record<string, string> = {
  "about-you": "About you",
  guardian: "Parent or guardian",
  exam: "Your exam",
  subjects: "Subjects",
  "exam-date": "Exam date",
  "study-time": "Daily time",
};

function ageFrom(a: Answers) {
  if (!a.day || !a.month || !a.year) return null;
  const dob = new Date(Number(a.year), Number(a.month) - 1, Number(a.day));
  const now = new Date("2026-09-27");
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  return age;
}

export function Onboarding({ step }: { step: string }) {
  const router = useRouter();
  const [a, setA] = useState<Answers>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-held answers after mount
      if (raw) setA(JSON.parse(raw));
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
  const minor = age !== null && age < 18;
  const steps = minor ? STEPS_MINOR : STEPS_ADULT;
  const idx = steps.indexOf(step);
  const go = (s: string) => router.push(`/onboarding/${s}`);

  if (!loaded) return <div className="min-h-screen" />;

  if (step === "waiting") return <Frame progress={null} title="Waiting for approval"><Waiting a={a} onApproved={() => go("exam")} /></Frame>;
  if (step === "ready") return <Frame progress={null} title="All set"><Ready a={a} /></Frame>;

  const next = () => {
    if (step === "about-you") {
      if (age === null) return setError("Enter your full date of birth.");
      if (age < 13) return setError("Learnometry is for students aged 13 and over.");
      if (!a.cls) return setError("Choose your class.");
      return go(minor ? "guardian" : "exam");
    }
    if (step === "guardian") {
      if (!a.guardianName?.trim() || !a.guardianContact?.trim()) return setError("Enter your parent or guardian's name and their email or mobile number.");
      if (!a.confirmGuardian) return setError("Confirm this is your parent or legal guardian.");
      return go("waiting");
    }
    if (step === "exam" && !a.exam) return setError("Choose your exam.");
    if (step === "exam-date" && !a.notSure && (!a.examMonth || !a.examYear)) return setError("Choose a month and year, or tick “Not sure yet”.");
    if (step === "study-time" && !a.minutes) return setError("Choose how much time you have each day.");
    const n = steps[idx + 1];
    go(n ?? "ready");
  };

  const back = () => {
    if (idx <= 0) return router.push("/signup");
    if (step === "exam" && minor) return go("guardian");
    go(steps[idx - 1]);
  };

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
          {step === "about-you" ? <AboutYou a={a} update={update} /> : null}
          {step === "guardian" ? <Guardian a={a} update={update} /> : null}
          {step === "exam" ? <Exam a={a} update={update} /> : null}
          {step === "subjects" ? <Subjects /> : null}
          {step === "exam-date" ? <ExamDate a={a} update={update} /> : null}
          {step === "study-time" ? <StudyTime a={a} update={update} /> : null}
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
              Continue <ArrowRight aria-hidden="true" className="size-5" />
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
        selected ? "border-line bg-primary/10 shadow-brutal-sm" : "border-border-subtle hover:border-faint"
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

function AboutYou({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return (
    <>
      <div className="mb-6">
        <Mascot size="md" />
      </div>
      <Heading title="First, a bit about you" help="We ask your age because students under 18 need a parent or guardian's consent (DPDP Act 2023)." />
      <fieldset className="mt-7">
        <legend className="text-sm font-semibold text-ink">Date of birth</legend>
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
              {months.map((m, i) => (
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
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">Class</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {["Class 11", "Class 12", "Dropper", "Other"].map((c) => (
            <OptionCard key={c} name="cls" title={c} selected={a.cls === c} onSelect={() => update({ cls: c })} />
          ))}
        </div>
      </fieldset>
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
          <input id="g-contact" value={a.guardianContact ?? ""} onChange={(e) => update({ guardianContact: e.target.value })} className={sel} autoComplete="off" aria-describedby="g-help" />
          <p id="g-help" className="mt-1.5 text-xs text-muted">We only use this to ask for consent and send them your progress if they want it.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" checked={!!a.confirmGuardian} onChange={(e) => update({ confirmGuardian: e.target.checked })} className="mt-0.5 size-5 accent-[var(--color-primary-deep)]" />
          This is my parent or legal guardian.
        </label>
      </div>
    </>
  );
}

function Waiting({ a, onApproved }: { a: Answers; onApproved: () => void }) {
  const [sent, setSent] = useState(false);
  const contact = a.guardianContact ?? "";
  const masked = contact.includes("@") ? contact.replace(/^(.).*(@.*)$/, "$1•••$2") : contact.replace(/\d(?=\d{2})/g, "•");
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-10">
      <span className="flex size-12 items-center justify-center rounded-card-sm border-2 border-line bg-primary/15">
        <MailCheck aria-hidden="true" className="size-6 text-ink" />
      </span>
      <Heading title={`We've asked ${a.guardianName || "your guardian"} to approve`} help={`The link went to ${masked || "their contact"}. As soon as they approve, you can finish setting up. We'll email you too.`} />
      <ul className="mt-6 flex flex-col gap-2.5 text-[15px] text-ink">
        <li className="flex items-center gap-2.5"><Check aria-hidden="true" className="size-4 text-success" />Account created</li>
        <li className="flex items-center gap-2.5"><Lock aria-hidden="true" className="size-4 text-muted" />Exam, subjects and study time unlock after approval</li>
        <li className="flex items-center gap-2.5"><Lock aria-hidden="true" className="size-4 text-muted" />If there&apos;s no approval in 7 days, we delete what you entered</li>
      </ul>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={() => setSent(true)} disabled={sent} className={btn("secondary")}>
          {sent ? "Link sent again" : "Resend link"}
        </button>
        <Link href="/onboarding/guardian" className={btn("ghost")}>
          Change contact
        </Link>
      </div>
      <p className="mt-3 text-sm text-muted">Ask them to check spam if it hasn&apos;t arrived in a few minutes.</p>
      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-10 rounded-card-sm border border-dashed border-faint p-4 text-sm text-muted">
          <p className="font-semibold text-ink">Preview only</p>
          <p className="mt-1">In the product this screen continues by itself when the guardian approves.</p>
          <button type="button" onClick={onApproved} className={btn("secondary", "sm", "mt-3")}>
            Simulate guardian approval
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Exam({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  const exams = [
    ["JEE Main", "Engineering entrance · NTA pattern, +4/−1"],
    ["NEET", "Medical entrance · NMC syllabus, +4/−1"],
    ["CBSE Class 11", "Board exam · no negative marking"],
  ];
  return (
    <>
      <Heading title="Which exam are you preparing for?" help="We only use questions and concepts from this syllabus." />
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

function Subjects() {
  return (
    <>
      <Heading title="Which subjects should we cover?" help="Your diagnostic will cover these chapters." />
      <div className="mt-7 flex flex-col gap-3">
        <div className="rounded-card border-2 border-line bg-primary/10 p-4 shadow-brutal-sm">
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

function ExamDate({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  return (
    <>
      <Heading title="When is your exam?" help="Your plan gets more focused as the date gets closer." />
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

function StudyTime({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  return (
    <>
      <Heading title="How much time can you give Learnometry each day?" help="Your plan never schedules more than this. Coaching hours are separate." />
      <fieldset className="mt-7">
        <legend className="sr-only">Minutes per day</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DAILY_MINUTE_PRESETS.map((m) => (
            <label
              key={m}
              className={`flex h-16 cursor-pointer flex-col items-center justify-center rounded-card border-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                a.minutes === m ? "border-line bg-primary/10 shadow-brutal-sm" : "border-border-subtle bg-surface"
              }`}
            >
              <input type="radio" name="minutes" checked={a.minutes === m} onChange={() => update({ minutes: m })} className="sr-only" />
              <span className="font-display text-xl tabular-nums text-ink">{m}</span>
              <span className="text-xs text-muted">min</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 text-sm text-muted">You can change this any time in Settings.</p>
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
