/**
 * Minors and guardians — decisions D4 and D5 (Web App Structure §1, §8.18).
 * One source for the age rules and for what a guardian can and cannot see, so the
 * learner's Settings, the guardian portal and the consent page never disagree.
 */
import { TODAY } from "./data";

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** Consent flow limits (§1 D4). */
export const CONSENT = {
  pendingDays: 7,
  reminderDays: [3, 6],
  otpLength: 6,
  otpValidMinutes: 10,
  otpAttempts: 5,
  resendSeconds: 60,
  sendsPerDay: 5,
  deletionBusinessDays: 7,
} as const;

/** Purchase approvals expire after 7 days (§8.18). */
export const APPROVAL_DAYS = 7;

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function ageOn(dateOfBirth: string, onIso = TODAY) {
  const dob = d(dateOfBirth);
  const on = d(onIso);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const birthdayPassed =
    on.getUTCMonth() > dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() >= dob.getUTCDate());
  if (!birthdayPassed) age--;
  return age;
}

export const isMinor = (dateOfBirth: string, onIso = TODAY) => ageOn(dateOfBirth, onIso) < ADULT_AGE;

/** ISO date of the 18th birthday. */
export function adultOn(dateOfBirth: string) {
  const dob = d(dateOfBirth);
  return new Date(Date.UTC(dob.getUTCFullYear() + ADULT_AGE, dob.getUTCMonth(), dob.getUTCDate())).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  return new Date(d(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** "s•••@example.com" / "••••••••10" — never show a full contact on shared screens. */
export function maskContact(contact: string) {
  if (contact.includes("@")) return contact.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");
  return contact.replace(/\d(?=\d{2})/g, "•");
}

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
export const isIndianMobile = (v: string) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""));

/** Adds business days (Mon–Fri) — deletion deadlines are stated in business days. */
export function addBusinessDays(iso: string, days: number) {
  const t = d(iso);
  let left = days;
  while (left > 0) {
    t.setUTCDate(t.getUTCDate() + 1);
    const wd = t.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return t.toISOString().slice(0, 10);
}

/** The pending consent request a learner's onboarding creates (`consent_tokens` + relationship). */
export interface ConsentRequest {
  token: string;
  learnerFirstName: string;
  guardianName: string;
  relation: string;
  contact: string;
  status: "pending" | "verified" | "declined";
  sentOn: string;
  sendsToday: number;
  decidedOn?: string;
}

/** Link used by the preview so the whole loop can be walked in one browser. */
export const PREVIEW_CONSENT_TOKEN = "preview";

/** Sign-up details held between /signup, /verify-email and onboarding. */
export const SIGNUP_KEY = "lm-signup";
export interface SignupDraft {
  role: "student" | "guardian";
  name: string;
  email: string;
}

/** D5: what a guardian with an account can and cannot see, per learner. */
export const GUARDIAN_CAN_SEE = [
  "Latest diagnostic score and date",
  "Weakest topics, by name and severity",
  "This week's plan: how many tasks are done",
  "Next retest date and retest outcomes",
  "Purchases, and requests waiting for approval",
];

export const GUARDIAN_CANNOT_SEE = [
  "Test questions and answers",
  "Notifications and settings",
  "Hints, explanations and anything typed",
];

/** What the guardian agrees to on the consent page, in plain language (§8.18 step 3). */
export const CONSENT_TERMS = {
  collect: [
    "Name, email, date of birth and class",
    "Test answers, scores and the study plan built from them",
    "How much time is spent on each task",
  ],
  never: ["No advertising and no selling of data", "Nothing is ever shared publicly", "No contact with other students"],
  rights: [
    "See their progress with a free guardian account",
    "Approve and pay for every purchase",
    "Withdraw consent or delete their data at any time",
  ],
};
