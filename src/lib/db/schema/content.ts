import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, oneOf, pk, updatedAt } from "./_helpers";
import { chapters, concepts, exams, subjects, topics } from "./curriculum";

/*
  Question bank (CONTEXT §6.3, BE-D30/D31). Learners never read these tables: they contain
  answers and solutions. The player gets answer-free items from a security-definer function
  and solutions only after finalize (BE-5). Written by content import (`db.system`).

  A question is one row per (exam, slug): the YAML file names the tracks it serves and the
  importer creates a row in each track's concept graph (BE-D70).
*/

export const QUESTION_TYPES = ["mcq", "numeric", "true_false", "short_answer"] as const;
export const VALIDATION_STATUSES = ["draft", "validated", "reviewed", "published", "suspended"] as const;
export const QUESTION_POOLS = ["diagnostic", "retest", "practice"] as const;
export const VALIDATOR_TYPES = ["schema", "math", "semantic", "difficulty", "duplicate", "exam_style", "safety", "human"] as const;

export const questions = pgTable(
  "questions",
  {
    id: pk(),
    /** Stable content id from the YAML file. */
    slug: text("slug").notNull(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id),
    questionType: text("question_type").$type<(typeof QUESTION_TYPES)[number]>().notNull(),
    /** 0–1: easy 0.3, medium 0.55, hard 0.8 unless overridden per track. */
    difficulty: numeric("difficulty", { precision: 4, scale: 3, mode: "number" }).notNull(),
    expectedTimeSeconds: integer("expected_time_seconds").notNull(),
    learningObjective: text("learning_objective").notNull(),
    /** Markdown with `$…$` KaTeX. */
    stem: text("stem").notNull(),
    /** MCQ: `[{key, text, misconception?}]`. */
    options: jsonb("options").$type<{ key: string; text: string; misconception?: string }[]>(),
    /** MCQ: `{key}`; numeric: `{value, tolerance?, tolerance_pct?}`. */
    answer: jsonb("answer").$type<Record<string, unknown>>().notNull(),
    solution: jsonb("solution").$type<Record<string, unknown>>().notNull(),
    hint: text("hint"),
    /** Known wrong numerical answers: `[{value, category}]` (ALG §5). */
    wrongAnswers: jsonb("wrong_answers").$type<{ value: number; category: string }[]>(),
    misreadRisk: boolean("misread_risk").notNull().default(false),
    pool: text("pool").$type<(typeof QUESTION_POOLS)[number]>().notNull().default("practice"),
    parallelGroup: text("parallel_group"),
    format: text("format"),
    sourceType: text("source_type").$type<"original" | "licensed" | "public_domain" | "user_generated">().notNull().default("original"),
    sourceReference: text("source_reference"),
    validationStatus: text("validation_status").$type<(typeof VALIDATION_STATUSES)[number]>().notNull().default("draft"),
    qualityScore: numeric("quality_score", { precision: 4, scale: 3, mode: "number" }),
    contentHash: text("content_hash").notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("questions_exam_slug_key").on(t.examId, t.slug),
    check("questions_difficulty_check", sql`${t.difficulty} between 0 and 1`),
    check("questions_time_check", sql`${t.expectedTimeSeconds} > 0`),
    check("questions_quality_check", sql`${t.qualityScore} is null or ${t.qualityScore} between 0 and 1`),
    check("questions_version_check", sql`${t.versionNumber} > 0`),
    oneOf("questions_type_check", t.questionType, QUESTION_TYPES),
    oneOf("questions_status_check", t.validationStatus, VALIDATION_STATUSES),
    oneOf("questions_pool_check", t.pool, QUESTION_POOLS),
    oneOf("questions_source_check", t.sourceType, ["original", "licensed", "public_domain", "user_generated"]),
    index("questions_concept_id_idx").on(t.conceptId),
    index("questions_validation_status_idx").on(t.validationStatus),
    index("questions_selection_idx").on(t.conceptId, t.pool, t.validationStatus),
    index("questions_content_hash_idx").on(t.contentHash),
  ],
);

export const questionVersions = pgTable(
  "question_versions",
  {
    id: pk(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    answer: jsonb("answer").$type<Record<string, unknown>>().notNull(),
    solution: jsonb("solution").$type<Record<string, unknown>>().notNull(),
    difficulty: numeric("difficulty", { precision: 4, scale: 3, mode: "number" }).notNull(),
    changeReason: text("change_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("question_versions_number_key").on(t.questionId, t.versionNumber),
    check("question_versions_number_check", sql`${t.versionNumber} > 0`),
    check("question_versions_difficulty_check", sql`${t.difficulty} between 0 and 1`),
  ],
);

export const questionValidations = pgTable(
  "question_validations",
  {
    id: pk(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    /** The version these results belong to. */
    versionNumber: integer("version_number").notNull().default(1),
    validatorType: text("validator_type").$type<(typeof VALIDATOR_TYPES)[number]>().notNull(),
    status: text("status").$type<"pass" | "fail" | "warning" | "pending">().notNull(),
    score: numeric("score", { precision: 4, scale: 3, mode: "number" }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("question_validations_type_check", t.validatorType, VALIDATOR_TYPES),
    oneOf("question_validations_status_check", t.status, ["pass", "fail", "warning", "pending"]),
    index("question_validations_question_idx").on(t.questionId, t.createdAt),
  ],
);
