"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { COST, DAILY_MINUTE_PRESETS, PLANS } from "@/lib/config";
import { TODAY, credits, learner } from "@/lib/data";
import { GUARDIAN_CANNOT_SEE, GUARDIAN_CAN_SEE, adultOn, addBusinessDays, isEmail, isMinor } from "@/lib/guardian";
import { fullDate } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { SHARED, useShared } from "@/lib/local-store";
import { DEFAULT_PUSH_PREFS, type PushPrefs } from "@/lib/push";
import { clearDeviceData } from "@/lib/pwa";
import { useTheme, type ThemePref } from "./theme";
import { Dialog } from "./dialog";
import { GetCreditsButton } from "./credit-gate";
import { PushSection } from "./push-settings";
import { useToast } from "./toast";
import { Cost, btn } from "./ui";

/*
  Settings — Web App Structure §8.16. One route per section:
  desktop = left sub-nav (240px) + form panel (560px); mobile = list → detail with Back.
  Forms save explicitly (Save disabled until something changed) and confirm with a
  toast (§9.3). Theme applies instantly: it's a display preference, not account data.
*/

export const SETTINGS_PAGES: { slug: string; label: string; desc: string; icon: LucideIcon }[] = [
  { slug: "profile", label: "Profile", desc: "Name, email, class", icon: UserRound },
  { slug: "study", label: "Study setup", desc: "Exam, date, daily time", icon: GraduationCap },
  { slug: "notifications", label: "Notifications", desc: "Emails and reminders", icon: Bell },
  { slug: "appearance", label: "Appearance", desc: "Light, dark or system", icon: Palette },
  { slug: "ai", label: "Explanation engine", desc: "Hints and explanations", icon: Cpu },
  { slug: "privacy", label: "Privacy & data", desc: "Guardian access, your data", icon: ShieldCheck },
  { slug: "account", label: "Account", desc: "Sign out, delete account", icon: UserCog },
];

const field = "mt-1.5 h-11 w-full rounded-input border border-border-subtle bg-surface px-3 text-ink focus:border-line aria-[invalid=true]:border-danger";
const label = "text-sm font-semibold text-ink";

/* ---------- Navigation ---------- */

/** Desktop sub-nav (≥1024). `/settings` itself shows Profile there, so Profile is current. */
export function SettingsNav() {
  const pathname = usePathname();
  const current = pathname === "/settings" ? "profile" : pathname.split("/")[2];
  return (
    <nav aria-label="Settings" className="hidden lg:block">
      <ul className="sticky top-24 flex flex-col gap-1">
        {SETTINGS_PAGES.map((p) => {
          const on = p.slug === current;
          return (
            <li key={p.slug}>
              <Link
                href={`/settings/${p.slug}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-btn border-2 px-3 text-sm font-semibold ${
                  on ? "border-line bg-surface text-ink shadow-brutal-sm" : "border-transparent text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                <p.icon aria-hidden="true" className="size-4 shrink-0" />
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile/tablet index: list screen → detail screen (§8.16). */
export function SettingsList() {
  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface">
      {SETTINGS_PAGES.map((p) => (
        <li key={p.slug}>
          <Link href={`/settings/${p.slug}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sunken">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-card-sm bg-sunken">
              <p.icon aria-hidden="true" className="size-5 text-ink" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{p.label}</span>
              <span className="block truncate text-sm text-muted">{p.desc}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The page title (top bar h1) already names the section, so the panel heading is for screen readers only. */
function Panel({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="panel-h" className="rounded-card border border-border-subtle bg-surface p-5 sm:p-6">
      <h2 id="panel-h" className="sr-only">
        {title}
      </h2>
      {desc ? <p className="mb-5 text-sm text-muted">{desc}</p> : null}
      <div>{children}</div>
    </section>
  );
}

function SaveButton({ dirty, onClick }: { dirty: boolean; onClick?: () => void }) {
  return (
    <button type={onClick ? "button" : "submit"} disabled={!dirty} onClick={onClick} className={btn("primary", "md", "mt-6")}>
      Save changes
    </button>
  );
}

/* ---------- Profile ---------- */

export function ProfileSettings() {
  const initial = { first: learner.firstName, last: learner.lastName, email: learner.email, cls: learner.className };
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  return (
    <Panel title="Profile">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.first.trim()) return setError("first");
          if (!isEmail(v.email)) return setError("email");
          setError(null);
          toast.show(v.email !== saved.email ? `Saved. We sent a link to ${v.email} to confirm the change.` : "Saved");
          setSaved(v);
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fn" className={label}>First name</label>
            <input id="fn" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} autoComplete="given-name" aria-invalid={error === "first"} aria-describedby={error === "first" ? "fn-err" : undefined} className={field} />
            {error === "first" ? <p id="fn-err" className="mt-1.5 text-sm text-danger-text">Enter your first name.</p> : null}
          </div>
          <div>
            <label htmlFor="ln" className={label}>Last name</label>
            <input id="ln" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} autoComplete="family-name" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="em" className={label}>Email</label>
            <input
              id="em"
              type="email"
              inputMode="email"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
              autoComplete="email"
              aria-invalid={error === "email"}
              aria-describedby={error === "email" ? "em-err" : "em-help"}
              className={field}
            />
            {error === "email" ? (
              <p id="em-err" className="mt-1.5 text-sm text-danger-text">Enter an email like name@example.com.</p>
            ) : (
              <p id="em-help" className="mt-1.5 text-xs text-muted">Changing it sends a confirmation link to the new address. The old one works until then.</p>
            )}
          </div>
          <div>
            <label htmlFor="cls" className={label}>Class</label>
            <select id="cls" value={v.cls} onChange={(e) => setV({ ...v, cls: e.target.value })} className={field}>
              {["Class 11", "Class 12", "Dropper", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Date of birth</p>
            <p className="mt-1.5 flex h-11 items-center gap-2 text-ink">
              <Lock aria-hidden="true" className="size-4 text-muted" />
              {fullDate(learner.dateOfBirth)}
            </p>
            <p className="mt-1 text-xs text-muted">
              It decides whether guardian consent is needed, so only{" "}
              <Link href="/help" className="font-semibold text-primary-text underline underline-offset-4">support</Link> can correct it.
            </p>
          </div>
        </div>
        <SaveButton dirty={dirty} />
      </form>
      {toast.node}
    </Panel>
  );
}

/* ---------- Study setup ---------- */

const EXAMS = ["JEE Main", "NEET", "CBSE Class 11"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CUSTOM_MINUTES = Array.from({ length: 16 }, (_, i) => 15 + i * 15); // 15–240 in 15-min steps (§1.9)

export function StudySettings() {
  const initial = {
    exam: learner.exam,
    month: MONTHS[Number(learner.examDate.slice(5, 7)) - 1],
    year: learner.examDate.slice(0, 4),
    notSure: false,
    minutes: learner.dailyMinutes,
  };
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [confirm, setConfirm] = useState<"reschedule" | "rebuild" | null>(null);
  const toast = useToast();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const custom = !(DAILY_MINUTE_PRESETS as readonly number[]).includes(v.minutes);

  const commit = (planNote: string) => {
    setSaved(v);
    setConfirm(null);
    toast.show(planNote);
  };

  return (
    <Panel title="Study setup" desc="Your plan is built from these. Rescheduling is free; a different exam needs a new plan.">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          // A different exam changes the syllabus and marking → new plan. Time or date → reschedule.
          setConfirm(v.exam !== saved.exam ? "rebuild" : "reschedule");
        }}
      >
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="exam" className={label}>Exam</label>
            <select id="exam" value={v.exam} onChange={(e) => setV({ ...v, exam: e.target.value })} className={field}>
              {EXAMS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Subjects</p>
            <p className="mt-1.5 text-[15px] text-ink">Physics · Class 11 Mechanics</p>
            <p className="text-xs text-muted">Chemistry, Maths and Biology are coming later.</p>
          </div>
          <fieldset>
            <legend className={label}>Exam date</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="em-month" className="sr-only">Month</label>
                <select id="em-month" disabled={v.notSure} value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} className={field}>
                  {MONTHS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="em-year" className="sr-only">Year</label>
                <select id="em-year" disabled={v.notSure} value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} className={field}>
                  {["2027", "2028", "2029"].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
              <input type="checkbox" checked={v.notSure} onChange={(e) => setV({ ...v, notSure: e.target.checked })} className="size-5 accent-[var(--color-primary-deep)]" />
              Not sure yet
            </label>
          </fieldset>
          <fieldset>
            <legend className={label}>Daily study time</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAILY_MINUTE_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={v.minutes === m}
                  onClick={() => setV({ ...v, minutes: m })}
                  className={`h-11 rounded-full border px-4 text-sm font-semibold tabular-nums ${
                    v.minutes === m ? "border-2 border-line bg-primary/15 text-ink shadow-brutal-sm" : "border-border-subtle text-muted hover:text-ink"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <label htmlFor="custom-min" className="mt-3 block text-sm text-muted">
              Or a custom time
            </label>
            <select id="custom-min" value={custom ? v.minutes : ""} onChange={(e) => e.target.value && setV({ ...v, minutes: Number(e.target.value) })} className={`${field} max-w-[12rem]`}>
              <option value="">Choose…</option>
              {CUSTOM_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </fieldset>
        </div>
        <SaveButton dirty={dirty} />
      </form>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Update your plan to match?"
        description={confirm === "rebuild" ? `Switching to ${v.exam} needs a new plan: different syllabus weights and marking.` : "This only reschedules your tasks, so it's free."}
      >
        {confirm === "rebuild" ? (
          <p className="text-sm text-ink">
            Your diagnosis stays. We&apos;ll build a {v.exam} plan from it for {v.minutes} minutes a day. Your current plan moves to Previous plans.
          </p>
        ) : (
          <p className="text-sm text-ink">
            We&apos;ll fit this week&apos;s tasks into {v.minutes} minutes a day, keeping prerequisites first. Your retest date doesn&apos;t move.
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => commit("Saved. Your plan wasn't changed.")} className={btn("secondary")}>
            Save without updating
          </button>
          {confirm === "rebuild" ? (
            credits.balance >= COST.studyPlan ? (
              <button type="button" onClick={() => commit("Saved. Building your new plan…")} className={btn("primary")}>
                Rebuild plan <Cost credits={COST.studyPlan} />
              </button>
            ) : (
              <GetCreditsButton cost={COST.studyPlan} balance={credits.balance} what="A new plan" />
            )
          ) : (
            <button type="button" onClick={() => commit(`Saved. Your plan now fits ${v.minutes} minutes a day.`)} className={btn("primary")}>
              Update plan
            </button>
          )}
        </div>
      </Dialog>
      {toast.node}
    </Panel>
  );
}

/* ---------- Notifications ---------- */

const EMAIL_PREFS = [
  { key: "retest", label: "Retest ready", note: "When your retest unlocks" },
  { key: "plan", label: "Plan updated", note: "After a retest or rebuild changes your plan" },
  { key: "weekly", label: "Weekly summary", note: "Sunday evening: tasks done and what's next" },
] as const;

type NotificationPrefs = { email: { retest: boolean; plan: boolean; weekly: boolean }; push: PushPrefs };

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: { retest: true, plan: true, weekly: false },
  push: DEFAULT_PUSH_PREFS,
};

export function NotificationSettings() {
  const [saved, setSaved] = useShared<NotificationPrefs>(SHARED.notificationPrefs, DEFAULT_NOTIFICATION_PREFS);
  // Edits live in `draft` until Save; `null` means "nothing changed", so the form follows the stored value.
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const v = draft ?? saved;
  const toast = useToast();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const guardian = learner.guardian;
  const minor = !!guardian && isMinor(learner.dateOfBirth);

  return (
    <Panel title="Notifications" desc="No streak nags and no guilt messages, ever.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(v);
          setDraft(null);
          toast.show("Saved");
        }}
      >
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Email</legend>
          <ul className="mt-2 divide-y divide-border-subtle">
            {EMAIL_PREFS.map((p) => (
              <li key={p.key}>
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
                  <span>
                    <span className="block text-[15px] text-ink">{p.label}</span>
                    <span className="block text-xs text-muted">{p.note}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={v.email[p.key]}
                    onChange={(e) => setDraft({ ...v, email: { ...v.email, [p.key]: e.target.checked } })}
                    className="size-5 shrink-0 accent-[var(--color-primary-deep)]"
                  />
                </label>
              </li>
            ))}
            <li className="flex min-h-14 items-center justify-between gap-4 py-2">
              <span>
                <span className="block text-[15px] text-ink">Payments and account</span>
                <span className="block text-xs text-muted">Receipts, pass reminders, security. Always sent.</span>
              </span>
              <input type="checkbox" checked disabled aria-label="Payments and account emails, always sent" className="size-5 shrink-0 accent-[var(--color-primary-deep)]" />
            </li>
          </ul>
        </fieldset>

        <PushSection prefs={v.push} onChange={(push) => setDraft({ ...v, push })} showGuardian={minor} notify={toast.show} />

        {minor && guardian ? (
          <p className="mt-5 text-sm text-muted">{guardian.guardianFirstName} gets emails about purchase requests only. Your notifications stay private.</p>
        ) : null}
        <SaveButton dirty={dirty} />
      </form>
      {toast.node}
    </Panel>
  );
}

/* ---------- Appearance ---------- */

export function AppearanceSettings() {
  const { pref, setPref } = useTheme();
  const options: { v: ThemePref; l: string; i: LucideIcon; preview: string }[] = [
    { v: "system", l: "System", i: Monitor, preview: "bg-[linear-gradient(135deg,#f1f5f9_50%,#0f172a_50%)]" },
    { v: "light", l: "Light", i: Sun, preview: "bg-[#f1f5f9]" },
    { v: "dark", l: "Dark", i: Moon, preview: "bg-[#0f172a]" },
  ];
  return (
    <Panel title="Appearance" desc="Applies right away on this device.">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid grid-cols-3 gap-3">
          {options.map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer flex-col gap-2 rounded-card-sm border-2 p-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                pref === o.v ? "border-line shadow-brutal-sm" : "border-border-subtle"
              }`}
            >
              <input type="radio" name="theme" checked={pref === o.v} onChange={() => setPref(o.v)} className="sr-only" />
              <span aria-hidden="true" className={`relative h-16 overflow-hidden rounded-[8px] border border-border-subtle ${o.preview}`}>
                <span className="absolute left-2 top-2 h-2 w-8 rounded-full bg-[#00b4d8]" />
                <span className="absolute left-2 top-6 h-1.5 w-12 rounded-full bg-[#64748b]/60" />
              </span>
              <span className="flex items-center justify-center gap-1.5 pb-1 text-sm font-semibold text-ink">
                <o.i aria-hidden="true" className="size-4" />
                {o.l}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Panel>
  );
}

/* ---------- Explanation engine (D2) ---------- */

export function AiSettings() {
  const plan = PLANS[learner.plan];
  const [saved, setSaved] = useState(learner.engine);
  const [engine, setEngine] = useState(learner.engine);
  const toast = useToast();
  const note = "Your diagnosis, study plan and retest analysis always use our most accurate setup, whatever you pick.";

  if (plan.engine !== "learner_choice") {
    return (
      <Panel title="Explanation engine" desc={note}>
        <p className="text-[15px] text-ink">
          {plan.engine === "fast_only"
            ? "On Free, hints and explanations use Fast: quick, focused answers."
            : "Chosen automatically for each question. Hard multi-step problems get Deep reasoning."}
        </p>
        {plan.engine === "fast_only" ? (
          <Link href="/billing/plans" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
            Compare plans
          </Link>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel title="Explanation engine" desc={note}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(engine);
          toast.show("Saved");
        }}
      >
        <fieldset>
          <legend className="text-sm font-semibold text-ink">For hints, explanations and step-by-step breakdowns</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { v: "fast" as const, t: "Fast", d: "Quicker answers for hints and explanations" },
              { v: "standard" as const, t: "Standard", d: "Slower, more detailed explanations" },
            ].map((o) => (
              <label key={o.v} className={`flex cursor-pointer items-start gap-3 rounded-card border-2 p-4 ${engine === o.v ? "border-line bg-primary/10" : "border-border-subtle"}`}>
                <input type="radio" name="engine" checked={engine === o.v} onChange={() => setEngine(o.v)} className="mt-1 size-4 accent-[var(--color-primary-deep)]" />
                <span>
                  <span className="block font-semibold text-ink">{o.t}</span>
                  <span className="block text-sm text-muted">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-muted">Both cost the same credits. On Plus and Pro the engine is chosen for each question, including Deep reasoning.</p>
        <SaveButton dirty={engine !== saved} />
      </form>
      {toast.node}
    </Panel>
  );
}

/* ---------- Privacy & data ---------- */

export function PrivacySettings() {
  const [exported, setExported] = useState(false);
  return (
    <Panel title="Privacy & data">
      <GuardianPrivacy />
      <div className="mt-6 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-ink">Your data</p>
        <button type="button" onClick={() => setExported(true)} disabled={exported} className={btn("secondary", "md", "mt-3")}>
          {exported ? "Requested" : "Download my data"}
        </button>
        <p role="status" className="mt-2 text-xs text-muted">
          {exported ? "We'll email a copy (JSON and a PDF summary) within 7 business days." : "We email a copy within 7 business days."}
        </p>
        <a href={siteUrl("/privacy")} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          What we collect and why
        </a>
      </div>
    </Panel>
  );
}

/** For learners with a guardian (D5): the consent record and exactly what the guardian sees. */
function GuardianPrivacy() {
  const g = learner.guardian;
  if (!g) return <p className="text-sm text-ink">You are 18 or older, so no guardian consent is needed on this account.</p>;
  const minor = isMinor(learner.dateOfBirth);
  return (
    <>
      <div className="flex items-start gap-3 rounded-card-sm border border-border-subtle bg-sunken p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-text" />
        <div className="text-sm">
          <p className="font-semibold text-ink">
            {g.guardianName} ({g.relationship.toLowerCase()}) gave consent{g.consentVerifiedAt ? ` on ${fullDate(g.consentVerifiedAt)}` : ""}
          </p>
          <p className="mt-0.5 text-muted">
            Confirmed with a one-time code to their {g.contactType === "email" ? "email" : "phone"} · {g.policyVersion}
          </p>
        </div>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-ink">What {g.guardianFirstName} can see</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {GUARDIAN_CAN_SEE.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-ink">
            <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
            {t}
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-semibold text-ink">Private to you</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {GUARDIAN_CANNOT_SEE.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-ink">
            <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-border-subtle pt-4">
        <p className="text-sm font-semibold text-ink">Remove guardian access</p>
        {minor ? (
          <p className="mt-1 text-sm text-muted">
            Available from {fullDate(adultOn(learner.dateOfBirth))}, when you turn 18. Until then {g.guardianFirstName} also approves purchases.
          </p>
        ) : (
          <button type="button" className={btn("secondary", "sm", "mt-2")}>
            Remove {g.guardianFirstName}&apos;s access
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Account ---------- */

export function AccountSettings() {
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [closed, setClosed] = useState(false);
  const toast = useToast();
  const guardian = learner.guardian;

  if (closed) {
    return (
      <Panel title="Account">
        <div role="status" className="rounded-card-sm border border-border-subtle bg-sunken p-4 text-[15px] text-ink">
          <p className="font-semibold">Your account is closed.</p>
          <p className="mt-1 text-muted">
            Everything is erased by {fullDate(addBusinessDays(TODAY, 7))}. Changed your mind? Log in within 48 hours to cancel.
            {guardian && isMinor(learner.dateOfBirth) ? ` We've let ${guardian.guardianFirstName} know.` : ""}
          </p>
        </div>
        <Link href="/login" onClick={() => void clearDeviceData()} className={btn("secondary", "md", "mt-5")}>
          Go to log in
        </Link>
      </Panel>
    );
  }

  return (
    <Panel title="Account">
      <p className="text-sm text-ink">Signed in as {learner.email}</p>
      <button type="button" onClick={() => toast.show("Signed out on your other devices.")} className={btn("secondary", "md", "mt-4")}>
        Sign out of all other devices
      </button>
      <div className="mt-8 rounded-card-sm border border-danger/35 p-4">
        <p className="font-semibold text-ink">Delete account</p>
        <p className="mt-1 text-sm text-muted">
          Closes your account now and erases your tests, reports and plan within 7 business days. Payment records are kept only as tax law requires.
        </p>
        <button type="button" onClick={() => setDel(true)} className={btn("destructive", "md", "mt-4")}>
          Delete account
        </button>
      </div>

      <Dialog open={del} onClose={() => setDel(false)} title="Delete your account?" description="Changed your mind later? Log in within 48 hours to cancel.">
        <label htmlFor="confirm" className={label}>
          Type DELETE to confirm
        </label>
        <input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setDel(false)} className={btn("secondary")}>
            Keep my account
          </button>
          <button
            type="button"
            disabled={confirm !== "DELETE"}
            onClick={() => {
              setDel(false);
              setClosed(true);
            }}
            className={btn("destructive")}
          >
            Delete account
          </button>
        </div>
      </Dialog>
      {toast.node}
    </Panel>
  );
}
