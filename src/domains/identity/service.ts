import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { grantFreeMonthlyCredits, grantWelcomeCredits } from "@/domains/credits/service";
import { ADULT_AGE, ageOn } from "@/domains/guardian/rules";
import { asUser } from "@/lib/db/client";
import { system } from "@/lib/db/system";
import * as s from "@/lib/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/observability/log";
import { istDate, now, startOfIstMonth } from "@/lib/time";
import {
  CLASS_LEVEL_BY_LABEL,
  EXAM_CODE_BY_LABEL,
  EXAM_LABEL_BY_CODE,
  LEARNER_STEPS,
  ageBand,
  deletionOutcomeAtSignIn,
  deletionSchedule,
  dobFromParts,
  monthYearOf,
  nextLearnerStep,
  plausibleDob,
  resumeStep,
  targetDateFrom,
  unverifiedCutoff,
  type ExamCode,
  type LearnerStep,
} from "./rules";
import type { OnboardingInput } from "./schemas";
import type { OnboardingAnswers, OnboardingResult } from "./types";

export type { OnboardingAnswers, OnboardingNext, OnboardingResult } from "./types";

/*
  Identity use-cases that touch the database (BE-2). Anything server-authoritative — date of
  birth, onboarding progress, activation, the welcome grant, account status — is written with
  `system`, one transaction per use-case; a person's own preferences go through `asUser` so
  RLS and the column grants apply too. Supabase Auth calls live in ./auth.ts.
*/

const UNIT = "Class 11 Mechanics";

const fail = (fields: Record<string, string>): never => {
  throw new AppError("validation_failed", { fields, message: Object.values(fields)[0] });
};

async function loadLearner(tx: Parameters<Parameters<typeof system>[0]>[0], userId: string, lock = false) {
  const q = tx
    .select({ user: s.users, learner: s.learners })
    .from(s.users)
    .innerJoin(s.learners, eq(s.learners.userId, s.users.id))
    .where(eq(s.users.id, userId));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new AppError("forbidden");
  return row;
}

/** What the onboarding screens prefill and where they resume. */
export async function getOnboarding(userId: string): Promise<OnboardingAnswers> {
  return system(async (tx) => {
    const { user, learner } = await loadLearner(tx, userId);
    const held = user.status === "consent_pending";
    const [exam] = learner.examId ? await tx.select({ code: s.exams.code }).from(s.exams).where(eq(s.exams.id, learner.examId)) : [];
    const [y, m, d] = (user.dateOfBirth ?? "").split("-");
    const my = monthYearOf(learner.targetDate);
    return {
      step: held ? "minor-hold" : resumeStep(learner.onboardingStep, learner.onboardingCompleted),
      completed: learner.onboardingCompleted,
      held,
      dob: user.dateOfBirth ? { day: String(Number(d)), month: String(Number(m)), year: y } : null,
      classLabel: learner.classLevel ? { class_11: "Class 11", class_12: "Class 12", dropper: "Dropper", other: "Other" }[learner.classLevel] : null,
      exam: exam ? EXAM_LABEL_BY_CODE[exam.code as ExamCode] : null,
      examMonth: my?.month ?? null,
      examYear: my?.year ?? null,
      notSure: Boolean(learner.onboardingStep && LEARNER_STEPS.indexOf(learner.onboardingStep as LearnerStep) >= 2 && !learner.targetDate),
      minutes: learner.onboardingStep === "study-time" || learner.onboardingCompleted ? learner.availableStudyMinutesPerDay : null,
    };
  });
}

/**
 * Save one onboarding step (API.md `saveOnboardingStep`). The last step completes onboarding
 * and, for an adult, activates the learner and grants the welcome credits (BE-D36) — all in
 * one transaction. Under-13s are refused and nothing is stored; under-18s stop after their
 * date of birth until guardian consent exists (BE-D50).
 */
export async function saveOnboardingStep(userId: string, input: OnboardingInput, at: Date = now()): Promise<OnboardingResult> {
  const today = istDate(at);
  return system(async (tx) => {
    const { user, learner } = await loadLearner(tx, userId, true);
    if (user.role !== "learner") throw new AppError("forbidden");
    if (user.status !== "active" && user.status !== "consent_pending") throw new AppError("forbidden");

    // A minor on hold gets no further steps until BE-11 opens guardian consent.
    if (user.status === "consent_pending" && input.step !== "about-you") return { next: "minor-hold", welcomeCredits: 0 };

    switch (input.step) {
      case "about-you": {
        const dob = dobFromParts(input.dob);
        if (!dob || !plausibleDob(dob, today)) return fail({ dob: "Enter your full date of birth." });
        if (user.dateOfBirth && user.dateOfBirth !== dob && learner.onboardingCompleted) {
          return fail({ dob: "Your date of birth is already saved. To correct it, contact support." });
        }
        const age = ageOn(dob, today);
        const band = ageBand(age);
        if (band === "too_young") return fail({ dob: "Learnometry is for students aged 13 and over." });
        if (band === "minor") {
          // Store only the date of birth (BE-D50): no class, exam or anything else.
          await tx.update(s.users).set({ dateOfBirth: dob, status: "consent_pending" }).where(eq(s.users.id, userId));
          await tx.update(s.learners).set({ onboardingStep: null, classLevel: null }).where(eq(s.learners.id, learner.id));
          return { next: "minor-hold", welcomeCredits: 0 };
        }
        const classLevel = input.classLevel ? CLASS_LEVEL_BY_LABEL[input.classLevel] : null;
        if (!classLevel) return fail({ cls: "Choose your class." });
        await tx.update(s.users).set({ dateOfBirth: dob, status: "active" }).where(eq(s.users.id, userId));
        await tx.update(s.learners).set({ classLevel, onboardingStep: "about-you" }).where(eq(s.learners.id, learner.id));
        return { next: nextLearnerStep("about-you"), welcomeCredits: 0 };
      }

      case "exam": {
        if (!user.dateOfBirth) return fail({ exam: "Tell us your date of birth first." });
        const code = EXAM_CODE_BY_LABEL[input.exam];
        const [exam] = await tx.select().from(s.exams).where(and(eq(s.exams.code, code), eq(s.exams.active, true)));
        if (!exam) return fail({ exam: "That exam isn't available yet." });
        const [subject] = await tx.select().from(s.subjects).where(and(eq(s.subjects.examId, exam.id), eq(s.subjects.active, true))).orderBy(asc(s.subjects.orderIndex)).limit(1);
        await tx.update(s.learners).set({ examId: exam.id, subjectId: subject?.id ?? null, unit: UNIT, onboardingStep: "exam" }).where(eq(s.learners.id, learner.id));
        return { next: nextLearnerStep("exam"), welcomeCredits: 0 };
      }

      case "exam-date": {
        let target: string | null = null;
        if (!input.notSure) {
          target = input.month && input.year ? targetDateFrom(input.month, input.year) : null;
          if (!target) return fail({ examDate: "Choose a month and year, or tick “Not sure yet”." });
          if (target < istDate(startOfIstMonth(at))) return fail({ examDate: "Choose a month that hasn't passed yet." });
        }
        await tx.update(s.learners).set({ targetDate: target, onboardingStep: "exam-date" }).where(eq(s.learners.id, learner.id));
        return { next: nextLearnerStep("exam-date"), welcomeCredits: 0 };
      }

      case "study-time": {
        if (!user.dateOfBirth || !learner.classLevel) return fail({ minutes: "Finish the earlier steps first." });
        if (!learner.examId) return fail({ minutes: "Choose your exam first." });
        const adult = ageOn(user.dateOfBirth, today) >= ADULT_AGE;
        if (!adult) return { next: "minor-hold", welcomeCredits: 0 };

        const firstCompletion = !learner.onboardingCompleted;
        await tx
          .update(s.learners)
          .set({
            availableStudyMinutesPerDay: input.minutes,
            onboardingStep: "study-time",
            onboardingCompleted: true,
            ...(firstCompletion || !learner.activatedAt ? { activatedAt: at } : {}),
          })
          .where(eq(s.learners.id, learner.id));

        // Eligible: verified email (sign-in requires it), onboarded, adult (BE-D36). Idempotent by grant key.
        const grant = await grantWelcomeCredits(tx, learner.id, at);
        // A sign-up mid-month also gets the current month's 30 (BE-D36).
        await grantFreeMonthlyCredits(tx, learner.id, at);
        await tx.insert(s.productEvents).values({ name: "onboarding.completed", userId, learnerId: learner.id, isMinor: false, properties: { welcomeGranted: grant.granted } });
        return { next: "ready", welcomeCredits: grant.granted ? (await welcomeAmount(tx)) : 0 };
      }
    }
  });
}

async function welcomeAmount(tx: Parameters<Parameters<typeof system>[0]>[0]): Promise<number> {
  const [free] = await tx.select({ n: s.plans.welcomeCredits }).from(s.plans).where(eq(s.plans.code, "free"));
  return free?.n ?? 0;
}

/** Where to send someone right after they authenticate. */
export async function landingPathFor(userId: string): Promise<string> {
  return system(async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId));
    if (!user) return "/login";
    if (user.role === "admin") return "/security/2fa";
    if (user.role === "guardian") return "/guardian";
    const [learner] = await tx.select().from(s.learners).where(eq(s.learners.userId, userId));
    if (user.status === "consent_pending") return "/onboarding/minor-hold";
    if (!learner?.onboardingCompleted) return `/onboarding/${resumeStep(learner?.onboardingStep, false)}`;
    return "/dashboard";
  });
}

/* ---------- Settings: a person's own preferences, through RLS ---------- */

export async function updateProfile(userId: string, input: { firstName: string; lastName: string; classLabel?: string }) {
  const displayName = `${input.firstName} ${input.lastName}`.trim();
  const classLevel = input.classLabel ? CLASS_LEVEL_BY_LABEL[input.classLabel] : undefined;
  await asUser({ sub: userId }, async (tx) => {
    const res = await tx.update(s.users).set({ displayName }).where(eq(s.users.id, userId)).returning({ id: s.users.id });
    if (res.length === 0) throw new AppError("not_found");
    if (classLevel) await tx.update(s.learners).set({ classLevel }).where(eq(s.learners.userId, userId));
  });
  return { displayName };
}

export interface StudySettingsResult {
  /** No plan exists before BE-8, so a change never needs a reschedule or rebuild yet. */
  planAction: "none" | "rescheduled" | "rebuild_required";
}

export async function updateStudySettings(userId: string, input: { minutes: number; notSure: boolean; month?: string; year?: number; exam?: string }, at: Date = now()): Promise<StudySettingsResult> {
  let target: string | null = null;
  if (!input.notSure) {
    target = input.month && input.year ? targetDateFrom(input.month, input.year) : null;
    if (!target) return fail({ examDate: "Choose a month and year, or tick “Not sure yet”." });
    if (target < istDate(startOfIstMonth(at))) return fail({ examDate: "Choose a month that hasn't passed yet." });
  }
  const code = input.exam ? EXAM_CODE_BY_LABEL[input.exam] : null;

  return system(async (tx) => {
    const { learner } = await loadLearner(tx, userId, true);
    const [plan] = await tx.select({ id: s.studyPlans.id }).from(s.studyPlans).where(and(eq(s.studyPlans.learnerId, learner.id), eq(s.studyPlans.status, "active"))).limit(1);
    let examPatch: Partial<typeof s.learners.$inferInsert> = {};
    let planAction: StudySettingsResult["planAction"] = "none";

    if (code) {
      const [current] = learner.examId ? await tx.select({ code: s.exams.code }).from(s.exams).where(eq(s.exams.id, learner.examId)) : [];
      if (!current || current.code !== code) {
        // A different exam needs a new plan (J8): with a plan that is a paid rebuild (BE-8); without one it is free.
        if (plan) throw new AppError("conflict", { message: "Changing your exam rebuilds your plan. That arrives with plans." });
        const [exam] = await tx.select().from(s.exams).where(and(eq(s.exams.code, code), eq(s.exams.active, true)));
        if (!exam) return fail({ exam: "That exam isn't available yet." });
        const [subject] = await tx.select().from(s.subjects).where(eq(s.subjects.examId, exam.id)).orderBy(asc(s.subjects.orderIndex)).limit(1);
        examPatch = { examId: exam.id, subjectId: subject?.id ?? null };
      }
    }
    if (plan && (learner.availableStudyMinutesPerDay !== input.minutes || learner.targetDate !== target)) planAction = "rescheduled";
    await tx.update(s.learners).set({ availableStudyMinutesPerDay: input.minutes, targetDate: target, ...examPatch }).where(eq(s.learners.id, learner.id));
    return { planAction };
  });
}

export async function updateAppearance(userId: string, theme: "system" | "light" | "dark") {
  const rows = await asUser({ sub: userId }, (tx) => tx.update(s.learners).set({ theme }).where(eq(s.learners.userId, userId)).returning({ id: s.learners.id }));
  if (rows.length === 0) throw new AppError("not_found");
}

export async function updateEngine(userId: string, engine: "fast" | "standard", plan: string) {
  if (plan !== "starter") throw new AppError("forbidden", { message: "The engine is chosen automatically on your plan." });
  const rows = await asUser({ sub: userId }, (tx) => tx.update(s.learners).set({ enginePreference: engine }).where(eq(s.learners.userId, userId)).returning({ id: s.learners.id }));
  if (rows.length === 0) throw new AppError("not_found");
}

/* ---------- Account deletion (BE-D58) ---------- */

export interface DeletionRequest {
  eraseBy: Date;
  cancellableUntil: Date;
}

/** Deactivate now, schedule the erase, remember the request. Signing out everywhere is the caller's next step. */
export async function requestAccountDeletion(userId: string, at: Date = now()): Promise<DeletionRequest> {
  const schedule = deletionSchedule(at);
  await system(async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    if (!user || user.role === "admin") throw new AppError("forbidden");
    if (user.status === "deletion_pending") return;
    await tx.update(s.users).set({ status: "deletion_pending", deactivatedAt: at }).where(eq(s.users.id, userId));
    await tx.insert(s.dataRequests).values({ userId, requestType: "erasure", status: "requested", dueBy: schedule.eraseAt });
    await tx.insert(s.auditLogs).values({ actorUserId: userId, actorRole: user.role, action: "account.deletion_requested", resourceType: "user", resourceId: userId, metadata: { eraseBy: schedule.eraseAt.toISOString() } });
  });
  return { eraseBy: schedule.eraseAt, cancellableUntil: schedule.cancellableUntil };
}

export type SignInDeletionOutcome = "none" | "cancelled" | "blocked";

/** Called after a successful password check: cancel a pending deletion inside the 48 h window, or refuse. */
export async function resolveDeletionAtSignIn(userId: string, at: Date = now()): Promise<SignInDeletionOutcome> {
  return system(async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    if (!user) return "none";
    const outcome = deletionOutcomeAtSignIn(user.status, user.deactivatedAt, at);
    if (outcome === "none") return "none";
    if (outcome === "blocked") return "blocked";
    await tx.update(s.users).set({ status: user.dateOfBirth && ageOn(user.dateOfBirth, istDate(at)) < ADULT_AGE ? "consent_pending" : "active", deactivatedAt: null }).where(eq(s.users.id, userId));
    await tx.update(s.dataRequests).set({ status: "cancelled" }).where(and(eq(s.dataRequests.userId, userId), eq(s.dataRequests.requestType, "erasure"), eq(s.dataRequests.status, "requested")));
    await tx.insert(s.auditLogs).values({ actorUserId: userId, actorRole: user.role, action: "account.deletion_cancelled", resourceType: "user", resourceId: userId });
    return "cancelled";
  });
}

export type EraseOutcome = "erased" | "not_due" | "not_pending";

/**
 * Erase an account whose deletion was requested (job `account.erase`). Deletes the auth user,
 * which cascades through every learner table; payments stay, minimised to invoice fields and
 * unlinked from the person; AI logs are anonymised by the same cascade (BE-D58). Safe to call
 * twice: a missing or reactivated account is a no-op.
 */
export async function eraseAccount(userId: string, at: Date = now()): Promise<EraseOutcome> {
  return system(async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    if (!user || user.status !== "deletion_pending") return "not_pending";
    const [request] = await tx
      .select()
      .from(s.dataRequests)
      .where(and(eq(s.dataRequests.userId, userId), eq(s.dataRequests.requestType, "erasure"), eq(s.dataRequests.status, "requested")));
    if (request && request.dueBy.getTime() > at.getTime()) return "not_due";

    await tx.execute(sql`select set_config('app.allow_ledger_delete', 'on', true)`);
    // Payments survive with only what an invoice needs.
    await tx.execute(sql`
      update public.payments set metadata = jsonb_build_object('erased', true)
      where learner_id in (select id from public.learners where user_id = ${userId}) or payer_user_id = ${userId}`);
    await tx.execute(sql`delete from auth.users where id = ${userId}`);
    await tx.insert(s.auditLogs).values({ action: "account.erased", resourceType: "user", resourceId: userId, metadata: { requestedAt: request?.createdAt?.toISOString() ?? null } });
    return "erased";
  });
}

/** Accounts past their erase date (the daily safety net if an event was lost). */
export async function accountsDueForErasure(at: Date = now()): Promise<string[]> {
  return system(async (tx) => {
    const rows = await tx
      .select({ userId: s.dataRequests.userId })
      .from(s.dataRequests)
      .innerJoin(s.users, and(eq(s.users.id, s.dataRequests.userId), eq(s.users.status, "deletion_pending")))
      .where(and(eq(s.dataRequests.requestType, "erasure"), eq(s.dataRequests.status, "requested"), lte(s.dataRequests.dueBy, at)));
    return rows.map((r) => r.userId);
  });
}

/**
 * Delete sign-ups that never verified their email, and minors held without a verified guardian,
 * after seven days (BE-D50, TRD §13). Returns how many were removed.
 */
export async function cleanupUnverifiedAccounts(at: Date = now()): Promise<number> {
  // Raw SQL does not map Date parameters; pass an ISO string and cast.
  const cutoff = unverifiedCutoff(at).toISOString();
  return system(async (tx) => {
    const rows = (await tx.execute(sql`
      delete from auth.users u
      where (u.email_confirmed_at is null and u.created_at < ${cutoff}::timestamptz)
         or exists (
           select 1 from public.users p
           where p.id = u.id and p.status = 'consent_pending' and p.created_at < ${cutoff}::timestamptz
             and not exists (
               select 1 from public.guardian_relationships g join public.learners l on l.id = g.learner_id
               where l.user_id = p.id and g.consent_status = 'verified'))
      returning u.id`)) as unknown as { id: string }[];
    if (rows.length > 0) {
      await tx.insert(s.auditLogs).values({ action: "account.unverified_cleanup", resourceType: "user", metadata: { removed: rows.length } });
      logger.info("unverified accounts removed", { count: rows.length });
    }
    return rows.length;
  });
}
