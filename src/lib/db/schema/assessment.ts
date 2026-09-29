import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgPolicy, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, oneOf, ownRowsPolicy, pk, tstz, updatedAt } from "./_helpers";
import { concepts } from "./curriculum";
import { questions } from "./content";
import { learners } from "./identity";

/*
  Assessments, attempts and responses (CONTEXT §6.4). Learners read their own rows.
  Scores, totals and `is_correct` are written by the server only (column grants in the
  security migration); a learner may write the answer fields of a response on their own
  in-progress attempt, and nothing else.
*/

export const ASSESSMENT_TYPES = ["diagnostic", "practice", "retest"] as const;
export const ATTEMPT_STATUSES = ["in_progress", "submitted", "abandoned", "invalidated"] as const;

export const assessments = pgTable(
  "assessments",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    assessmentType: text("assessment_type").$type<(typeof ASSESSMENT_TYPES)[number]>().notNull(),
    title: text("title").notNull(),
    /** Null for untimed practice. */
    durationSeconds: integer("duration_seconds"),
    questionCount: integer("question_count").notNull(),
    /** `{correct, incorrect, marked}` per track (ALG §1). */
    scoringRules: jsonb("scoring_rules").$type<Record<string, unknown>>().notNull(),
    /** Diagnostic kind (full/chapter/deep), chapter, target concept, plan task, … */
    scope: jsonb("scope").$type<Record<string, unknown>>().notNull().default({}),
    algVersion: text("alg_version").notNull().default("alg-v1"),
    status: text("status").$type<"draft" | "active" | "completed" | "archived">().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("assessments_duration_check", sql`${t.durationSeconds} is null or ${t.durationSeconds} > 0`),
    check("assessments_count_check", sql`${t.questionCount} > 0`),
    oneOf("assessments_type_check", t.assessmentType, ASSESSMENT_TYPES),
    oneOf("assessments_status_check", t.status, ["draft", "active", "completed", "archived"]),
    index("assessments_learner_idx").on(t.learnerId, t.createdAt),
    ownRowsPolicy("assessments"),
  ],
);

export const assessmentItems = pgTable(
  "assessment_items",
  {
    id: pk(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    /** The version the learner was shown, so results stay explainable after an edit. */
    questionVersion: integer("question_version").notNull().default(1),
    position: integer("position").notNull(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id),
    difficultySnapshot: numeric("difficulty_snapshot", { precision: 4, scale: 3, mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("assessment_items_position_key").on(t.assessmentId, t.position),
    unique("assessment_items_question_key").on(t.assessmentId, t.questionId),
    check("assessment_items_position_check", sql`${t.position} >= 0`),
    index("assessment_items_assessment_idx").on(t.assessmentId),
    index("assessment_items_question_idx").on(t.questionId),
    index("assessment_items_concept_idx").on(t.conceptId),
    pgPolicy("assessment_items_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.assessmentId} in (select id from public.assessments where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: pk(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    startedAt: tstz("started_at").notNull().defaultNow(),
    /** started_at + duration × timer multiplier (BE-D51); null when untimed. */
    deadlineAt: tstz("deadline_at"),
    timerMultiplier: numeric("timer_multiplier", { precision: 3, scale: 2, mode: "number" }).notNull().default(1),
    submittedAt: tstz("submitted_at"),
    status: text("status").$type<(typeof ATTEMPT_STATUSES)[number]>().notNull().default("in_progress"),
    score: numeric("score", { precision: 8, scale: 3, mode: "number" }),
    maxScore: numeric("max_score", { precision: 8, scale: 3, mode: "number" }),
    percentage: numeric("percentage", { precision: 6, scale: 3, mode: "number" }),
    correctCount: integer("correct_count"),
    incorrectCount: integer("incorrect_count"),
    unansweredCount: integer("unanswered_count"),
    accuracy: integer("accuracy"),
    timeSpentSeconds: integer("time_spent_seconds"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("attempts_status_check", t.status, ATTEMPT_STATUSES),
    check("attempts_percentage_check", sql`${t.percentage} is null or ${t.percentage} between 0 and 100`),
    check("attempts_submitted_check", sql`${t.status} <> 'submitted' or ${t.submittedAt} is not null`),
    index("attempts_learner_idx").on(t.learnerId, t.createdAt),
    index("attempts_assessment_idx").on(t.assessmentId),
    index("attempts_open_idx").on(t.status, t.deadlineAt),
    ownRowsPolicy("attempts"),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: pk(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    assessmentItemId: uuid("assessment_item_id")
      .notNull()
      .references(() => assessmentItems.id, { onDelete: "cascade" }),
    /** MCQ: `{key}`; numeric: `{value}`. Null = cleared or not answered. */
    selectedAnswer: jsonb("selected_answer").$type<Record<string, unknown>>(),
    isCorrect: boolean("is_correct"),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    /** D8: 1 = "Sure", 0 = "Not sure", null = not collected. */
    confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }),
    markedForReview: boolean("marked_for_review").notNull().default(false),
    /** A hint or explanation was used before answering (weights the evidence, ALG §3). */
    assisted: boolean("assisted").notNull().default(false),
    /** Monotonic per attempt; a lower value than stored is ignored (BE-D52). */
    clientSeq: integer("client_seq").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("responses_item_key").on(t.attemptId, t.assessmentItemId),
    check("responses_time_check", sql`${t.timeSpentSeconds} >= 0`),
    check("responses_confidence_check", sql`${t.confidence} is null or ${t.confidence} between 0 and 1`),
    index("responses_attempt_idx").on(t.attemptId),
    index("responses_item_idx").on(t.assessmentItemId),
    pgPolicy("responses_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.attemptId} in (select id from public.attempts where learner_id = (select private.current_learner_id()))`,
    }),
    pgPolicy("responses_own_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.attemptId} in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress')`,
    }),
    pgPolicy("responses_own_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.attemptId} in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress')`,
      withCheck: sql`${t.attemptId} in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress')`,
    }),
  ],
);
