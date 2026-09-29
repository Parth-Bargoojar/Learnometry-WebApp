import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, numeric, pgPolicy, pgTable, text, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { assessments, attempts } from "./assessment";
import { createdAt, oneOf, ownRowsPolicy, pk, tstz, updatedAt } from "./_helpers";
import { concepts } from "./curriculum";
import { learners } from "./identity";

/*
  Learning state, diagnoses, plans and retests (CONTEXT §6.5–6.6). Computed by the server
  (`db.system`); learners read their own rows. The one client write is a plan task's own
  status/date (Undo, skip, move) through a column grant.
*/

export const studentConceptState = pgTable(
  "student_concept_state",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    masteryScore: numeric("mastery_score", { precision: 5, scale: 4, mode: "number" }).notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4, mode: "number" }).notNull(),
    /** Evidence items in the window (drives the confidence band, ALG §2). */
    evidenceCount: integer("evidence_count").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    accuracy: numeric("accuracy", { precision: 5, scale: 4, mode: "number" }).notNull().default(0),
    recentAccuracy: numeric("recent_accuracy", { precision: 5, scale: 4, mode: "number" }).notNull().default(0),
    avgTimeSeconds: numeric("avg_time_seconds", { precision: 10, scale: 2, mode: "number" }),
    errorProfile: jsonb("error_profile").$type<Record<string, number>>().notNull().default({}),
    difficultyProfile: jsonb("difficulty_profile").$type<Record<string, unknown>>().notNull().default({}),
    lastSeenAt: tstz("last_seen_at"),
    lastReviewedAt: tstz("last_reviewed_at"),
    forgettingScore: numeric("forgetting_score", { precision: 5, scale: 4, mode: "number" }).notNull().default(0),
    priorityScore: numeric("priority_score", { precision: 5, scale: 4, mode: "number" }).notNull().default(0),
    algVersion: text("alg_version").notNull().default("alg-v1"),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("student_concept_state_key").on(t.learnerId, t.conceptId),
    check("scs_mastery_check", sql`${t.masteryScore} between 0 and 1`),
    check("scs_confidence_check", sql`${t.confidenceScore} between 0 and 1`),
    check("scs_accuracy_check", sql`${t.accuracy} between 0 and 1 and ${t.recentAccuracy} between 0 and 1`),
    check("scs_scores_check", sql`${t.forgettingScore} between 0 and 1 and ${t.priorityScore} between 0 and 1`),
    index("student_concept_state_learner_idx").on(t.learnerId, t.conceptId),
    ownRowsPolicy("student_concept_state"),
  ],
);

export const diagnoses = pgTable(
  "diagnoses",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .unique()
      .references(() => attempts.id, { onDelete: "cascade" }),
    status: text("status").$type<"queued" | "processing" | "completed" | "failed" | "superseded">().notNull().default("queued"),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    weakConcepts: jsonb("weak_concepts").$type<unknown[]>().notNull().default([]),
    rootCauses: jsonb("root_causes").$type<unknown[]>().notNull().default([]),
    confidence: numeric("confidence", { precision: 5, scale: 4, mode: "number" }),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    algVersion: text("alg_version").notNull().default("alg-v1"),
    promptVersion: text("prompt_version").notNull().default("none"),
    model: text("model"),
    /** Stage 3 failed and the deterministic fallback was delivered (BE-D53). */
    fallback: text("fallback"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("diagnoses_status_check", t.status, ["queued", "processing", "completed", "failed", "superseded"]),
    check("diagnoses_confidence_check", sql`${t.confidence} is null or ${t.confidence} between 0 and 1`),
    index("diagnoses_learner_idx").on(t.learnerId, t.createdAt),
    index("diagnoses_assessment_idx").on(t.assessmentId),
    ownRowsPolicy("diagnoses"),
  ],
);

export const interventions = pgTable(
  "interventions",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id),
    interventionType: text("intervention_type").$type<"revision" | "practice" | "explanation" | "resource" | "retest">().notNull(),
    priority: integer("priority").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    status: text("status").$type<"recommended" | "active" | "completed" | "skipped" | "expired">().notNull().default("recommended"),
    sourceDiagnosisId: uuid("source_diagnosis_id").references(() => diagnoses.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("interventions_priority_check", sql`${t.priority} > 0`),
    check("interventions_minutes_check", sql`${t.estimatedMinutes} > 0`),
    oneOf("interventions_type_check", t.interventionType, ["revision", "practice", "explanation", "resource", "retest"]),
    oneOf("interventions_status_check", t.status, ["recommended", "active", "completed", "skipped", "expired"]),
    index("interventions_learner_idx").on(t.learnerId, t.status),
    index("interventions_diagnosis_idx").on(t.sourceDiagnosisId),
    ownRowsPolicy("interventions"),
  ],
);

export const studyPlans = pgTable(
  "study_plans",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id").references(() => diagnoses.id, { onDelete: "set null" }),
    /** Only a diagnostic, a retest or a paid rebuild creates a new version (J1). */
    versionNumber: integer("version_number").notNull().default(1),
    trigger: text("trigger").$type<"diagnostic" | "retest" | "paid_rebuild">().notNull().default("diagnostic"),
    supersedesPlanId: uuid("supersedes_plan_id").references((): AnyPgColumn => studyPlans.id, { onDelete: "set null" }),
    status: text("status").$type<"draft" | "active" | "completed" | "superseded">().notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    availableMinutes: integer("available_minutes").notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    rationale: jsonb("rationale").$type<Record<string, unknown>>().notNull().default({}),
    /** Weeks 2–4 outline (ALG §11). */
    outline: jsonb("outline").$type<unknown[]>().notNull().default([]),
    algVersion: text("alg_version").notNull().default("alg-v1"),
    promptVersion: text("prompt_version"),
    model: text("model"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("study_plans_version_check", sql`${t.versionNumber} > 0`),
    check("study_plans_dates_check", sql`${t.endDate} >= ${t.startDate}`),
    check("study_plans_minutes_check", sql`${t.availableMinutes} > 0`),
    oneOf("study_plans_trigger_check", t.trigger, ["diagnostic", "retest", "paid_rebuild"]),
    oneOf("study_plans_status_check", t.status, ["draft", "active", "completed", "superseded"]),
    unique("study_plans_version_key").on(t.learnerId, t.versionNumber),
    index("study_plans_learner_status_idx").on(t.learnerId, t.status),
    index("study_plans_diagnosis_idx").on(t.diagnosisId),
    ownRowsPolicy("study_plans"),
  ],
);

export const planTasks = pgTable(
  "plan_tasks",
  {
    id: pk(),
    studyPlanId: uuid("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id),
    taskType: text("task_type").$type<"learn" | "revise" | "practice" | "retest" | "review">().notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    priority: integer("priority").notNull(),
    status: text("status").$type<"pending" | "completed" | "skipped" | "overdue">().notNull().default("pending"),
    orderIndex: integer("order_index").notNull(),
    /** One sentence, written by the model when available, neutral default otherwise (ALG §11). */
    action: text("action"),
    practiceQuestions: integer("practice_questions"),
    /** For a split task: which part of how many. */
    partIndex: integer("part_index"),
    partOf: integer("part_of"),
    completedAt: tstz("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("plan_tasks_minutes_check", sql`${t.estimatedMinutes} > 0`),
    check("plan_tasks_priority_check", sql`${t.priority} > 0`),
    oneOf("plan_tasks_type_check", t.taskType, ["learn", "revise", "practice", "retest", "review"]),
    oneOf("plan_tasks_status_check", t.status, ["pending", "completed", "skipped", "overdue"]),
    index("plan_tasks_plan_date_idx").on(t.studyPlanId, t.scheduledDate),
    index("plan_tasks_concept_idx").on(t.conceptId),
    pgPolicy("plan_tasks_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.studyPlanId} in (select id from public.study_plans where learner_id = (select private.current_learner_id()))`,
    }),
    pgPolicy("plan_tasks_own_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.studyPlanId} in (select id from public.study_plans where learner_id = (select private.current_learner_id()))`,
      withCheck: sql`${t.studyPlanId} in (select id from public.study_plans where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);

export const retests = pgTable(
  "retests",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    sourceInterventionId: uuid("source_intervention_id").references(() => interventions.id, { onDelete: "set null" }),
    baselineAttemptId: uuid("baseline_attempt_id")
      .notNull()
      .references(() => attempts.id),
    retestAttemptId: uuid("retest_attempt_id").references(() => attempts.id),
    studyPlanId: uuid("study_plan_id").references(() => studyPlans.id, { onDelete: "set null" }),
    targetConcepts: jsonb("target_concepts").$type<string[]>().notNull(),
    status: text("status").$type<"scheduled" | "available" | "completed" | "evaluated">().notNull().default("scheduled"),
    scheduledFor: tstz("scheduled_for"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("retests_status_check", t.status, ["scheduled", "available", "completed", "evaluated"]),
    index("retests_learner_idx").on(t.learnerId, t.status),
    index("retests_baseline_idx").on(t.baselineAttemptId),
    index("retests_result_idx").on(t.retestAttemptId),
    ownRowsPolicy("retests"),
  ],
);

export const retestResults = pgTable(
  "retest_results",
  {
    id: pk(),
    retestId: uuid("retest_id")
      .notNull()
      .unique()
      .references(() => retests.id, { onDelete: "cascade" }),
    baselineMastery: jsonb("baseline_mastery").$type<Record<string, number>>().notNull(),
    retestMastery: jsonb("retest_mastery").$type<Record<string, number>>().notNull(),
    deltaMastery: jsonb("delta_mastery").$type<Record<string, number>>().notNull(),
    /** Per concept: improved | stable | declined | insufficient_evidence. */
    outcomes: jsonb("outcomes").$type<Record<string, string>>().notNull().default({}),
    improvementStatus: text("improvement_status").$type<"improved" | "stable" | "declined" | "insufficient_evidence">().notNull(),
    algVersion: text("alg_version").notNull().default("alg-v1"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("retest_results_status_check", t.improvementStatus, ["improved", "stable", "declined", "insufficient_evidence"]),
    pgPolicy("retest_results_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.retestId} in (select id from public.retests where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);
