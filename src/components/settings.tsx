"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { DAILY_MINUTE_PRESETS } from "@/lib/config";
import { learner } from "@/lib/data";
import { useTheme, type ThemePref } from "./theme";
import { Dialog } from "./dialog";
import { btn } from "./ui";

const field = "mt-1.5 h-11 w-full rounded-input border border-border-subtle bg-surface px-3 text-ink focus:border-line";

function Section({ id, title, children, desc }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-card border border-border-subtle bg-surface p-5 sm:p-6">
      <h2 id={`${id}-h`} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {desc ? <p className="mt-1 text-sm text-muted">{desc}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Settings — Web App Structure §8.16, one page with anchored sections. */
export function Settings() {
  const { pref, setPref } = useTheme();
  const [minutes, setMinutes] = useState(learner.dailyMinutes);
  const [engine, setEngine] = useState(learner.engine);
  const [saved, setSaved] = useState(false);
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");

  const nav = [
    ["profile", "Profile"],
    ["study", "Study setup"],
    ["ai", "Explanation engine"],
    ["appearance", "Appearance"],
    ["notifications", "Notifications"],
    ["privacy", "Privacy & data"],
    ["account", "Account"],
  ];
  const themes: { v: ThemePref; l: string; i: LucideIcon }[] = [
    { v: "system", l: "System", i: Monitor },
    { v: "light", l: "Light", i: Sun },
    { v: "dark", l: "Dark", i: Moon },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-24 flex flex-col gap-1">
          {nav.map(([id, l]) => (
            <li key={id}>
              <a href={`#${id}`} className="flex min-h-10 items-center rounded-btn px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
                {l}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex max-w-[640px] flex-col gap-5">
        <Section id="profile" title="Profile">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fn" className="text-sm font-semibold text-ink">First name</label>
              <input id="fn" defaultValue={learner.firstName} autoComplete="given-name" className={field} />
            </div>
            <div>
              <label htmlFor="ln" className="text-sm font-semibold text-ink">Last name</label>
              <input id="ln" defaultValue={learner.lastName} autoComplete="family-name" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="em" className="text-sm font-semibold text-ink">Email</label>
              <input id="em" type="email" defaultValue={learner.email} autoComplete="email" className={field} aria-describedby="em-help" />
              <p id="em-help" className="mt-1.5 text-xs text-muted">Changing it sends a verification link to the new address.</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-ink">Date of birth</p>
              <p className="mt-1 text-sm text-muted">Set at sign-up. Contact support to correct it; it decides whether guardian consent is needed.</p>
            </div>
          </div>
        </Section>

        <Section id="study" title="Study setup" desc="Changing these may reschedule your plan. Rescheduling is free.">
          <p className="text-sm text-ink">
            {learner.exam} · {learner.subject} · {learner.unit} · Exam in January 2027
          </p>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Daily study time</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAILY_MINUTE_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={`h-11 rounded-full border px-4 text-sm font-semibold tabular-nums ${minutes === m ? "border-2 border-line bg-primary/15 text-ink shadow-brutal-sm" : "border-border-subtle text-muted hover:text-ink"}`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" disabled={minutes === learner.dailyMinutes && !saved} onClick={() => setSaved(true)} className={btn("primary", "md", "mt-5")}>
            Save
          </button>
          {saved ? <p role="status" className="mt-2 text-sm text-success-text">Saved. Your plan now fits {minutes} minutes a day.</p> : null}
        </Section>

        <Section id="ai" title="Explanation engine" desc="Your diagnosis and study plan always use our most accurate setup, whatever you pick.">
          <fieldset>
            <legend className="sr-only">Engine for explanations and hints</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <p className="mt-3 text-xs text-muted">On Plus and Pro the engine is chosen automatically for each question, including Deep reasoning.</p>
        </Section>

        <Section id="appearance" title="Appearance">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Theme</legend>
            <div className="mt-2 grid max-w-sm grid-cols-3 gap-1 rounded-full border border-border-subtle bg-sunken p-1">
              {themes.map((t) => (
                <button key={t.v} type="button" aria-pressed={pref === t.v} onClick={() => setPref(t.v)} className={`flex h-10 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-semibold ${pref === t.v ? "border-line bg-surface text-ink shadow-brutal-sm" : "border-transparent text-muted hover:text-ink"}`}>
                  <t.i aria-hidden="true" className="size-4" />
                  {t.l}
                </button>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section id="notifications" title="Notifications">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {[
              ["Retest ready", true, false],
              ["Plan updated", true, false],
              ["Weekly summary", false, false],
              ["Payment receipts", true, true],
            ].map(([label, on, locked]) => (
              <li key={label as string} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[15px] text-ink">
                  {label as string}
                  {locked ? <span className="block text-xs text-muted">Always sent</span> : null}
                </span>
                <input type="checkbox" defaultChecked={on as boolean} disabled={locked as boolean} aria-label={`Email me: ${label}`} className="size-5 accent-[var(--color-primary-deep)]" />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Push reminders work once you install Learnometry to your home screen.</p>
        </Section>

        <Section id="privacy" title="Privacy & data">
          <p className="text-sm text-ink">You are 18 or older, so no guardian consent is needed on this account.</p>
          <button type="button" className={btn("secondary", "md", "mt-4")}>
            Download my data
          </button>
          <p className="mt-2 text-xs text-muted">We email a copy within 7 business days.</p>
        </Section>

        <Section id="account" title="Account">
          <button type="button" className={btn("secondary", "md")}>
            Sign out of all devices
          </button>
          <div className="mt-6 rounded-card-sm border border-danger/35 p-4">
            <p className="font-semibold text-ink">Delete account</p>
            <p className="mt-1 text-sm text-muted">
              Your account closes now and is erased within 7 business days. Payment records are kept only as tax law requires.
            </p>
            <button type="button" onClick={() => setDel(true)} className={btn("destructive", "md", "mt-4")}>
              Delete account
            </button>
          </div>
        </Section>
      </div>

      <Dialog open={del} onClose={() => setDel(false)} title="Delete your account?" description="Changed your mind? Log in within 48 hours to cancel.">
        <label htmlFor="confirm" className="text-sm font-semibold text-ink">
          Type DELETE to confirm
        </label>
        <input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} autoComplete="off" />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setDel(false)} className={btn("secondary")}>
            Keep my account
          </button>
          <button type="button" disabled={confirm !== "DELETE"} className={btn("destructive")}>
            Delete account
          </button>
        </div>
      </Dialog>
    </div>
  );
}
