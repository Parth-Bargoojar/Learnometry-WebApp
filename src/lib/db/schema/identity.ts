import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgPolicy, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, oneOf, ownUserPolicy, pk, tstz, updatedAt } from "./_helpers";
import { payments } from "./billing";
import { exams, subjects } from "./curriculum";

export const USER_ROLES = ["learner", "guardian", "admin"] as const;
export const USER_STATUSES = ["active", "consent_pending", "suspended", "deletion_pending"] as const;
export const CLASS_LEVELS = ["class_11", "class_12", "dropper", "other"] as const;
export const ENGINES = ["fast", "standard"] as const;
export const THEMES = ["system", "light", "dark"] as const;
export const CONSENT_STATUSES = ["pending", "verified", "declined", "withdrawn", "expired"] as const;
export const CONSENT_METHODS = ["otp_email", "otp_sms", "inline_guardian_signup", "digilocker"] as const;

/** Application profile; `id` is the Supabase auth user id (created by the auth trigger, migration 2). */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text("email").unique(),
    displayName: text("display_name"),
    role: text("role").$type<(typeof USER_ROLES)[number]>().notNull().default("learner"),
    /** Required for learners (age gate, minimum 13). Sensitive: minimise use. */
    dateOfBirth: date("date_of_birth"),
    status: text("status").$type<(typeof USER_STATUSES)[number]>().notNull().default("active"),
    deactivatedAt: tstz("deactivated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("users_role_check", t.role, USER_ROLES),
    oneOf("users_status_check", t.status, USER_STATUSES),
    index("users_role_idx").on(t.role),
    pgPolicy("users_own_select", { for: "select", to: authenticatedRole, using: sql`${t.id} = (select auth.uid())` }),
    pgPolicy("users_own_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = (select auth.uid())`,
      withCheck: sql`${t.id} = (select auth.uid())`,
    }),
  ],
);

export const learners = pgTable(
  "learners",
  {
    id: pk(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    examId: uuid("exam_id").references(() => exams.id),
    subjectId: uuid("subject_id").references(() => subjects.id),
    /** Unit inside the subject, e.g. "Class 11 Mechanics". */
    unit: text("unit"),
    targetDate: date("target_date"),
    availableStudyMinutesPerDay: integer("available_study_minutes_per_day").notNull().default(60),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    /** Last completed step, for resume (BE-2.3). */
    onboardingStep: text("onboarding_step"),
    classLevel: text("class_level").$type<(typeof CLASS_LEVELS)[number]>(),
    enginePreference: text("engine_preference").$type<(typeof ENGINES)[number]>().notNull().default("fast"),
    /** 1.00, or 1.25 / 1.50 accommodation set by an admin (K15). */
    timerMultiplier: numeric("timer_multiplier", { precision: 3, scale: 2, mode: "number" }).notNull().default(1),
    theme: text("theme").$type<(typeof THEMES)[number]>().notNull().default("system"),
    /** Became eligible for the welcome grant: verified email, onboarded and, for minors, consented (BE-D36). */
    activatedAt: tstz("activated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("learners_minutes_check", sql`${t.availableStudyMinutesPerDay} >= 0`),
    check("learners_timer_check", sql`${t.timerMultiplier} in (1.00, 1.25, 1.50)`),
    check("learners_onboarded_needs_exam", sql`${t.onboardingCompleted} = false or ${t.examId} is not null`),
    oneOf("learners_class_level_check", t.classLevel, CLASS_LEVELS),
    oneOf("learners_engine_check", t.enginePreference, ENGINES),
    oneOf("learners_theme_check", t.theme, THEMES),
    index("learners_user_id_idx").on(t.userId),
    index("learners_exam_id_idx").on(t.examId),
    pgPolicy("learners_own_select", { for: "select", to: authenticatedRole, using: sql`${t.userId} = (select auth.uid())` }),
    pgPolicy("learners_own_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = (select auth.uid())`,
      withCheck: sql`${t.userId} = (select auth.uid())`,
    }),
  ],
);

export const guardianRelationships = pgTable(
  "guardian_relationships",
  {
    id: pk(),
    guardianUserId: uuid("guardian_user_id").references(() => users.id, { onDelete: "set null" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    guardianName: text("guardian_name").notNull(),
    /** AES-256-GCM ciphertext (PII_ENCRYPTION_KEY); never selectable by clients. */
    guardianContact: text("guardian_contact").notNull(),
    contactType: text("contact_type").$type<"email" | "phone">().notNull(),
    relationshipType: text("relationship_type").notNull(),
    consentStatus: text("consent_status").$type<(typeof CONSENT_STATUSES)[number]>().notNull().default("pending"),
    consentMethod: text("consent_method").$type<(typeof CONSENT_METHODS)[number]>(),
    consentPolicyVersion: text("consent_policy_version"),
    consentIpHash: text("consent_ip_hash"),
    consentVerifiedAt: tstz("consent_verified_at"),
    /** created + 7 days; pending learner data is deleted after this (D4). */
    pendingExpiresAt: tstz("pending_expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("guardian_contact_type_check", t.contactType, ["email", "phone"]),
    oneOf("guardian_consent_status_check", t.consentStatus, CONSENT_STATUSES),
    oneOf("guardian_consent_method_check", t.consentMethod, CONSENT_METHODS),
    index("guardian_relationships_guardian_user_id_idx").on(t.guardianUserId),
    index("guardian_relationships_learner_id_idx").on(t.learnerId),
    pgPolicy("guardian_relationships_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.guardianUserId} = (select auth.uid()) or ${t.learnerId} = (select private.current_learner_id())`,
    }),
  ],
);

export const consentTokens = pgTable(
  "consent_tokens",
  {
    id: pk(),
    guardianRelationshipId: uuid("guardian_relationship_id")
      .notNull()
      .references(() => guardianRelationships.id, { onDelete: "cascade" }),
    /** SHA-256 of the 32-byte token; the raw token exists only in the emailed link (BE-D21). */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: tstz("expires_at").notNull(),
    usedAt: tstz("used_at"),
    /** HMAC-SHA256 of the 6-digit OTP with CONSENT_TOKEN_SECRET. */
    otpHash: text("otp_hash"),
    otpExpiresAt: tstz("otp_expires_at"),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    sendsToday: integer("sends_today").notNull().default(0),
    lastSentAt: tstz("last_sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("consent_tokens_attempts_check", sql`${t.otpAttempts} between 0 and 5`),
    check("consent_tokens_sends_check", sql`${t.sendsToday} between 0 and 5`),
    index("consent_tokens_relationship_idx").on(t.guardianRelationshipId),
    // Server only: no client policy.
  ],
);

export const purchaseApprovals = pgTable(
  "purchase_approvals",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    guardianRelationshipId: uuid("guardian_relationship_id")
      .notNull()
      .references(() => guardianRelationships.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"plan_pass" | "credit_pack">().notNull(),
    itemCode: text("item_code").notNull(),
    amountInr: integer("amount_inr").notNull(),
    status: text("status").$type<"requested" | "approved" | "declined" | "expired" | "paid" | "cancelled">().notNull().default("requested"),
    expiresAt: tstz("expires_at").notNull(),
    paymentId: uuid("payment_id").references((): AnyPgColumn => payments.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("purchase_approvals_amount_check", sql`${t.amountInr} >= 0`),
    oneOf("purchase_approvals_item_type_check", t.itemType, ["plan_pass", "credit_pack"]),
    oneOf("purchase_approvals_status_check", t.status, ["requested", "approved", "declined", "expired", "paid", "cancelled"]),
    index("purchase_approvals_learner_idx").on(t.learnerId, t.status),
    index("purchase_approvals_relationship_idx").on(t.guardianRelationshipId),
    pgPolicy("purchase_approvals_read", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.learnerId} = (select private.current_learner_id()) or ${t.guardianRelationshipId} in (select private.guardian_relationship_ids())`,
    }),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Existing `NotificationKind`: plan, diagnosis, retest, credits, payment, guardian. */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    ownUserPolicy("notifications", "user_id", "select"),
    ownUserPolicy("notifications", "user_id", "update"),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** J9: retest ready (on), plan updated (on), weekly summary (off). Payments and account mail is always sent. */
    emailRetestReady: boolean("email_retest_ready").notNull().default(true),
    emailPlanUpdated: boolean("email_plan_updated").notNull().default(true),
    emailWeeklySummary: boolean("email_weekly_summary").notNull().default(false),
    pushRetestReady: boolean("push_retest_ready").notNull().default(true),
    pushDailyReminder: boolean("push_daily_reminder").notNull().default(true),
    updatedAt: updatedAt(),
  },
  () => [ownUserPolicy("notification_preferences", "user_id", "all")],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId), ownUserPolicy("push_subscriptions", "user_id", "all")],
);

