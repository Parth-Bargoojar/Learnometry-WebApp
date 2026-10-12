import { describe, expect, it } from "vitest";
import {
  adminAccess,
  ageBand,
  ageOfDob,
  deletionOutcomeAtSignIn,
  deletionSchedule,
  dobFromParts,
  firstNameOf,
  initialsOf,
  monthYearOf,
  nextLearnerStep,
  onboardingRedirect,
  plausibleDob,
  resumeStep,
  safeNextPath,
  splitName,
  targetDateFrom,
  totpVerifiedAt,
  unverifiedCutoff,
} from "./rules";
import { onboardingInputSchema, signUpSchema, studySettingsSchema } from "./schemas";

describe("date of birth and age", () => {
  it("builds an ISO date only from a real calendar date", () => {
    expect(dobFromParts({ day: "5", month: "3", year: "2009" })).toBe("2009-03-05");
    expect(dobFromParts({ day: 29, month: 2, year: 2008 })).toBe("2008-02-29");
    expect(dobFromParts({ day: 29, month: 2, year: 2009 })).toBeNull();
    expect(dobFromParts({ day: 31, month: 4, year: 2005 })).toBeNull();
    expect(dobFromParts({ day: "", month: "3", year: "2009" })).toBeNull();
    expect(dobFromParts({})).toBeNull();
  });

  it("bands ages at 13 and 18", () => {
    expect([12, 13, 17, 18, 40].map(ageBand)).toEqual(["too_young", "minor", "minor", "adult", "adult"]);
    expect(ageOfDob("2008-09-30", "2026-09-30")).toBe(18);
    expect(ageOfDob("2008-10-01", "2026-09-30")).toBe(17);
  });

  it("rejects future and ancient dates", () => {
    expect(plausibleDob("2026-10-01", "2026-09-30")).toBe(false);
    expect(plausibleDob("1899-12-31", "2026-09-30")).toBe(false);
    expect(plausibleDob("2008-01-01", "2026-09-30")).toBe(true);
  });
});

describe("onboarding steps", () => {
  it("advances through the learner path and ends at ready", () => {
    expect(nextLearnerStep("about-you")).toBe("exam");
    expect(nextLearnerStep("exam")).toBe("exam-date");
    expect(nextLearnerStep("exam-date")).toBe("study-time");
    expect(nextLearnerStep("study-time")).toBe("ready");
  });

  it("resumes after the last saved step", () => {
    expect(resumeStep(null, false)).toBe("about-you");
    expect(resumeStep("about-you", false)).toBe("exam");
    expect(resumeStep("study-time", false)).toBe("ready");
    expect(resumeStep("nonsense", false)).toBe("about-you");
    expect(resumeStep("exam", true)).toBe("ready");
  });

  it("stores the exam month as the first day of that month", () => {
    expect(targetDateFrom("January", 2027)).toBe("2027-01-01");
    expect(targetDateFrom("December", "2028")).toBe("2028-12-01");
    expect(targetDateFrom("Smarch", 2027)).toBeNull();
    expect(targetDateFrom("May", 1999)).toBeNull();
    expect(targetDateFrom("May", "abc")).toBeNull();
    expect(monthYearOf("2027-01-01")).toEqual({ month: "January", year: "2027" });
    expect(monthYearOf(null)).toBeNull();
  });
});

describe("names", () => {
  it("derives first names, initials and splits", () => {
    expect(firstNameOf("Ada Lovelace")).toBe("Ada");
    expect(firstNameOf("", "ada@x.com")).toBe("ada");
    expect(firstNameOf(null, null)).toBe("there");
    expect(initialsOf("Ada King Lovelace")).toBe("AL");
    expect(initialsOf("Ada")).toBe("AD");
    expect(initialsOf(null, "zed@x.com")).toBe("Z");
    expect(initialsOf(null, null)).toBe("?");
    expect(splitName("Ada King Lovelace")).toEqual({ first: "Ada", last: "King Lovelace" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
  });
});

describe("redirect safety", () => {
  it("follows only same-origin paths", () => {
    expect(safeNextPath("/plan")).toBe("/plan");
    expect(safeNextPath("/settings/profile?x=1")).toBe("/settings/profile?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "", null, undefined, "/a\nb"]) {
      expect(safeNextPath(bad as string)).toBe("/dashboard");
    }
    expect(safeNextPath("nope", "/login")).toBe("/login");
  });
});

describe("account deletion", () => {
  it("allows 48 hours to cancel and erases after 7 business days", () => {
    const now = new Date("2026-10-02T06:00:00Z"); // Friday
    const s = deletionSchedule(now);
    expect(s.cancellableUntil.toISOString()).toBe("2026-10-04T06:00:00.000Z");
    expect(s.eraseAt.toISOString()).toBe("2026-10-13T06:00:00.000Z"); // 7 business days later
  });

  it("cancels on sign-in within 48 h, blocks after, and ignores active accounts", () => {
    const at = new Date("2026-10-02T06:00:00Z");
    expect(deletionOutcomeAtSignIn("active", null, at)).toBe("none");
    expect(deletionOutcomeAtSignIn("deletion_pending", at, new Date("2026-10-04T06:00:00Z"))).toBe("cancel");
    expect(deletionOutcomeAtSignIn("deletion_pending", at, new Date("2026-10-04T06:00:01Z"))).toBe("blocked");
    expect(deletionOutcomeAtSignIn("deletion_pending", null, at)).toBe("cancel");
  });
});

describe("admin gate (K1)", () => {
  const now = 1_800_000_000;
  const admin = { role: "admin", status: "active", aal: "aal2", totpVerifiedAt: now - 3600 };
  it("grants only an active admin at AAL2 with a recent TOTP check", () => {
    expect(adminAccess(admin, now)).toBe("granted");
    expect(adminAccess({ ...admin, totpVerifiedAt: now - 12 * 3600 }, now)).toBe("granted");
    expect(adminAccess({ ...admin, totpVerifiedAt: now - 12 * 3600 - 1 }, now)).toBe("needs_2fa");
    expect(adminAccess({ ...admin, aal: "aal1" }, now)).toBe("needs_2fa");
    expect(adminAccess({ ...admin, totpVerifiedAt: null }, now)).toBe("needs_2fa");
  });
  it("denies everyone else", () => {
    expect(adminAccess({ ...admin, role: "learner" }, now)).toBe("denied");
    expect(adminAccess({ ...admin, role: "guardian" }, now)).toBe("denied");
    expect(adminAccess({ ...admin, status: "suspended" }, now)).toBe("denied");
  });
  it("reads the latest TOTP time from amr", () => {
    expect(totpVerifiedAt([{ method: "password", timestamp: 5 }, { method: "totp", timestamp: 10 }, { method: "totp", timestamp: 20 }])).toBe(20);
    expect(totpVerifiedAt([{ method: "password", timestamp: 5 }])).toBeNull();
    expect(totpVerifiedAt(undefined)).toBeNull();
    expect(totpVerifiedAt([null, { method: "totp", timestamp: "x" }])).toBeNull();
  });
});

describe("unverified accounts", () => {
  it("cuts off at seven days", () => {
    expect(unverifiedCutoff(new Date("2026-10-08T00:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("input schemas", () => {
  const valid = { role: "student", name: " Ada ", email: " ADA@Example.com ", password: "correct horse", terms: true };
  it("normalises and validates sign-up", () => {
    const r = signUpSchema.parse(valid);
    expect(r).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(signUpSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, terms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("validates onboarding steps", () => {
    expect(onboardingInputSchema.safeParse({ step: "about-you", dob: { day: "5", month: "3", year: "2005" }, classLevel: "Class 12" }).success).toBe(true);
    expect(onboardingInputSchema.safeParse({ step: "exam", exam: "GRE" }).success).toBe(false);
    expect(onboardingInputSchema.safeParse({ step: "study-time", minutes: 61 }).success).toBe(false);
    expect(onboardingInputSchema.safeParse({ step: "study-time", minutes: "60" }).success).toBe(true);
    expect(onboardingInputSchema.safeParse({ step: "exam-date", notSure: true }).success).toBe(true);
    expect(studySettingsSchema.safeParse({ minutes: 45 }).success).toBe(true);
    expect(studySettingsSchema.safeParse({ minutes: 240 }).success).toBe(true);
    expect(studySettingsSchema.safeParse({ minutes: 7 }).success).toBe(false);
    expect(studySettingsSchema.safeParse({ minutes: 50 }).success).toBe(false);
    expect(studySettingsSchema.safeParse({ minutes: 255 }).success).toBe(false);
  });
});

describe("onboarding routing", () => {
  const fresh = { held: false, completed: false, resume: "about-you" as const };
  it("lets a learner revisit earlier steps but not skip ahead", () => {
    expect(onboardingRedirect("about-you", fresh)).toBeNull();
    expect(onboardingRedirect("exam", fresh)).toBe("/onboarding/about-you");
    const mid = { held: false, completed: false, resume: "exam-date" as const };
    expect(onboardingRedirect("exam", mid)).toBeNull();
    expect(onboardingRedirect("exam-date", mid)).toBeNull();
    expect(onboardingRedirect("study-time", mid)).toBe("/onboarding/exam-date");
    expect(onboardingRedirect("ready", mid)).toBe("/onboarding/exam-date");
  });
  it("sends finished learners to the dashboard, except for the ready screen", () => {
    const done = { held: false, completed: true, resume: "ready" as const };
    expect(onboardingRedirect("ready", done)).toBeNull();
    expect(onboardingRedirect("exam", done)).toBe("/dashboard");
    expect(onboardingRedirect("minor-hold", done)).toBe("/dashboard");
  });
  it("keeps a held minor on the hold screen and closes the guardian steps", () => {
    const held = { held: true, completed: false, resume: "about-you" as const };
    expect(onboardingRedirect("minor-hold", held)).toBeNull();
    expect(onboardingRedirect("exam", held)).toBe("/onboarding/minor-hold");
    expect(onboardingRedirect("minor-hold", fresh)).toBe("/onboarding/about-you");
    for (const s of ["guardian", "waiting", "child", "consent", "invite-sent"]) expect(onboardingRedirect(s, fresh)).toBe("/onboarding/about-you");
    expect(onboardingRedirect("guardian", { held: false, completed: true, resume: "ready" })).toBe("/dashboard");
  });
});
