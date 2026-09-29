import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSION_DENIED, asAnon, asUser, cleanupUsers, db, errorCode, pg } from "./helpers";
import { buildStory, type Story } from "./fixtures";

/*
  RLS denial matrix (BE-1.6). For every table: who can read, who cannot, and that clients
  cannot write what only the server may write. Add a row here with every new table — the
  "every table is covered" test below fails until you do.
*/
let story: Story;
beforeAll(async () => {
  story = await buildStory();
}, 120_000);
afterAll(async () => {
  await cleanupUsers();
});

const count = async (userId: string | "anon", table: string, where = "true") => {
  const run = (tx: Tx) => tx.execute(sql.raw(`select count(*)::int as n from public.${table} where ${where}`));
  const rows = userId === "anon" ? await asAnon(run) : await asUser(userId, run);
  return (rows as unknown as { n: number }[])[0].n;
};

/** Tables holding a learner's own rows: [table, SQL scoping the rows to learner A]. */
const learnerOwned = (): [string, string][] => {
  const A = story.ids.learnerA;
  return [
    ["learners", `id = '${A}'`],
    ["assessments", `learner_id = '${A}'`],
    ["assessment_items", `assessment_id = '${story.ids.assessment}'`],
    ["attempts", `learner_id = '${A}'`],
    ["responses", `attempt_id = '${story.ids.attempt}'`],
    ["student_concept_state", `learner_id = '${A}'`],
    ["diagnoses", `learner_id = '${A}'`],
    ["interventions", `learner_id = '${A}'`],
    ["study_plans", `learner_id = '${A}'`],
    ["plan_tasks", `study_plan_id = '${story.ids.plan}'`],
    ["retests", `learner_id = '${A}'`],
    ["retest_results", `retest_id = '${story.ids.retest}'`],
    ["payments", `learner_id = '${A}'`],
    ["subscriptions", `learner_id = '${A}'`],
    ["credit_accounts", `learner_id = '${A}'`],
    ["credit_lots", `credit_account_id = '${story.ids.account}'`],
    ["credit_transactions", `credit_account_id = '${story.ids.account}'`],
    ["credit_reservations", `credit_account_id = '${story.ids.account}'`],
    ["coupon_redemptions", `learner_id = '${A}'`],
    ["purchase_approvals", `learner_id = '${A}'`],
    ["guardian_relationships", `learner_id = '${A}'`],
  ];
};

/** Tables keyed by user id. */
const userOwned = (): [string, string][] => [
  ["users", `id = '${story.a.id}'`],
  ["notifications", `user_id = '${story.a.id}'`],
  ["notification_preferences", `user_id = '${story.a.id}'`],
  ["push_subscriptions", `user_id = '${story.a.id}'`],
  ["data_requests", `user_id = '${story.a.id}'`],
  ["refund_requests", `requested_by = '${story.a.id}'`],
];

/** Reference data any signed-in user may read; anonymous callers may not. */
const reference = ["exams", "subjects", "chapters", "topics", "concepts", "concept_edges", "plans"];

/** Server only: no client, learner or otherwise, may even read them. */
const serverOnly = [
  "questions", "question_versions", "question_validations", "consent_tokens", "curriculum_versions", "coupons",
  "payment_events", "ai_requests", "audit_logs", "feature_flags", "product_events", "rate_limit_counters",
  "abuse_flags", "dev_outbox",
];

describe("every table is in the matrix", () => {
  it("covers all public tables", async () => {
    const all = (await pg<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`).map((r) => r.tablename);
    const covered = new Set([...learnerOwned().map(([t]) => t), ...userOwned().map(([t]) => t), ...reference, ...serverOnly]);
    expect(all.filter((t) => !covered.has(t)).sort()).toEqual([]);
    expect([...covered].filter((t) => !all.includes(t))).toEqual([]);
  });
});

describe("learner-owned tables", () => {
  it("the owner sees their rows", async () => {
    for (const [table, where] of learnerOwned()) {
      if (table === "guardian_relationships") continue; // owner reads via the column-limited grant below
      expect(await count(story.a.id, table, where), `${table} (owner)`).toBeGreaterThan(0);
    }
  });

  it("another learner sees none of them", async () => {
    for (const [table, where] of learnerOwned()) {
      expect(await count(story.b.id, table, where), `${table} (other learner)`).toBe(0);
    }
  });

  it("a guardian and a stranger read no raw learner table (summaries only)", async () => {
    for (const [table, where] of learnerOwned()) {
      if (table === "guardian_relationships" || table === "purchase_approvals") continue; // covered by their own tests
      expect(await count(story.guardian.id, table, where), `${table} (guardian)`).toBe(0);
      expect(await count(story.stranger.id, table, where), `${table} (stranger)`).toBe(0);
    }
  });

  it("anonymous callers are denied outright", async () => {
    for (const [table] of learnerOwned()) {
      expect(await errorCode(count("anon", table)), `${table} (anon)`).toBe(PERMISSION_DENIED);
    }
  });
});

describe("user-owned tables", () => {
  it("owner reads, others and anon do not", async () => {
    for (const [table, where] of userOwned()) {
      expect(await count(story.a.id, table, where), `${table} (owner)`).toBeGreaterThan(0);
      expect(await count(story.b.id, table, where), `${table} (other)`).toBe(0);
      expect(await errorCode(count("anon", table)), `${table} (anon)`).toBe(PERMISSION_DENIED);
    }
  });
});

describe("reference data", () => {
  it("is readable when signed in and denied to anon", async () => {
    for (const table of reference) {
      expect(await count(story.b.id, table), table).toBeGreaterThan(0);
      expect(await errorCode(count("anon", table)), `${table} (anon)`).toBe(PERMISSION_DENIED);
    }
  });
});

describe("server-only tables", () => {
  it("are unreadable to every client role, including the owner of the related data", async () => {
    for (const table of serverOnly) {
      expect(await errorCode(count(story.a.id, table)), `${table} (learner)`).toBe(PERMISSION_DENIED);
      expect(await errorCode(count(story.guardian.id, table)), `${table} (guardian)`).toBe(PERMISSION_DENIED);
      expect(await errorCode(count("anon", table)), `${table} (anon)`).toBe(PERMISSION_DENIED);
    }
  });
});

describe("clients cannot write server-authoritative data", () => {
  const tryWrite = (userId: string, statement: string) => errorCode(asUser(userId, (tx) => tx.execute(sql.raw(statement))));

  it("cannot touch credits, payments or subscriptions", async () => {
    for (const st of [
      `insert into credit_lots (credit_account_id, bucket, amount, remaining) values ('${story.ids.account}', 'promotional', 999, 999)`,
      `update credit_accounts set balance = 99999 where id = '${story.ids.account}'`,
      `update credit_lots set remaining = 200 where id = '${story.ids.lot}'`,
      `delete from credit_transactions where credit_account_id = '${story.ids.account}'`,
      `update payments set status = 'captured' where id = '${story.ids.payment}'`,
      `update subscriptions set status = 'active' where id = '${story.ids.subscription}'`,
      `insert into payments (learner_id, item_type, item_code, amount_inr, status) values ('${story.ids.learnerA}', 'plan_pass', 'pro', 349, 'captured')`,
    ]) {
      expect(await tryWrite(story.a.id, st), st).toBe(PERMISSION_DENIED);
    }
  });

  it("cannot forge scores, grading or roles", async () => {
    for (const st of [
      `update attempts set score = 100, percentage = 100 where id = '${story.ids.attempt}'`,
      `update responses set is_correct = true where id = '${story.ids.response}'`,
      `update users set role = 'admin' where id = '${story.a.id}'`,
      `update users set date_of_birth = '1990-01-01' where id = '${story.a.id}'`,
      `update learners set onboarding_completed = true, activated_at = now() where id = '${story.ids.learnerA}'`,
      `update learners set timer_multiplier = 1.50 where id = '${story.ids.learnerA}'`,
      `update learners set exam_id = null where id = '${story.ids.learnerA}'`,
      `update plan_tasks set estimated_minutes = 1 where id = '${story.ids.task}'`,
      `update guardian_relationships set consent_status = 'verified' where id = '${story.ids.relationship}'`,
      `update purchase_approvals set status = 'approved' where id = '${story.ids.approval}'`,
      `insert into diagnoses (learner_id, assessment_id, attempt_id) values ('${story.ids.learnerA}', '${story.ids.assessment}', '${story.ids.attempt}')`,
    ]) {
      expect(await tryWrite(story.a.id, st), st).toBe(PERMISSION_DENIED);
    }
  });

  it("cannot read the guardian's encrypted contact", async () => {
    expect(await errorCode(asUser(story.a.id, (tx) => tx.execute(sql.raw(`select guardian_contact from guardian_relationships`))))).toBe(PERMISSION_DENIED);
    expect(await errorCode(asUser(story.a.id, (tx) => tx.execute(sql.raw(`select guardian_name, consent_status from guardian_relationships where learner_id = '${story.ids.learnerA}'`))))).toBeNull();
  });

  it("can change their own preferences, and only their own", async () => {
    const own = await asUser(story.a.id, (tx) => tx.execute(sql.raw(`update learners set theme = 'dark' where id = '${story.ids.learnerA}' returning id`)));
    expect(own.length).toBe(1);
    const other = await asUser(story.b.id, (tx) => tx.execute(sql.raw(`update learners set theme = 'light' where id = '${story.ids.learnerA}' returning id`)));
    expect(other.length).toBe(0);
    const task = await asUser(story.a.id, (tx) => tx.execute(sql.raw(`update plan_tasks set status = 'completed', completed_at = now() where id = '${story.ids.task}' returning id`)));
    expect(task.length).toBe(1);
    const stolen = await asUser(story.b.id, (tx) => tx.execute(sql.raw(`update plan_tasks set status = 'skipped' where id = '${story.ids.task}' returning id`)));
    expect(stolen.length).toBe(0);
  });
});

describe("answer saving (responses)", () => {
  it("the owner can save answers to an in-progress attempt", async () => {
    const res = await asUser(story.a.id, (tx) =>
      tx.execute(sql.raw(`update responses set selected_answer = '{"key":"A"}', client_seq = 2 where id = '${story.ids.response}' returning id`)),
    );
    expect(res.length).toBe(1);
  });

  it("another learner cannot write to it", async () => {
    const res = await asUser(story.b.id, (tx) =>
      tx.execute(sql.raw(`update responses set selected_answer = '{"key":"A"}' where id = '${story.ids.response}' returning id`)),
    );
    expect(res.length).toBe(0);
    const insert = await errorCode(
      asUser(story.b.id, (tx) =>
        tx.execute(sql.raw(`insert into responses (attempt_id, assessment_item_id) values ('${story.ids.attempt}', '${story.ids.item}') on conflict do nothing`)),
      ),
    );
    expect(insert).toBe(PERMISSION_DENIED);
  });

  it("nobody can save once the attempt is submitted", async () => {
    await db.execute(sql.raw(`update attempts set status = 'submitted', submitted_at = now() where id = '${story.ids.attempt}'`));
    try {
      const res = await asUser(story.a.id, (tx) =>
        tx.execute(sql.raw(`update responses set selected_answer = '{"key":"A"}' where id = '${story.ids.response}' returning id`)),
      );
      expect(res.length).toBe(0);
    } finally {
      await db.execute(sql.raw(`update attempts set status = 'in_progress', submitted_at = null where id = '${story.ids.attempt}'`));
    }
  });
});
