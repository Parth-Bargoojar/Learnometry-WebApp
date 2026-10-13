import { and, inArray } from "drizzle-orm";
import { importContent } from "@/domains/content/import";
import { loadContent } from "@/domains/content/load";
import type { Db } from "../connection";
import * as s from "../schema";

/*
  The content bank as seed data (BE-1.5, rewritten in BE-3). The YAML files in `content/` are
  the single source: this imports them through the same importer as `npm run content:import`
  and then publishes them, so a development database has questions to assess with. It refuses
  to run with validation errors. Development and staging only: in production, content is
  reviewed and published by a person in /admin/questions.
*/
export async function seedSampleQuestions(db: Db): Promise<number> {
  const { files, findings } = loadContent();
  const errors = findings.filter((f) => f.severity === "error");
  if (errors.length > 0) throw new Error(`Content has ${errors.length} validation errors; run npm run content:validate`);

  const summary = await importContent(db, files);
  if (summary.missingConcepts.length > 0) throw new Error(`Seed the reference data first: missing ${JSON.stringify(summary.missingConcepts)}`);

  const tracks = [...new Set(files.flatMap((f) => f.items.flatMap((i) => i.tracks)))];
  const exams = await db.select({ id: s.exams.id }).from(s.exams).where(inArray(s.exams.code, tracks));
  await db
    .update(s.questions)
    .set({ validationStatus: "published", updatedAt: new Date() })
    .where(and(inArray(s.questions.examId, exams.map((e) => e.id)), inArray(s.questions.slug, files.flatMap((f) => f.items.map((i) => i.id)))));
  return files.reduce((n, f) => n + f.items.length, 0);
}
