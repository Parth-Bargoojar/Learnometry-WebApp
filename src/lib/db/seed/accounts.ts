import { eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/security/crypto";
import type { Db } from "../connection";
import * as s from "../schema";

/*
  Seed accounts (BE-D62): the sample story as real users, for local, dev and staging only.
  The password is public and only ever valid on those databases. Each account gets its profile,
  learner settings and, for Rohan, the verified guardian link. Credits, attempts and plans are
  added by the stage that owns them (ledger BE-4, assessments BE-5, plans BE-8).
*/
export const SEED_PASSWORD = process.env.SEED_PASSWORD || "Seed-Password-1!";
/** Public throw-away key, only used to encrypt seed guardian contacts when no real key is set. */
const DEV_PII_KEY = Buffer.alloc(32, 1).toString("base64");

export interface SeedAccount {
  email: string;
  name: string;
  role: "learner" | "guardian" | "admin";
  dateOfBirth?: string;
  /** Learner settings. */
  learner?: { classLevel: "class_11" | "class_12"; examDate: string; minutes: number; engine: "fast" | "standard"; onboarded: boolean };
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    email: "rohan@seed.learnometry.test",
    name: "Rohan Mehta",
    role: "learner",
    dateOfBirth: "2009-03-14",
    learner: { classLevel: "class_11", examDate: "2027-01-22", minutes: 60, engine: "standard", onboarded: true },
  },
  { email: "sunita@seed.learnometry.test", name: "Sunita Mehta", role: "guardian" },
  {
    email: "new@seed.learnometry.test",
    name: "Nisha Verma",
    role: "learner",
    dateOfBirth: "2005-06-02",
    learner: { classLevel: "class_12", examDate: "2027-01-22", minutes: 60, engine: "fast", onboarded: true },
  },
  {
    email: "out@seed.learnometry.test",
    name: "Omar Khan",
    role: "learner",
    dateOfBirth: "2004-11-20",
    learner: { classLevel: "class_12", examDate: "2027-04-10", minutes: 45, engine: "fast", onboarded: true },
  },
  {
    email: "adult@seed.learnometry.test",
    name: "Aditi Rao",
    role: "learner",
    dateOfBirth: "2006-01-15",
    learner: { classLevel: "class_12", examDate: "2027-01-22", minutes: 90, engine: "fast", onboarded: true },
  },
  { email: "admin@seed.learnometry.test", name: "Operator", role: "admin" },
];

async function ensureAuthUser(admin: SupabaseClient, db: Db, a: SeedAccount): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: a.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { role: a.role === "admin" ? "learner" : a.role, name: a.name },
  });
  if (data?.user) return data.user.id;
  if (!/already|registered|exists/i.test(error?.message ?? "")) throw new Error(`createUser(${a.email}): ${error?.message}`);
  const [row] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, a.email));
  if (!row) throw new Error(`${a.email} exists in auth but has no profile`);
  return row.id;
}

export async function seedAccounts(db: Db, admin: SupabaseClient): Promise<string[]> {
  const [exam] = await db.select().from(s.exams).where(eq(s.exams.code, "jee_main"));
  if (!exam) throw new Error("Seed the reference data first");
  const [subject] = await db.select().from(s.subjects).where(eq(s.subjects.examId, exam.id));

  const ids = new Map<string, string>();
  for (const a of SEED_ACCOUNTS) {
    const id = await ensureAuthUser(admin, db, a);
    ids.set(a.email, id);
    await db
      .update(s.users)
      .set({
        displayName: a.name,
        role: a.role,
        dateOfBirth: a.dateOfBirth ?? null,
        // Guardians and the operator are adults with no learner row; the trigger made one for `admin` (learner metadata).
      })
      .where(eq(s.users.id, id));
    if (a.role !== "learner") {
      await db.delete(s.learners).where(eq(s.learners.userId, id));
    } else if (a.learner) {
      await db
        .update(s.learners)
        .set({
          examId: exam.id,
          subjectId: subject.id,
          unit: "Class 11 Mechanics",
          classLevel: a.learner.classLevel,
          targetDate: a.learner.examDate,
          availableStudyMinutesPerDay: a.learner.minutes,
          enginePreference: a.learner.engine,
          onboardingCompleted: a.learner.onboarded,
          onboardingStep: a.learner.onboarded ? "done" : null,
          activatedAt: a.learner.onboarded ? new Date() : null,
        })
        .where(eq(s.learners.userId, id));
    }
  }

  // Rohan is 17: his guardian Sunita has verified consent (D4).
  const [rohan] = await db.select().from(s.learners).where(eq(s.learners.userId, ids.get("rohan@seed.learnometry.test")!));
  const existing = await db.select().from(s.guardianRelationships).where(eq(s.guardianRelationships.learnerId, rohan.id));
  if (existing.length === 0) {
    await db.insert(s.guardianRelationships).values({
      guardianUserId: ids.get("sunita@seed.learnometry.test")!,
      learnerId: rohan.id,
      guardianName: "Sunita Mehta",
      guardianContact: encrypt("sunita@seed.learnometry.test", process.env.PII_ENCRYPTION_KEY || DEV_PII_KEY),
      contactType: "email",
      relationshipType: "mother",
      consentStatus: "verified",
      consentMethod: "otp_email",
      consentPolicyVersion: "Guardian Consent Policy v1.1",
      consentVerifiedAt: new Date("2026-09-12T10:00:00+05:30"),
      pendingExpiresAt: new Date("2026-09-19T10:00:00+05:30"),
    });
  }
  return [...ids.keys()];
}
