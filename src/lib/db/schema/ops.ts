import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgPolicy, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, oneOf, pk, tstz, updatedAt } from "./_helpers";
import { learners, users } from "./identity";

/*
  Operations: AI accounting, audit, flags, analytics, limits, privacy requests, abuse and the
  development mail outbox. Server only, except that a user can read their own data requests.
*/

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: pk(),
    /** Anonymised to null when the account is erased (BE-D58). */
    learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    tier: text("tier").$type<"fast" | "standard" | "reasoning">(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    estimatedCostInr: numeric("estimated_cost_inr", { precision: 12, scale: 6, mode: "number" }).notNull().default(0),
    creditsCharged: integer("credits_charged").notNull().default(0),
    latencyMs: integer("latency_ms"),
    status: text("status").$type<"queued" | "running" | "succeeded" | "failed" | "fallback">().notNull().default("queued"),
    errorCode: text("error_code"),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("ai_requests_status_check", t.status, ["queued", "running", "succeeded", "failed", "fallback"]),
    check("ai_requests_counts_check", sql`${t.inputTokens} >= 0 and ${t.outputTokens} >= 0 and ${t.cachedTokens} >= 0`),
    index("ai_requests_learner_idx").on(t.learnerId, t.createdAt),
    index("ai_requests_operation_idx").on(t.operation, t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    actorUserId: uuid("actor_user_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    /** Every admin mutation carries a written reason (K2). */
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_resource_idx").on(t.resourceType, t.resourceId, t.createdAt),
    index("audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: pk(),
    key: text("key").notNull().unique(),
    enabled: boolean("enabled").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

/** First-party analytics, all ages; adults are mirrored to PostHog by a job (BE-D47). */
export const productEvents = pgTable(
  "product_events",
  {
    id: pk(),
    name: text("name").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "set null" }),
    isMinor: boolean("is_minor").notNull().default(false),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    mirroredAt: tstz("mirrored_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_events_name_idx").on(t.name, t.createdAt),
    index("product_events_mirror_idx").on(t.mirroredAt, t.createdAt),
    index("product_events_learner_idx").on(t.learnerId, t.createdAt),
    index("product_events_user_idx").on(t.userId),
  ],
);

/** Fixed-window counters for sensitive limits (BE-D27): one upsert per hit. */
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    key: text("key").notNull(),
    windowStart: tstz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limit_counters_window_idx").on(t.windowStart)],
);

export const dataRequests = pgTable(
  "data_requests",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestType: text("request_type").$type<"export" | "erasure">().notNull(),
    status: text("status").$type<"requested" | "processing" | "completed" | "failed" | "cancelled">().notNull().default("requested"),
    /** Export: 7 business days. Erasure: 7 business days after the request (BE-D58/59). */
    dueBy: tstz("due_by").notNull(),
    completedAt: tstz("completed_at"),
    filePath: text("file_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("data_requests_type_check", t.requestType, ["export", "erasure"]),
    oneOf("data_requests_status_check", t.status, ["requested", "processing", "completed", "failed", "cancelled"]),
    index("data_requests_user_idx").on(t.userId, t.createdAt),
    index("data_requests_due_idx").on(t.status, t.dueBy),
    pgPolicy("data_requests_own_select", { for: "select", to: authenticatedRole, using: sql`${t.userId} = (select auth.uid())` }),
  ],
);

/** Flags for a person to review; never a trigger for automatic action (K10). */
export const abuseFlags = pgTable(
  "abuse_flags",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<"open" | "reviewed" | "dismissed">().notNull().default("open"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: tstz("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [oneOf("abuse_flags_status_check", t.status, ["open", "reviewed", "dismissed"]), index("abuse_flags_status_idx").on(t.status, t.createdAt), index("abuse_flags_learner_idx").on(t.learnerId)],
);

/** Development and test mail (BE-D44): read by E2E to fetch OTPs and links. Empty in production. */
export const devOutbox = pgTable(
  "dev_outbox",
  {
    id: pk(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("dev_outbox_to_idx").on(t.toEmail, t.createdAt)],
);
