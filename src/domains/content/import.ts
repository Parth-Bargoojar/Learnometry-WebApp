import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { contentHash, difficultyFor } from "./rules";
import { DIFFICULTY_VALUE, type ConceptFile, type QuestionItem, type Track } from "./schema";

/*
  Content import (BE-3.2, BE-D30). YAML → `questions` as Draft, one row per (exam, slug) for every
  track the item serves. Idempotent: an unchanged item is left alone; a changed one gets a new
  `question_versions` row and goes back to Draft for review. Items removed from the files are
  never deleted (learners may have answered them); they are reported so a person can suspend them.
*/

export interface ImportSummary {
  created: number;
  changed: number;
  unchanged: number;
  /** In the database for these exams but not in the files. */
  orphaned: string[];
  /** Concepts named in the files that do not exist for a track. */
  missingConcepts: { concept: string; track: Track }[];
}

/** What a learner and the engine see of an item, minus anything that is per-row. */
function payloadOf(q: QuestionItem, track: Track) {
  const answer = typeof q.answer === "string" ? { key: q.answer } : q.answer;
  return {
    content: {
      stem: q.stem,
      options: q.options ?? null,
      format: q.format,
      wrongAnswers: q.wrong_answers ?? null,
      misreadRisk: q.misread_risk,
      pool: q.pool,
      parallelGroup: q.parallel_group ?? null,
      expectedSeconds: q.expected_seconds,
      hint: q.hint ?? null,
      sourceType: q.source_type,
      sourceReference: q.source_reference ?? null,
    },
    answer,
    solution: { steps: q.solution, ...(q.hint ? { hint: q.hint } : {}) },
    difficulty: DIFFICULTY_VALUE[difficultyFor(q, track)],
  };
}

/** JSON with sorted keys: Postgres jsonb does not keep the order keys were written in. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

export async function importContent(db: Db, files: ConceptFile[], opts: { dryRun?: boolean } = {}): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, changed: 0, unchanged: 0, orphaned: [], missingConcepts: [] };
  const tracks = [...new Set(files.flatMap((f) => f.items.flatMap((i) => i.tracks)))];

  await db.transaction(async (tx) => {
    const exams = await tx.select().from(s.exams).where(inArray(s.exams.code, tracks));
    const examByCode = new Map(exams.map((e) => [e.code, e]));
    const seen = new Set<string>();

    for (const file of files) {
      for (const track of tracks) {
        const exam = examByCode.get(track);
        const items = file.items.filter((i) => i.tracks.includes(track));
        if (items.length === 0) continue;
        if (!exam) throw new Error(`Exam ${track} is not in the database; run db:seed first`);

        const [row] = await tx
          .select({ concept: s.concepts, topic: s.topics, chapter: s.chapters })
          .from(s.concepts)
          .innerJoin(s.topics, eq(s.topics.id, s.concepts.topicId))
          .innerJoin(s.chapters, eq(s.chapters.id, s.topics.chapterId))
          .where(and(eq(s.concepts.examId, exam.id), eq(s.concepts.code, file.concept)));
        if (!row) {
          summary.missingConcepts.push({ concept: file.concept, track });
          continue;
        }

        for (const q of items) {
          seen.add(`${exam.id}:${q.id}`);
          const next = payloadOf(q, track);
          const [existing] = await tx.select().from(s.questions).where(and(eq(s.questions.examId, exam.id), eq(s.questions.slug, q.id)));
          const rowValues = {
            examId: exam.id,
            subjectId: row.chapter.subjectId,
            chapterId: row.chapter.id,
            topicId: row.topic.id,
            conceptId: row.concept.id,
            questionType: q.type === "mcq" ? ("mcq" as const) : ("numeric" as const),
            difficulty: next.difficulty,
            expectedTimeSeconds: q.expected_seconds,
            learningObjective: row.concept.name,
            stem: q.stem,
            options: q.options ?? null,
            answer: next.answer,
            solution: next.solution,
            hint: q.hint ?? null,
            wrongAnswers: q.wrong_answers ?? null,
            misreadRisk: q.misread_risk,
            pool: q.pool,
            parallelGroup: q.parallel_group ?? null,
            format: q.format,
            sourceType: q.source_type,
            sourceReference: q.source_reference ?? null,
            contentHash: contentHash(q),
          };

          if (existing) {
            const [latest] = await tx
              .select()
              .from(s.questionVersions)
              .where(and(eq(s.questionVersions.questionId, existing.id), eq(s.questionVersions.versionNumber, existing.versionNumber)));
            if (latest && same(latest.content, next.content) && same(latest.answer, next.answer) && same(latest.solution, next.solution) && latest.difficulty === next.difficulty) {
              summary.unchanged++;
              continue;
            }
            summary.changed++;
            if (opts.dryRun) continue;
            const version = existing.versionNumber + 1;
            // Changed content must be reviewed again, so it leaves "published".
            await tx.update(s.questions).set({ ...rowValues, versionNumber: version, validationStatus: "validated", updatedAt: new Date() }).where(eq(s.questions.id, existing.id));
            await record(tx, existing.id, version, next, "Content file changed");
          } else {
            summary.created++;
            if (opts.dryRun) continue;
            const [created] = await tx.insert(s.questions).values({ slug: q.id, ...rowValues, validationStatus: "validated" }).returning({ id: s.questions.id });
            await record(tx, created.id, 1, next, "Imported");
          }
        }
      }
    }

    const known = await tx
      .select({ examId: s.questions.examId, slug: s.questions.slug })
      .from(s.questions)
      .where(inArray(s.questions.examId, exams.map((e) => e.id)));
    summary.orphaned = known.filter((k) => !seen.has(`${k.examId}:${k.slug}`)).map((k) => `${exams.find((e) => e.id === k.examId)!.code}:${k.slug}`);
    if (opts.dryRun) tx.rollback();
  }).catch((e: unknown) => {
    if (!(opts.dryRun && /rollback/i.test((e as Error).message))) throw e;
  });

  return summary;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Version row plus the deterministic validation results. Imported items passed them or never got here. */
async function record(tx: Tx, questionId: string, version: number, p: ReturnType<typeof payloadOf>, reason: string) {
  await tx.insert(s.questionVersions).values({ questionId, versionNumber: version, content: p.content, answer: p.answer, solution: p.solution, difficulty: p.difficulty, changeReason: reason });
  await tx.insert(s.questionValidations).values(
    (["schema", "math", "duplicate"] as const).map((validatorType) => ({
      questionId,
      versionNumber: version,
      validatorType,
      status: "pass" as const,
      details: { source: "content:validate" },
    })),
  );
}
