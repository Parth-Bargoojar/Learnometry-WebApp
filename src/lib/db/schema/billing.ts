import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgPolicy, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, oneOf, ownRowsPolicy, pk, readableByAuthenticated, tstz, updatedAt } from "./_helpers";
import { learners, users } from "./identity";

/*
  Plans, credits and payments (CONTEXT §6.7, BE-D33–D38). Money and credit state is
  server-authoritative: learners can read their own rows and can write none of them. All
  writes go through the ledger and billing services on `db.system`, in one transaction.
  Money is whole rupees (BE-D23).
*/

export const CREDIT_BUCKETS = ["daily_plan", "free_monthly", "promotional", "purchased"] as const;
export const CREDIT_TXN_TYPES = ["subscription_grant", "promotion_grant", "purchase", "consumption", "refund", "expiration", "adjustment", "reversal"] as const;

export const plans = pgTable(
  "plans",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    priceInr: integer("price_inr").notNull(),
    passDays: integer("pass_days"),
    creditPeriod: text("credit_period").$type<"monthly" | "daily">().notNull(),
    periodCredits: integer("period_credits").notNull(),
    welcomeCredits: integer("welcome_credits").notNull().default(0),
    enginePolicy: text("engine_policy").$type<"fast_only" | "learner_choice" | "auto" | "auto_extended">().notNull(),
    queuePriority: integer("queue_priority").notNull().default(0),
    planAdaptation: text("plan_adaptation").$type<"retest_only" | "after_practice" | "daily">().notNull(),
    deepDiagnostic: boolean("deep_diagnostic").notNull().default(false),
    recommended: boolean("recommended").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("plans_price_check", sql`${t.priceInr} >= 0`),
    check("plans_credits_check", sql`${t.periodCredits} >= 0 and ${t.welcomeCredits} >= 0`),
    oneOf("plans_period_check", t.creditPeriod, ["monthly", "daily"]),
    oneOf("plans_engine_check", t.enginePolicy, ["fast_only", "learner_choice", "auto", "auto_extended"]),
    oneOf("plans_adaptation_check", t.planAdaptation, ["retest_only", "after_practice", "daily"]),
    readableByAuthenticated("plans", sql`${t.active}`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: pk(),
    /** Set to null when the learner is erased: the payment row stays for invoicing (BE-D58). */
    learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "set null" }),
    /** Who paid: the learner, or the guardian for a minor. */
    payerUserId: uuid("payer_user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull().default("razorpay"),
    providerPaymentId: text("provider_payment_id").unique(),
    providerOrderId: text("provider_order_id"),
    itemType: text("item_type").$type<"plan_pass" | "credit_pack">().notNull(),
    itemCode: text("item_code").notNull(),
    amountInr: integer("amount_inr").notNull(),
    refundedInr: integer("refunded_inr").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    status: text("status").$type<"created" | "authorized" | "captured" | "failed" | "refunded">().notNull().default("created"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("payments_amount_check", sql`${t.amountInr} >= 0 and ${t.refundedInr} >= 0 and ${t.refundedInr} <= ${t.amountInr}`),
    oneOf("payments_item_type_check", t.itemType, ["plan_pass", "credit_pack"]),
    oneOf("payments_status_check", t.status, ["created", "authorized", "captured", "failed", "refunded"]),
    index("payments_learner_idx").on(t.learnerId, t.createdAt),
    index("payments_order_idx").on(t.providerOrderId),
    index("payments_payer_idx").on(t.payerUserId),
    pgPolicy("payments_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.learnerId} = (select private.current_learner_id()) or ${t.payerUserId} = (select auth.uid())`,
    }),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    provider: text("provider").notNull().default("razorpay"),
    providerSubscriptionId: text("provider_subscription_id").unique(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    status: text("status").$type<"active" | "renewal_failed" | "cancelled" | "expired" | "refunded">().notNull().default("active"),
    currentPeriodStart: tstz("current_period_start").notNull(),
    currentPeriodEnd: tstz("current_period_end").notNull(),
    scheduledPlanId: uuid("scheduled_plan_id").references(() => plans.id),
    firstPaymentAt: tstz("first_payment_at").notNull(),
    payerUserId: uuid("payer_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("subscriptions_status_check", t.status, ["active", "renewal_failed", "cancelled", "expired", "refunded"]),
    check("subscriptions_period_check", sql`${t.currentPeriodEnd} > ${t.currentPeriodStart}`),
    index("subscriptions_learner_idx").on(t.learnerId, t.status),
    index("subscriptions_period_end_idx").on(t.status, t.currentPeriodEnd),
    index("subscriptions_payer_idx").on(t.payerUserId),
    pgPolicy("subscriptions_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.learnerId} = (select private.current_learner_id()) or ${t.payerUserId} = (select auth.uid())`,
    }),
  ],
);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: pk(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    creditsUsedPct: numeric("credits_used_pct", { precision: 5, scale: 2, mode: "number" }).notNull(),
    status: text("status").$type<"requested" | "approved" | "rejected" | "processed">().notNull().default("requested"),
    /** True when an admin approved a request outside the 7-day / 20% policy (K5). */
    exception: boolean("exception").notNull().default(false),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: tstz("decided_at"),
    providerRefundId: text("provider_refund_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("refund_requests_status_check", t.status, ["requested", "approved", "rejected", "processed"]),
    index("refund_requests_status_idx").on(t.status, t.createdAt),
    index("refund_requests_payment_idx").on(t.paymentId),
    index("refund_requests_subscription_idx").on(t.subscriptionId),
    pgPolicy("refund_requests_own_select", { for: "select", to: authenticatedRole, using: sql`${t.requestedBy} = (select auth.uid())` }),
  ],
);

export const creditAccounts = pgTable(
  "credit_accounts",
  {
    id: pk(),
    learnerId: uuid("learner_id")
      .notNull()
      .unique()
      .references(() => learners.id, { onDelete: "cascade" }),
    /** Σ unexpired lot `remaining`, maintained in the same transaction as every lot change (BE-D33). */
    balance: integer("balance").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check("credit_accounts_balance_check", sql`${t.balance} >= 0`), ownRowsPolicy("credit_accounts")],
);

export const creditLots = pgTable(
  "credit_lots",
  {
    id: pk(),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    bucket: text("bucket").$type<(typeof CREDIT_BUCKETS)[number]>().notNull(),
    amount: integer("amount").notNull(),
    remaining: integer("remaining").notNull(),
    /** Null = never expires. */
    expiresAt: tstz("expires_at"),
    /** Natural key of the grant (`welcome`, `monthly:2026-09`, `daily:2026-09-30`, `payment:<id>`): grants are idempotent (BE-D35/36). */
    grantKey: text("grant_key"),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [
    check("credit_lots_amount_check", sql`${t.amount} > 0`),
    check("credit_lots_remaining_check", sql`${t.remaining} >= 0 and ${t.remaining} <= ${t.amount}`),
    oneOf("credit_lots_bucket_check", t.bucket, CREDIT_BUCKETS),
    unique("credit_lots_grant_key").on(t.creditAccountId, t.grantKey),
    index("credit_lots_spend_idx").on(t.creditAccountId, t.expiresAt),
    pgPolicy("credit_lots_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.creditAccountId} in (select id from public.credit_accounts where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);

export const creditReservations = pgTable(
  "credit_reservations",
  {
    id: pk(),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    status: text("status").$type<"reserved" | "settled" | "released" | "expired">().notNull().default("reserved"),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    /** Same key within 24 h returns the first result (BE-D35). */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
    expiresAt: tstz("expires_at").notNull(),
    settledAt: tstz("settled_at"),
    releasedAt: tstz("released_at"),
  },
  (t) => [
    check("credit_reservations_amount_check", sql`${t.amount} > 0`),
    oneOf("credit_reservations_status_check", t.status, ["reserved", "settled", "released", "expired"]),
    unique("credit_reservations_idem_key").on(t.creditAccountId, t.idempotencyKey),
    index("credit_reservations_sweep_idx").on(t.status, t.expiresAt),
    index("credit_reservations_reference_idx").on(t.referenceType, t.referenceId),
    pgPolicy("credit_reservations_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.creditAccountId} in (select id from public.credit_accounts where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: pk(),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    /** The lot this row moved credits in or out of. */
    lotId: uuid("lot_id").references(() => creditLots.id),
    reservationId: uuid("reservation_id").references(() => creditReservations.id),
    bucket: text("bucket").$type<(typeof CREDIT_BUCKETS)[number]>().notNull(),
    transactionType: text("transaction_type").$type<(typeof CREDIT_TXN_TYPES)[number]>().notNull(),
    /** Positive for grants and refunds, negative for consumption and expiry. */
    amount: integer("amount").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    description: text("description"),
    expiresAt: tstz("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("credit_transactions_amount_check", sql`${t.amount} <> 0`),
    oneOf("credit_transactions_bucket_check", t.bucket, CREDIT_BUCKETS),
    oneOf("credit_transactions_type_check", t.transactionType, CREDIT_TXN_TYPES),
    index("credit_transactions_account_idx").on(t.creditAccountId, t.createdAt),
    index("credit_transactions_lot_idx").on(t.lotId),
    index("credit_transactions_reference_idx").on(t.referenceType, t.referenceId),
    pgPolicy("credit_transactions_own_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.creditAccountId} in (select id from public.credit_accounts where learner_id = (select private.current_learner_id()))`,
    }),
  ],
);

export const coupons = pgTable(
  "coupons",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    discountType: text("discount_type").$type<"percentage" | "fixed">().notNull(),
    discountValue: integer("discount_value").notNull(),
    bonusCredits: integer("bonus_credits").notNull().default(0),
    maxRedemptions: integer("max_redemptions"),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    /** Passes only, first paid pass only (B-decisions, BE-10). */
    firstPassOnly: boolean("first_pass_only").notNull().default(true),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("coupons_value_check", sql`${t.discountValue} >= 0 and ${t.bonusCredits} >= 0 and ${t.perUserLimit} >= 1`),
    check("coupons_percentage_check", sql`${t.discountType} <> 'percentage' or ${t.discountValue} <= 100`),
    check("coupons_dates_check", sql`${t.endsAt} > ${t.startsAt}`),
    oneOf("coupons_type_check", t.discountType, ["percentage", "fixed"]),
  ],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: pk(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    discountAmountInr: integer("discount_amount_inr").notNull(),
    bonusCredits: integer("bonus_credits").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("coupon_redemptions_amount_check", sql`${t.discountAmountInr} >= 0 and ${t.bonusCredits} >= 0`),
    index("coupon_redemptions_coupon_idx").on(t.couponId),
    index("coupon_redemptions_learner_idx").on(t.learnerId),
    ownRowsPolicy("coupon_redemptions"),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: pk(),
    provider: text("provider").notNull(),
    /** Provider event id: the idempotency key of webhook processing (BE-D35). */
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    processedAt: tstz("processed_at"),
    processingStatus: text("processing_status").$type<"received" | "processed" | "failed" | "ignored">().notNull().default("received"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("payment_events_status_check", t.processingStatus, ["received", "processed", "failed", "ignored"]),
    index("payment_events_status_idx").on(t.processingStatus, t.createdAt),
  ],
);
