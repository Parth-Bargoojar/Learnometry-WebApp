import "server-only";
import { asc, eq } from "drizzle-orm";
import { system } from "@/lib/db/system";
import * as s from "@/lib/db/schema";
import type { QuestionAction } from "@/domains/admin/rules";
import { getAdminQuestion, listAdminQuestions, transitionQuestions, type AdminQuestionFilters } from "./admin";

/* Entry points for the admin console (BE-3.4). Callers have already passed requireAdmin / requireActionAdmin. */

export const questionsForAdmin = (filters: AdminQuestionFilters) => system((tx) => listAdminQuestions(tx, filters));

export const questionForAdmin = (id: string) => system((tx) => getAdminQuestion(tx, id));

export const changeQuestions = (actor: { userId: string; role: string }, input: { action: QuestionAction; ids: string[]; reason: string }) =>
  system((tx) => transitionQuestions(tx, actor, input));

/** Filter choices for the question list, from the curriculum in the database. */
export async function questionFilterOptions() {
  return system(async (tx) => {
    const exams = await tx.select({ code: s.exams.code, name: s.exams.name }).from(s.exams).where(eq(s.exams.active, true)).orderBy(asc(s.exams.name));
    const chapters = await tx.select({ id: s.chapters.id, name: s.chapters.name, exam: s.exams.code }).from(s.chapters).innerJoin(s.subjects, eq(s.subjects.id, s.chapters.subjectId)).innerJoin(s.exams, eq(s.exams.id, s.subjects.examId)).orderBy(asc(s.chapters.name));
    const concepts = await tx.select({ id: s.concepts.id, name: s.concepts.name, exam: s.exams.code }).from(s.concepts).innerJoin(s.exams, eq(s.exams.id, s.concepts.examId)).orderBy(asc(s.concepts.name));
    return { exams, chapters, concepts };
  });
}
