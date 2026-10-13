import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { AppError } from "@/lib/errors/app-error";
import type { AdminQuestion, AdminQuestionDetail, ValidationView } from "./types";
import { AUTOMATED_VALIDATORS, reasonError, transitionBlocker, type QuestionAction, type QuestionStatus, type ValidationResult, type ValidatorType } from "@/domains/admin/rules";

/*
  Admin question operations (BE-3.4, K2, K6). The console never edits content: it reviews, publishes
  and suspends what the importer produced. Every change is one transaction with its audit row.
  Validation results belong to a question *version*, so a re-import starts review again.
*/

export type { AdminQuestion, AdminQuestionDetail, ValidationView };

export interface AdminQuestionFilters {
  exam?: string;
  chapterId?: string;
  conceptId?: string;
  difficulty?: string;
  use?: string;
  status?: QuestionStatus;
}

const USE = { diagnostic: "Diagnostic", retest: "Retest", practice: "Practice" } as const;
const difficultyLabel = (d: number) => (d < 0.45 ? "easy" : d < 0.7 ? "medium" : "hard");
const NOT_RUN = "Not run: no AI provider is configured yet.";
const ALL_VALIDATORS: ValidatorType[] = [...AUTOMATED_VALIDATORS, "human"];

type Row = {
  q: typeof s.questions.$inferSelect;
  exam: { code: string; name: string };
  chapter: { id: string; name: string };
  concept: { id: string; name: string };
};

async function baseRows(tx: Tx, where?: ReturnType<typeof and>): Promise<Row[]> {
  const rows = await tx
    .select({
      q: s.questions,
      exam: { code: s.exams.code, name: s.exams.name },
      chapter: { id: s.chapters.id, name: s.chapters.name },
      concept: { id: s.concepts.id, name: s.concepts.name },
    })
    .from(s.questions)
    .innerJoin(s.exams, eq(s.exams.id, s.questions.examId))
    .innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId))
    .innerJoin(s.concepts, eq(s.concepts.id, s.questions.conceptId))
    .where(where)
    .orderBy(s.exams.code, s.chapters.name, s.concepts.name, s.questions.slug);
  return rows;
}

/** Validation results for the current version of each question; a missing validator is "pending". */
async function validationsFor(tx: Tx, qs: { id: string; versionNumber: number }[]) {
  const out = new Map<string, Record<ValidatorType, ValidationView>>();
  if (qs.length === 0) return out;
  const rows = await tx.select().from(s.questionValidations).where(inArray(s.questionValidations.questionId, qs.map((q) => q.id))).orderBy(s.questionValidations.createdAt);
  const version = new Map(qs.map((q) => [q.id, q.versionNumber]));
  for (const q of qs) out.set(q.id, Object.fromEntries(ALL_VALIDATORS.map((v) => [v, { result: "pending" as ValidationResult }])) as Record<ValidatorType, ValidationView>);
  for (const r of rows) {
    if (r.versionNumber !== version.get(r.questionId)) continue;
    const details = (r.details ?? {}) as { note?: string; message?: string; pending?: boolean };
    out.get(r.questionId)![r.validatorType as ValidatorType] = { result: r.status, note: details.pending ? NOT_RUN : details.message ?? details.note };
  }
  return out;
}

async function usageFor(tx: Tx, ids: string[]) {
  const out = new Map<string, { served: number; correctRate: number | null }>();
  if (ids.length === 0) return out;
  const rows = (await tx.execute(sql`
    select ai.question_id as id, count(r.id)::int as served, avg(case when r.is_correct then 1 else 0 end)::float as rate
    from public.assessment_items ai join public.responses r on r.assessment_item_id = ai.id
    where ai.question_id in ${ids} and r.is_correct is not null group by 1`)) as unknown as { id: string; served: number; rate: number | null }[];
  for (const r of rows) out.set(r.id, { served: r.served, correctRate: r.rate });
  return out;
}

function toAdminQuestion(r: Row, v: Record<ValidatorType, ValidationView>, u?: { served: number; correctRate: number | null }, note?: string): AdminQuestion {
  const solution = r.q.solution as { steps?: string[] };
  return {
    id: r.q.id,
    slug: r.q.slug,
    exam: r.exam.name,
    examCode: r.exam.code,
    chapterId: r.chapter.id,
    chapterName: r.chapter.name,
    conceptId: r.concept.id,
    conceptName: r.concept.name,
    difficulty: difficultyLabel(r.q.difficulty),
    use: USE[r.q.pool],
    status: r.q.validationStatus,
    statusNote: note,
    stem: r.q.stem,
    questionType: r.q.questionType,
    options: r.q.options,
    answer: r.q.answer,
    solution: solution.steps ?? [],
    hint: r.q.hint,
    expectedSeconds: r.q.expectedTimeSeconds,
    versionNumber: r.q.versionNumber,
    source: r.q.sourceType === "licensed" ? "licensed" : "original",
    learningObjective: r.q.learningObjective,
    validations: v,
    served: u?.served ?? 0,
    correctRate: u?.correctRate ?? null,
  };
}

export async function listAdminQuestions(tx: Tx, f: AdminQuestionFilters = {}): Promise<AdminQuestion[]> {
  const conditions = [
    f.exam ? eq(s.exams.code, f.exam) : undefined,
    f.chapterId ? eq(s.questions.chapterId, f.chapterId) : undefined,
    f.conceptId ? eq(s.questions.conceptId, f.conceptId) : undefined,
    f.status ? eq(s.questions.validationStatus, f.status) : undefined,
    f.use ? eq(s.questions.pool, f.use.toLowerCase() as keyof typeof USE) : undefined,
    f.difficulty === "easy" ? sql`${s.questions.difficulty} < 0.45` : f.difficulty === "medium" ? sql`${s.questions.difficulty} >= 0.45 and ${s.questions.difficulty} < 0.7` : f.difficulty === "hard" ? sql`${s.questions.difficulty} >= 0.7` : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  const rows = await baseRows(tx, conditions.length ? and(...conditions) : undefined);
  const [v, u] = await Promise.all([validationsFor(tx, rows.map((r) => ({ id: r.q.id, versionNumber: r.q.versionNumber }))), usageFor(tx, rows.map((r) => r.q.id))]);
  return rows.map((r) => toAdminQuestion(r, v.get(r.q.id)!, u.get(r.q.id)));
}

export async function getAdminQuestion(tx: Tx, id: string): Promise<AdminQuestionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await baseRows(tx, eq(s.questions.id, id));
  if (!row) return null;
  const [v, u, versions, [last]] = await Promise.all([
    validationsFor(tx, [{ id, versionNumber: row.q.versionNumber }]),
    usageFor(tx, [id]),
    tx.select().from(s.questionVersions).where(eq(s.questionVersions.questionId, id)).orderBy(desc(s.questionVersions.versionNumber)),
    tx.select().from(s.auditLogs).where(and(eq(s.auditLogs.resourceType, "question"), eq(s.auditLogs.resourceId, id), eq(s.auditLogs.action, "question.suspended"))).orderBy(desc(s.auditLogs.createdAt)).limit(1),
  ]);
  const note = row.q.validationStatus === "suspended" ? last?.reason ?? undefined : undefined;
  return { ...toAdminQuestion(row, v.get(id)!, u.get(id), note), versions: versions.map((x) => ({ n: x.versionNumber, at: x.createdAt.toISOString(), reason: x.changeReason ?? "" })) };
}

/* ---------- Transitions ---------- */

export interface TransitionResult {
  done: string[];
  skipped: { id: string; reason: string }[];
}

const resultsOf = (v: Record<ValidatorType, ValidationView>) => Object.fromEntries(ALL_VALIDATORS.map((k) => [k, v[k].result])) as Record<ValidatorType, ValidationResult>;
const TO: Record<QuestionAction, QuestionStatus> = { review: "reviewed", publish: "published", suspend: "suspended" };

export async function transitionQuestions(tx: Tx, actor: { userId: string; role: string }, input: { action: QuestionAction; ids: string[]; reason: string }): Promise<TransitionResult> {
  const why = reasonError(input.reason);
  if (why) throw new AppError("validation_failed", { message: why });
  const ids = [...new Set(input.ids)];
  if (ids.length === 0 || ids.length > 200) throw new AppError("validation_failed", { message: "Choose between 1 and 200 questions." });

  // Lock the rows so two admins cannot move the same question at once.
  const locked = await tx.select().from(s.questions).where(inArray(s.questions.id, ids)).for("update");
  const v = await validationsFor(tx, locked.map((q) => ({ id: q.id, versionNumber: q.versionNumber })));
  const byId = new Map(locked.map((q) => [q.id, q]));

  const result: TransitionResult = { done: [], skipped: [] };
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) {
      result.skipped.push({ id, reason: "Not found." });
      continue;
    }
    const blocker = transitionBlocker(input.action, q.validationStatus, resultsOf(v.get(id)!));
    if (blocker) {
      result.skipped.push({ id, reason: blocker });
      continue;
    }
    if (input.action === "review") {
      await tx.insert(s.questionValidations).values({ questionId: id, versionNumber: q.versionNumber, validatorType: "human", status: "pass", createdBy: actor.userId, details: { message: "Reviewed by an admin" } });
    }
    await tx.update(s.questions).set({ validationStatus: TO[input.action], updatedAt: new Date() }).where(eq(s.questions.id, id));
    await tx.insert(s.auditLogs).values({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: `question.${input.action === "review" ? "reviewed" : TO[input.action]}`,
      resourceType: "question",
      resourceId: id,
      reason: input.reason.trim(),
      metadata: { slug: q.slug, from: q.validationStatus, to: TO[input.action], version: q.versionNumber, bulk: ids.length > 1 },
    });
    result.done.push(id);
  }
  return result;
}
