import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, oneOf, pk, readableByAuthenticated, tstz, updatedAt } from "./_helpers";

/*
  Curriculum graph (CONTEXT §6.2, TRD §5.2). A subject graph is authored once and cloned per
  exam track, so every exam owns its own concept rows (`clone_source_concept_id` keeps the
  trace) and its own `exam_importance` (BE-D70). Reference data: readable by any signed-in
  user, written only by admin services through `db.system`.
*/

export const exams = pgTable(
  "exams",
  {
    id: pk(),
    /** `jee_main`, `neet`, `cbse_11`. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    /** Label of the published curriculum, e.g. "v1". */
    version: text("version").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [readableByAuthenticated("exams")],
);

/** Versioned publishing of the graph (K7): drafts are edited, publishing writes vN+1 with a reason. */
export const curriculumVersions = pgTable(
  "curriculum_versions",
  {
    id: pk(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status").$type<"draft" | "published" | "superseded">().notNull().default("draft"),
    /** Pending edits while a draft (added/removed edges, changed weights). */
    edits: jsonb("edits").$type<Record<string, unknown>>().notNull().default({}),
    /** Full graph as published, for audit and rollback. */
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    reason: text("reason"),
    createdBy: uuid("created_by"),
    publishedBy: uuid("published_by"),
    publishedAt: tstz("published_at"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("curriculum_versions_exam_number_key").on(t.examId, t.versionNumber),
    check("curriculum_versions_number_check", sql`${t.versionNumber} > 0`),
    oneOf("curriculum_versions_status_check", t.status, ["draft", "published", "superseded"]),
    index("curriculum_versions_exam_idx").on(t.examId, t.status),
  ],
);

export const subjects = pgTable(
  "subjects",
  {
    id: pk(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("subjects_exam_name_key").on(t.examId, t.name), index("subjects_exam_id_idx").on(t.examId), readableByAuthenticated("subjects", sql`${t.active}`)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: pk(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** NCERT chapter label shown in the UI. */
    ncert: text("ncert"),
    orderIndex: integer("order_index").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("chapters_subject_name_key").on(t.subjectId, t.name), index("chapters_subject_id_idx").on(t.subjectId), readableByAuthenticated("chapters", sql`${t.active}`)],
);

export const topics = pgTable(
  "topics",
  {
    id: pk(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("topics_chapter_name_key").on(t.chapterId, t.name), index("topics_chapter_id_idx").on(t.chapterId), readableByAuthenticated("topics", sql`${t.active}`)],
);

export const concepts = pgTable(
  "concepts",
  {
    id: pk(),
    /** Denormalised from topic → chapter → subject so `code` can be unique per exam graph (BE-D70). */
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    /** Stable slug shared by the tracks' clones, e.g. `resolution`. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Track weight, 0–1 (E in the priority formula, ALG §7). */
    examImportance: numeric("exam_importance", { precision: 4, scale: 3, mode: "number" }).notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    cloneSourceConceptId: uuid("clone_source_concept_id"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("concepts_exam_code_key").on(t.examId, t.code),
    check("concepts_importance_check", sql`${t.examImportance} between 0 and 1`),
    check("concepts_minutes_check", sql`${t.estimatedMinutes} >= 0`),
    index("concepts_topic_id_idx").on(t.topicId),
    index("concepts_exam_id_idx").on(t.examId),
    readableByAuthenticated("concepts", sql`${t.active}`),
  ],
);

export const conceptEdges = pgTable(
  "concept_edges",
  {
    id: pk(),
    fromConceptId: uuid("from_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    toConceptId: uuid("to_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    /** `from` is a prerequisite of `to`. */
    edgeType: text("edge_type").$type<"prerequisite" | "related">().notNull().default("prerequisite"),
    weight: numeric("weight", { precision: 4, scale: 3, mode: "number" }).notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    check("concept_edges_no_self_check", sql`${t.fromConceptId} <> ${t.toConceptId}`),
    check("concept_edges_weight_check", sql`${t.weight} between 0 and 1`),
    oneOf("concept_edges_type_check", t.edgeType, ["prerequisite", "related"]),
    unique("concept_edges_pair_key").on(t.fromConceptId, t.toConceptId, t.edgeType),
    index("concept_edges_from_idx").on(t.fromConceptId),
    index("concept_edges_to_idx").on(t.toConceptId),
    readableByAuthenticated("concept_edges"),
  ],
);

