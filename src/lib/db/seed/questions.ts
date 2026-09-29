import { eq } from "drizzle-orm";
import { questions as sampleQuestions } from "@/lib/data";
import { sha256 } from "@/lib/security/crypto";
import type { Question } from "@/lib/types";
import type { Db } from "../connection";
import * as s from "../schema";

/*
  The sample question bank as seed data (BE-1.5). Development and staging only: production
  content arrives through the content pipeline (BE-3) as Draft and is published after review.
  Pool by id prefix: d = diagnostic, r = retest, p = practice. Published so BE-5 has items.
*/
const DIFFICULTY = { easy: 0.3, medium: 0.55, hard: 0.8 } as const;
const POOL = { d: "diagnostic", r: "retest", p: "practice" } as const;

const answerOf = (q: Question) => (q.type === "mcq" ? { key: q.answer } : { value: Number(q.answer), ...(q.tolerance !== undefined ? { tolerance: q.tolerance } : {}) });

export async function seedSampleQuestions(db: Db, examCode = "jee_main"): Promise<number> {
  return db.transaction(async (tx) => {
    const [exam] = await tx.select().from(s.exams).where(eq(s.exams.code, examCode));
    if (!exam) throw new Error(`Seed the reference data first: exam ${examCode} is missing`);
    const conceptRows = await tx.select().from(s.concepts).where(eq(s.concepts.examId, exam.id));
    const byCode = new Map(conceptRows.map((c) => [c.code, c]));
    const topics = new Map((await tx.select().from(s.topics)).map((t) => [t.id, t]));
    const chapters = new Map((await tx.select().from(s.chapters)).map((c) => [c.id, c]));

    let n = 0;
    for (const q of sampleQuestions) {
      const concept = byCode.get(q.conceptId);
      if (!concept) continue;
      const topic = topics.get(concept.topicId)!;
      const chapter = chapters.get(topic.chapterId)!;
      const answer = answerOf(q);
      const solution = { steps: [q.solution], ...(q.hint ? { hint: q.hint } : {}) };
      const values = {
        slug: q.id,
        examId: exam.id,
        subjectId: chapter.subjectId,
        chapterId: chapter.id,
        topicId: topic.id,
        conceptId: concept.id,
        questionType: q.type === "mcq" ? ("mcq" as const) : ("numeric" as const),
        difficulty: DIFFICULTY[q.difficulty],
        expectedTimeSeconds: q.expectedSeconds,
        learningObjective: concept.name,
        stem: q.stem,
        options: q.options?.map((o) => ({ key: o.key, text: o.text })) ?? null,
        answer,
        solution,
        hint: q.hint ?? null,
        pool: POOL[q.id[0] as keyof typeof POOL] ?? ("practice" as const),
        sourceType: "original" as const,
        validationStatus: "published" as const,
        contentHash: sha256(JSON.stringify([q.stem, q.options, answer])),
      };
      const [row] = await tx
        .insert(s.questions)
        .values(values)
        .onConflictDoUpdate({ target: [s.questions.examId, s.questions.slug], set: { ...values, updatedAt: new Date() } })
        .returning({ id: s.questions.id });
      await tx
        .insert(s.questionVersions)
        .values({ questionId: row.id, versionNumber: 1, content: { stem: q.stem, options: q.options ?? null }, answer, solution, difficulty: DIFFICULTY[q.difficulty], changeReason: "Seed" })
        .onConflictDoNothing();
      n++;
    }
    return n;
  });
}
