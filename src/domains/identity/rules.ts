/**
 * Identity and onboarding rules — Web App Structure §8.1–8.2, decisions D4/D5, BE-D26, BE-D50,
 * BE-D58, K1. Pure: no I/O, no clock (callers pass IST dates and instants).
 */
import { ADULT_AGE, MIN_AGE, ageOn } from "@/domains/guardian/rules";
import { addBusinessDays } from "@/lib/time";

export type ExamCode = "jee_main" | "neet" | "cbse_11";
export type ClassLevel = "class_11" | "class_12" | "dropper" | "other";

export const EXAM_CODE_BY_LABEL: Record<string, ExamCode> = {
  "JEE Main": "jee_main",
  NEET: "neet",
  "CBSE Class 11": "cbse_11",
};
export const EXAM_LABEL_BY_CODE: Record<ExamCode, string> = { jee_main: "JEE Main", neet: "NEET", cbse_11: "CBSE Class 11" };

export const CLASS_LEVEL_BY_LABEL: Record<string, ClassLevel> = {
  "Class 11": "class_11",
  "Class 12": "class_12",
  Dropper: "dropper",
  Other: "other",
};
export const CLASS_LABEL_BY_LEVEL: Record<ClassLevel, string> = { class_11: "Class 11", class_12: "Class 12", dropper: "Dropper", other: "Other" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The learner-path steps (guardian-initiated steps arrive with BE-11). */
export const LEARNER_STEPS = ["about-you", "exam", "exam-date", "study-time"] as const;
export type LearnerStep = (typeof LEARNER_STEPS)[number];

/** Steps only reachable once minors can sign up (BE-D50, flag `minor_signup`). */
export const MINOR_ONLY_STEPS = ["guardian", "waiting", "child", "consent", "invite-sent"] as const;

/** ISO date from picker parts; null for a missing or impossible date (31 Feb is not rolled over). */
export function dobFromParts(parts: { day?: string | number; month?: string | number; year?: string | number }): string | null {
  const { day, month, year } = parts;
  if (!day || !month || !year) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export type AgeBand = "too_young" | "minor" | "adult";

export function ageBand(age: number): AgeBand {
  if (age < MIN_AGE) return "too_young";
  return age < ADULT_AGE ? "minor" : "adult";
}

export const ageOfDob = (dob: string, todayIst: string) => ageOn(dob, todayIst);

/** A date of birth in the future or before 1900 is never valid input. */
export const plausibleDob = (dob: string, todayIst: string) => dob <= todayIst && dob >= "1900-01-01";

/** The step after `current`, or "ready" after the last one. */
export function nextLearnerStep(current: LearnerStep): LearnerStep | "ready" {
  const i = LEARNER_STEPS.indexOf(current);
  return LEARNER_STEPS[i + 1] ?? "ready";
}

/** Where a learner who left mid-way resumes: the step after the last one saved. */
export function resumeStep(saved: string | null | undefined, completed: boolean): LearnerStep | "ready" {
  if (completed) return "ready";
  if (!saved) return "about-you";
  const i = LEARNER_STEPS.indexOf(saved as LearnerStep);
  return i < 0 ? "about-you" : (LEARNER_STEPS[i + 1] ?? "ready");
}

/**
 * The exam date is chosen by month and year, so it is stored as the FIRST of that month:
 * a plan built to an early date never runs past the real exam (BE-D73).
 */
export function targetDateFrom(monthName: string, year: string | number): string | null {
  const m = MONTHS.indexOf(monthName);
  const y = Number(year);
  if (m < 0 || !Number.isInteger(y) || y < 2000 || y > 2100) return null;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function monthYearOf(targetDate: string | null): { month: string; year: string } | null {
  if (!targetDate) return null;
  const [y, m] = targetDate.split("-").map(Number);
  return { month: MONTHS[m - 1], year: String(y) };
}

export const firstNameOf = (displayName: string | null | undefined, email?: string | null) =>
  displayName?.trim().split(/\s+/)[0] || email?.split("@")[0] || "there";

export function initialsOf(displayName: string | null | undefined, email?: string | null): string {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (email?.[0] ?? "?").toUpperCase();
}

/** "Ada Lovelace" → { first: "Ada", last: "Lovelace" }; the profile form edits both. */
export function splitName(displayName: string | null | undefined): { first: string; last: string } {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** Only same-origin absolute paths are followed after sign-in (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

/* ---------- Account deletion (BE-D58) ---------- */

export const DELETION_CANCEL_HOURS = 48;
export const DELETION_BUSINESS_DAYS = 7;

export function deletionSchedule(now: Date) {
  return {
    cancellableUntil: new Date(now.getTime() + DELETION_CANCEL_HOURS * 3_600_000),
    eraseAt: addBusinessDays(now, DELETION_BUSINESS_DAYS),
  };
}

/** Signing in within 48 h of a deletion request cancels it; later, the account is gone. */
export function deletionOutcomeAtSignIn(status: string, deactivatedAt: Date | null, now: Date): "none" | "cancel" | "blocked" {
  if (status !== "deletion_pending") return "none";
  if (!deactivatedAt) return "cancel";
  return now.getTime() - deactivatedAt.getTime() <= DELETION_CANCEL_HOURS * 3_600_000 ? "cancel" : "blocked";
}

/* ---------- Admin gate (K1, BE-D26) ---------- */

export const ADMIN_TOTP_MAX_AGE_HOURS = 12;

export interface AdminSession {
  role: string;
  status: string;
  aal: string | null | undefined;
  /** Unix seconds of the last TOTP verification in this session (JWT `amr`). */
  totpVerifiedAt: number | null;
}

/** Console pages exist only for an active admin whose session is at AAL2 with a TOTP check ≤ 12 h old. */
export function adminAccess(s: AdminSession, nowSeconds: number): "granted" | "needs_2fa" | "denied" {
  if (s.role !== "admin" || s.status !== "active") return "denied";
  if (s.aal !== "aal2" || s.totpVerifiedAt === null) return "needs_2fa";
  return nowSeconds - s.totpVerifiedAt <= ADMIN_TOTP_MAX_AGE_HOURS * 3600 ? "granted" : "needs_2fa";
}

/** Latest `totp` entry in a JWT `amr` claim. */
export function totpVerifiedAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    if (entry && typeof entry === "object" && (entry as { method?: unknown }).method === "totp") {
      const ts = Number((entry as { timestamp?: unknown }).timestamp);
      if (Number.isFinite(ts) && (latest === null || ts > latest)) latest = ts;
    }
  }
  return latest;
}

/* ---------- Unverified sign-ups (BE-D50, TRD §13) ---------- */

export const UNVERIFIED_ACCOUNT_DAYS = 7;

/** The instant before which a never-verified sign-up (or an unconsented minor) is deleted. */
export const unverifiedCutoff = (now: Date) => new Date(now.getTime() - UNVERIFIED_ACCOUNT_DAYS * 86_400_000);

/* ---------- Onboarding routing ---------- */

export interface OnboardingRouteState {
  held: boolean;
  completed: boolean;
  /** The step a learner resumes at (`resumeStep`). */
  resume: LearnerStep | "ready";
}

/**
 * Where a request for `/onboarding/<step>` should go instead, or null to render it. A learner
 * can revisit earlier steps but not skip ahead; a minor on hold sees only the hold screen; the
 * guardian-path steps are closed until BE-11 (BE-D50).
 */
export function onboardingRedirect(step: string, state: OnboardingRouteState): string | null {
  const to = (s: string) => `/onboarding/${s}`;
  if (state.held) return step === "minor-hold" ? null : to("minor-hold");
  if (step === "minor-hold") return state.completed ? "/dashboard" : to(state.resume);
  if (step === "ready") return state.completed ? null : to(state.resume);
  if ((MINOR_ONLY_STEPS as readonly string[]).includes(step)) return state.completed ? "/dashboard" : to(state.resume);
  if (state.completed) return "/dashboard";
  const requested = LEARNER_STEPS.indexOf(step as LearnerStep);
  const allowed = state.resume === "ready" ? LEARNER_STEPS.length - 1 : LEARNER_STEPS.indexOf(state.resume);
  return requested > allowed ? to(state.resume) : null;
}
