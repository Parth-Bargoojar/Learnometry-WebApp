import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { PLANS, type PlanCode } from "@/domains/credits/costs";
import { getBalanceSummary } from "@/domains/credits/queries";
import { creditStateFor } from "@/domains/credits/rules";
import { EXAM_LABEL_BY_CODE, adminAccess, firstNameOf, initialsOf, resumeStep, splitName, totpVerifiedAt } from "@/domains/identity/rules";
import { ADULT_AGE, ageOn } from "@/domains/guardian/rules";
import { asUser } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { istDate, now } from "@/lib/time";
import type { ConsentState, LearnerView, Viewer } from "@/lib/viewer";

/*
  The data access layer's front door (BE-D7, ARCHITECTURE §4). Every page, layout and action
  starts here. `getViewer()` validates the session with Supabase, then reads the person's own
  rows THROUGH RLS (`asUser`), so what a viewer can see is decided by the database as well.
*/

export interface SessionClaims {
  userId: string;
  email: string | null;
  aal: string | null;
  totpVerifiedAt: number | null;
}

/** The validated session, or null. Cached for the duration of one request. */
export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: typeof claims.aal === "string" ? claims.aal : null,
    totpVerifiedAt: totpVerifiedAt(claims.amr),
  };
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();
  if (!session) return null;
  const at = now();

  const loaded = await asUser({ sub: session.userId }, async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, session.userId));
    if (!user) return null;

    const [learner] = await tx
      .select({ l: s.learners, examCode: s.exams.code, subjectName: s.subjects.name })
      .from(s.learners)
      .leftJoin(s.exams, eq(s.exams.id, s.learners.examId))
      .leftJoin(s.subjects, eq(s.subjects.id, s.learners.subjectId))
      .where(eq(s.learners.userId, session.userId));

    let plan: PlanCode = "free";
    let balance = 0;
    let buckets: Viewer["buckets"] = [];
    let consent: ConsentState = "not_required";
    if (learner) {
      const [sub] = await tx
        .select({ code: s.plans.code })
        .from(s.subscriptions)
        .innerJoin(s.plans, eq(s.plans.id, s.subscriptions.planId))
        .where(and(eq(s.subscriptions.learnerId, learner.l.id), gt(s.subscriptions.currentPeriodEnd, at)))
        .orderBy(desc(s.subscriptions.currentPeriodEnd))
        .limit(1);
      if (sub && sub.code in PLANS) plan = sub.code as PlanCode;
      const summary = await getBalanceSummary(tx, learner.l.id, plan, at);
      balance = summary.balance;
      buckets = summary.buckets;

      const [rel] = await tx
        .select({ status: s.guardianRelationships.consentStatus })
        .from(s.guardianRelationships)
        .where(eq(s.guardianRelationships.learnerId, learner.l.id))
        .orderBy(desc(s.guardianRelationships.createdAt))
        .limit(1);
      if (rel) consent = rel.status;
    }
    const [{ n: unread }] = await tx
      .select({ n: count() })
      .from(s.notifications)
      .where(and(eq(s.notifications.userId, session.userId), isNull(s.notifications.readAt)));
    return { user, learner, plan, balance, buckets, consent, unread };
  });
  if (!loaded) return null;

  const { user, learner, plan, balance, buckets, consent, unread } = loaded;
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth, istDate(at)) : null;
  const isMinor = age !== null && age < ADULT_AGE;
  const names = splitName(user.displayName);
  const examCode = (learner?.examCode ?? null) as LearnerView["examCode"];

  return {
    userId: user.id,
    email: user.email ?? session.email ?? "",
    role: user.role,
    status: user.status,
    displayName: user.displayName,
    firstName: firstNameOf(user.displayName, user.email),
    lastName: names.last,
    initials: initialsOf(user.displayName, user.email),
    dateOfBirth: user.dateOfBirth,
    age,
    isMinor,
    consent,
    needsApproval: isMinor && consent === "verified",
    deactivatedAt: user.deactivatedAt,
    aal: session.aal,
    totpVerifiedAt: session.totpVerifiedAt,
    learner: learner
      ? {
          id: learner.l.id,
          examCode,
          examName: examCode ? EXAM_LABEL_BY_CODE[examCode] : null,
          subject: learner.subjectName,
          unit: learner.l.unit,
          targetDate: learner.l.targetDate,
          dailyMinutes: learner.l.availableStudyMinutesPerDay,
          classLevel: learner.l.classLevel,
          engine: learner.l.enginePreference,
          theme: learner.l.theme,
          onboardingCompleted: learner.l.onboardingCompleted,
          onboardingStep: learner.l.onboardingStep,
          activatedAt: learner.l.activatedAt,
        }
      : null,
    plan,
    balance,
    creditState: creditStateFor(balance, PLANS[plan].periodCredits),
    buckets,
    unreadCount: unread,
  };
});

/* ---------- Guards for pages and layouts (redirect / 404) ---------- */

/** Where a signed-in person lands when they have somewhere else to be first. */
export function homeFor(viewer: Viewer): string {
  if (viewer.role === "admin") return "/security/2fa";
  if (viewer.role === "guardian") return "/guardian";
  return viewer.learner?.onboardingCompleted ? "/dashboard" : onboardingPath(viewer);
}

/** The onboarding screen a learner who has not finished belongs on (a held minor sees the hold screen). */
export function onboardingPath(viewer: Viewer): string {
  if (viewer.status === "consent_pending") return "/onboarding/minor-hold";
  return `/onboarding/${resumeStep(viewer.learner?.onboardingStep, false)}`;
}

/** A signed-in viewer, else `/login?next=…`. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (viewer.status === "deletion_pending" || viewer.status === "suspended") redirect("/login?reason=" + viewer.status);
  return viewer;
}

/** A learner who has finished onboarding. Guardians go to their portal, admins to 2FA. */
export async function requireLearner(): Promise<Viewer & { learner: NonNullable<Viewer["learner"]> }> {
  const viewer = await requireViewer();
  if (viewer.role !== "learner" || !viewer.learner) redirect(homeFor(viewer));
  if (!viewer.learner.onboardingCompleted) redirect(onboardingPath(viewer));
  return viewer as Viewer & { learner: NonNullable<Viewer["learner"]> };
}

/** Admin console gate (K1): anything but an active admin with a fresh second factor is a 404. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) notFound();
  const access = adminAccess({ role: viewer.role, status: viewer.status, aal: viewer.aal, totpVerifiedAt: viewer.totpVerifiedAt }, Math.floor(now().getTime() / 1000));
  if (access !== "granted") notFound();
  return viewer;
}

/** The 2FA screens: an active admin at any assurance level; everyone else gets a 404. */
export async function requireAdminForSecondFactor(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.status !== "active") notFound();
  return viewer;
}

/* ---------- Guards for actions and route handlers (throw AppError) ---------- */

export async function requireActionViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("unauthenticated");
  if (viewer.status !== "active" && viewer.status !== "consent_pending") throw new AppError("forbidden");
  return viewer;
}

export async function requireActionLearner(): Promise<Viewer & { learner: NonNullable<Viewer["learner"]> }> {
  const viewer = await requireActionViewer();
  if (viewer.role !== "learner" || !viewer.learner) throw new AppError("forbidden");
  return viewer as Viewer & { learner: NonNullable<Viewer["learner"]> };
}

/** Admin actions repeat the console gate: a missing role or stale second factor is `forbidden`, never a redirect. */
export async function requireActionAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("unauthenticated");
  const access = adminAccess({ role: viewer.role, status: viewer.status, aal: viewer.aal, totpVerifiedAt: viewer.totpVerifiedAt }, Math.floor(now().getTime() / 1000));
  if (access !== "granted") throw new AppError("forbidden");
  return viewer;
}

/**
 * Academic, AI and billing operations need consent: an adult, or a minor whose guardian has
 * verified it (D4). Until minors can sign up (BE-D50) a minor never reaches here with data.
 */
export function assertConsent(viewer: Viewer): void {
  if (viewer.isMinor && viewer.consent !== "verified") throw new AppError("consent_required");
}
