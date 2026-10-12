import "server-only";
import { CLASS_LABEL_BY_LEVEL, EXAM_LABEL_BY_CODE, monthYearOf } from "@/domains/identity/rules";
import { requireLearner } from "@/lib/auth/session";
import type { ProfileData, StudyData } from "@/components/settings";

/* Props for the settings screens, built from the signed-in learner (never from sample data). */

export async function loadProfile(): Promise<ProfileData> {
  const v = await requireLearner();
  return {
    first: v.firstName === v.email.split("@")[0] && !v.displayName ? "" : v.firstName,
    last: v.lastName,
    email: v.email,
    classLabel: v.learner.classLevel ? CLASS_LABEL_BY_LEVEL[v.learner.classLevel] : "Class 12",
    dateOfBirth: v.dateOfBirth ?? "2000-01-01",
  };
}

export async function loadStudy(): Promise<StudyData> {
  const v = await requireLearner();
  const my = monthYearOf(v.learner.targetDate);
  return {
    exam: v.learner.examCode ? EXAM_LABEL_BY_CODE[v.learner.examCode] : "JEE Main",
    month: my?.month ?? "January",
    year: my?.year ?? "2027",
    notSure: !v.learner.targetDate,
    minutes: v.learner.dailyMinutes,
    hasPlan: false, // plans arrive in BE-8
    balance: v.balance,
  };
}
