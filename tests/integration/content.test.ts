import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importContent } from "@/domains/content/import";
import { questionSchema, type ConceptFile } from "@/domains/content/schema";
import { db, pg } from "./helpers";

/* Content import (BE-3.2): idempotent, versioned, re-reviewed on change, never destructive. */

const SLUG = "zz-test-imp-01";
const make = (over: Record<string, unknown> = {}): ConceptFile => ({
  path: "physics/laws-of-motion/fbd.yaml",
  concept: "fbd",
  items: [
    questionSchema.parse({
      id: SLUG,
      tracks: ["jee_main", "neet"],
      type: "mcq",
      difficulty: "medium",
      expected_seconds: 80,
      pool: "practice",
      stem: "A $1\\,\\text{kg}$ block hangs from a string. What is the tension?",
      options: [{ key: "A", text: "$5$ N" }, { key: "B", text: "$10$ N" }],
      answer: "B",
      solution: ["$T = mg = 10$ N."],
      ...over,
    }),
  ],
});

const CHANGED = { stem: "A $2\\,\\text{kg}$ block hangs from a string. What is the tension?", answer: "A", solution: ["$T = mg = 20$ N."] };

const rows = () => pg<{ exam: string; status: string; version_number: number; difficulty: number }[]>`
  select e.code as exam, q.validation_status as status, q.version_number, q.difficulty::float as difficulty
  from questions q join exams e on e.id = q.exam_id where q.slug = ${SLUG} order by 1`;

const clean = async () => {
  await pg`delete from questions where slug = ${SLUG}`;
};
beforeAll(clean);
afterAll(clean);

describe("importContent", () => {
  it("writes nothing on a dry run", async () => {
    const summary = await importContent(db, [make()], { dryRun: true });
    expect(summary.created).toBe(2);
    expect(await rows()).toEqual([]);
  });

  it("creates one validated row per track, with a first version and its validation records", async () => {
    const summary = await importContent(db, [make()]);
    expect(summary).toMatchObject({ created: 2, changed: 0, unchanged: 0, missingConcepts: [] });
    expect(await rows()).toEqual([
      { exam: "jee_main", status: "validated", version_number: 1, difficulty: 0.55 },
      { exam: "neet", status: "validated", version_number: 1, difficulty: 0.55 },
    ]);
    const [v] = await pg<{ n: number; validators: string[] }[]>`
      select count(*)::int as n, array_agg(distinct validator_type order by validator_type) as validators
      from question_validations where question_id in (select id from questions where slug = ${SLUG})`;
    expect(v).toEqual({ n: 6, validators: ["duplicate", "math", "schema"] });
  });

  it("leaves an unchanged item alone", async () => {
    expect(await importContent(db, [make()])).toMatchObject({ created: 0, changed: 0, unchanged: 2 });
  });

  it("sends changed content back for review as a new version, and keeps the history", async () => {
    await pg`update questions set validation_status = 'published' where slug = ${SLUG}`;
    const summary = await importContent(db, [make(CHANGED)]);
    expect(summary.changed).toBe(2);
    expect((await rows()).map((r) => [r.status, r.version_number])).toEqual([["validated", 2], ["validated", 2]]);
    const versions = await pg<{ version_number: number }[]>`select version_number from question_versions where question_id in (select id from questions where slug = ${SLUG} ) order by 1`;
    expect(versions.map((v) => v.version_number)).toEqual([1, 1, 2, 2]);
  });

  it("applies a per-track difficulty", async () => {
    const summary = await importContent(db, [make({ ...CHANGED, track_difficulty: { neet: "hard" } })]);
    expect(summary.changed).toBe(1); // only the neet row differs
    expect((await rows()).map((r) => r.difficulty)).toEqual([0.55, 0.8]);
  });

  it("reports, and does not delete, questions that left the files; and unknown concepts", async () => {
    const summary = await importContent(db, [{ ...make(), concept: "no-such-concept" }]);
    expect(summary.missingConcepts).toEqual([{ concept: "no-such-concept", track: "jee_main" }, { concept: "no-such-concept", track: "neet" }]);
    expect(summary.orphaned).toEqual(expect.arrayContaining([`jee_main:${SLUG}`]));
    expect((await rows()).length).toBe(2);
  });
});
