import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/lib/db/schema";
import { asUser, cleanupUsers, createUser, db, errorCode, pg } from "./helpers";
import { buildStory, type Story } from "./fixtures";

afterAll(async () => {
  await cleanupUsers();
});

describe("database hygiene", () => {
  it("has row level security enabled on every public table", async () => {
    const off = await pg<{ tablename: string }[]>`
      select c.relname as tablename from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(off).toEqual([]);
  });

  it("grants nothing to anon on public tables and nothing writable to authenticated beyond the allow-list", async () => {
    const anon = await pg<{ table_name: string }[]>`
      select distinct table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`;
    expect(anon).toEqual([]);
    const writes = await pg<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')
      order by 1, 2`;
    const tables = [...new Set(writes.map((w) => w.table_name))].sort();
    // Whole-table writes are limited to these; column-level UPDATE grants do not appear here.
    expect(tables).toEqual(["notification_preferences", "push_subscriptions"]);
  });

  it("keeps an updated_at trigger on every table that has the column", async () => {
    const missing = await pg<{ table_name: string }[]>`
      select c.table_name from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'updated_at'
        and not exists (
          select 1 from pg_trigger t join pg_class r on r.oid = t.tgrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'public' and r.relname = c.table_name and t.tgname = 'touch_updated_at')`;
    expect(missing).toEqual([]);
  });

  it("indexes every foreign key column used for lookups", async () => {
    // A foreign key with no leading index makes deletes and joins scan. List them so new ones get a decision.
    const rows = await pg<{ table_name: string; column_name: string }[]>`
      select cl.relname as table_name, a.attname as column_name
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (
          select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
      order by 1, 2`;
    const uncovered = rows.map((r) => `${r.table_name}.${r.column_name}`);
    // Deliberately unindexed: admin-only columns, tiny tables and lookups that never filter on the column alone.
    const allowed = new Set([
      "abuse_flags.reviewed_by", "refund_requests.decided_by", "refund_requests.requested_by", "coupon_redemptions.payment_id",
      "purchase_approvals.payment_id", "credit_transactions.reservation_id", "interventions.concept_id", "learners.subject_id",
      "questions.chapter_id", "questions.subject_id", "questions.topic_id", "retests.source_intervention_id",
      "retests.study_plan_id", "student_concept_state.concept_id", "study_plans.supersedes_plan_id",
      "subscriptions.plan_id", "subscriptions.scheduled_plan_id",
    ]);
    expect(uncovered.filter((c) => !allowed.has(c))).toEqual([]);
  });
});

describe("sign-up trigger", () => {
  it("creates the profile, a learner and a credit account with a zero balance", async () => {
    const u = await createUser("learner", "  Ada Lovelace ");
    const [profile] = await db.select().from(s.users).where(sql`id = ${u.id}`);
    expect(profile).toMatchObject({ role: "learner", displayName: "Ada Lovelace", status: "active", dateOfBirth: null });
    expect(u.learnerId).toBeTruthy();
    const [account] = await db.select().from(s.creditAccounts).where(sql`learner_id = ${u.learnerId}`);
    expect(account.balance).toBe(0);
  });

  it("creates a guardian without a learner row", async () => {
    const g = await createUser("guardian", "Gia");
    expect(g.learnerId).toBeNull();
    const [profile] = await db.select().from(s.users).where(sql`id = ${g.id}`);
    expect(profile.role).toBe("guardian");
  });

  it("never lets sign-up metadata create an admin", async () => {
    const u = await createUser("admin", "Mallory");
    const [profile] = await db.select().from(s.users).where(sql`id = ${u.id}`);
    expect(profile.role).toBe("learner");
  });

  it("keeps the profile email in step with auth", async () => {
    const u = await createUser("learner");
    const next = `changed-${u.email}`;
    await pg`update auth.users set email = ${next} where id = ${u.id}`;
    const [profile] = await db.select().from(s.users).where(sql`id = ${u.id}`);
    expect(profile.email).toBe(next);
  });
});

describe("constraints and integrity triggers", () => {
  let story: Story;
  beforeAll(async () => {
    story = await buildStory();
  }, 120_000);

  const run = (statement: string) => errorCode(db.execute(sql.raw(statement)));

  it("keeps balances and lots non-negative and consistent", async () => {
    expect(await run(`update credit_accounts set balance = -1 where id = '${story.ids.account}'`)).toBe("23514");
    expect(await run(`update credit_lots set remaining = 201 where id = '${story.ids.lot}'`)).toBe("23514");
    expect(await run(`update credit_lots set remaining = -1 where id = '${story.ids.lot}'`)).toBe("23514");
    expect(await run(`insert into credit_lots (credit_account_id, bucket, amount, remaining) values ('${story.ids.account}', 'purchased', 0, 0)`)).toBe("23514");
    expect(await run(`insert into credit_lots (credit_account_id, bucket, amount, remaining) values ('${story.ids.account}', 'gift', 5, 5)`)).toBe("23514");
  });

  it("makes grants idempotent by key", async () => {
    const stmt = `insert into credit_lots (credit_account_id, bucket, amount, remaining, grant_key) values ('${story.ids.account}', 'daily_plan', 200, 200, 'daily:test')`;
    expect(await run(stmt)).toBe("23505");
  });

  it("makes reservations idempotent per account and key", async () => {
    const stmt = `select idempotency_key from credit_reservations where credit_account_id = '${story.ids.account}' limit 1`;
    const [{ idempotency_key }] = (await db.execute(sql.raw(stmt))) as unknown as { idempotency_key: string }[];
    expect(
      await run(
        `insert into credit_reservations (credit_account_id, amount, reference_type, reference_id, idempotency_key, expires_at)
         values ('${story.ids.account}', 20, 'practice', gen_random_uuid(), '${idempotency_key}', now() + interval '15 minutes')`,
      ),
    ).toBe("23505");
  });

  it("rejects self edges and prerequisite cycles", async () => {
    const concepts = await db.select().from(s.concepts).where(sql`exam_id = (select exam_id from learners where id = ${story.ids.learnerA})`);
    const [c1, c2] = [concepts.find((c) => c.code === "c1")!, concepts.find((c) => c.code === "c2")!];
    expect(await run(`insert into concept_edges (from_concept_id, to_concept_id) values ('${c1.id}', '${c1.id}')`)).toBe("23514");
    // c1 -> c2 exists; c2 -> c1 would close a cycle.
    expect(await run(`insert into concept_edges (from_concept_id, to_concept_id) values ('${c2.id}', '${c1.id}')`)).toBe("23514");
    // A "related" edge in the other direction is fine.
    expect(await run(`insert into concept_edges (from_concept_id, to_concept_id, edge_type) values ('${c2.id}', '${c1.id}', 'related')`)).toBeNull();
  });

  it("rejects a longer cycle through three concepts", async () => {
    const [exam] = await db.select({ id: s.exams.id }).from(s.exams).where(sql`code like 't\\_%' order by created_at desc limit 1`);
    const [topic] = await db.select({ id: s.topics.id }).from(s.topics).limit(1);
    const ids: string[] = [];
    for (const code of ["x1", "x2", "x3"]) {
      const [c] = await db.insert(s.concepts).values({ examId: exam.id, topicId: topic.id, code: `${code}-${Math.random().toString(36).slice(2, 6)}`, name: code, examImportance: 0.5, estimatedMinutes: 10 }).returning();
      ids.push(c.id);
    }
    await db.insert(s.conceptEdges).values([{ fromConceptId: ids[0], toConceptId: ids[1] }, { fromConceptId: ids[1], toConceptId: ids[2] }]);
    expect(await run(`insert into concept_edges (from_concept_id, to_concept_id) values ('${ids[2]}', '${ids[0]}')`)).toBe("23514");
  });

  it("keeps the credit ledger and audit log append-only", async () => {
    expect(await run(`update credit_transactions set amount = 1 where credit_account_id = '${story.ids.account}'`)).toBe("55000");
    expect(await run(`delete from credit_transactions where credit_account_id = '${story.ids.account}'`)).toBe("55000");
    expect(await run(`update audit_logs set action = 'tampered'`)).toBe("55000");
    expect(await run(`insert into credit_transactions (credit_account_id, bucket, transaction_type, amount) values ('${story.ids.account}', 'daily_plan', 'adjustment', 0)`)).toBe("23514");
  });

  it("requires an exam once onboarding is complete", async () => {
    const u = await createUser("learner");
    expect(await run(`update learners set onboarding_completed = true where id = '${u.learnerId}'`)).toBe("23514");
  });

  it("keeps one attempt per assessment item and one response per item", async () => {
    expect(
      await run(`insert into responses (attempt_id, assessment_item_id) values ('${story.ids.attempt}', '${story.ids.item}')`),
    ).toBe("23505");
    expect(await run(`insert into assessment_items (assessment_id, question_id, position, concept_id, difficulty_snapshot) select assessment_id, question_id, 5, concept_id, 0.5 from assessment_items where id = '${story.ids.item}'`)).toBe("23505");
  });

  it("stores unique natural keys for content and payments", async () => {
    expect(await run(`insert into questions (slug, exam_id, subject_id, chapter_id, topic_id, concept_id, question_type, difficulty, expected_time_seconds, learning_objective, stem, answer, solution, content_hash)
      select slug, exam_id, subject_id, chapter_id, topic_id, concept_id, question_type, difficulty, expected_time_seconds, learning_objective, stem, answer, solution, content_hash from questions where id = '${story.ids.question}'`)).toBe("23505");
    expect(await run(`insert into payment_events (provider, event_id, event_type, payload_hash) select provider, event_id, event_type, payload_hash from payment_events limit 1`)).toBe("23505");
  });

  it("updates updated_at automatically", async () => {
    const [before] = await db.select().from(s.learners).where(sql`id = ${story.ids.learnerA}`);
    await new Promise((r) => setTimeout(r, 15));
    await db.update(s.learners).set({ unit: "Class 11 Mechanics" }).where(sql`id = ${story.ids.learnerA}`);
    const [after] = await db.select().from(s.learners).where(sql`id = ${story.ids.learnerA}`);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("removes a learner's data when the auth user is deleted", async () => {
    const u = await createUser("learner");
    await pg.begin(async (tx) => {
      await tx`select set_config('app.allow_ledger_delete', 'on', true)`;
      await tx`delete from auth.users where id = ${u.id}`;
    });
    const rows = await pg`select 1 from public.learners where id = ${u.learnerId!}`;
    expect(rows.length).toBe(0);
    const accounts = await pg`select 1 from public.credit_accounts where learner_id = ${u.learnerId!}`;
    expect(accounts.length).toBe(0);
  });
});

describe("guardian read access", () => {
  let story: Story;
  beforeAll(async () => {
    story = await buildStory();
    // Give the summary something to show.
    await db.execute(sql.raw(`update attempts set status = 'submitted', submitted_at = now(), score = 40, max_score = 60, percentage = 66.7 where id = '${story.ids.attempt}'`));
  }, 120_000);

  it("lists only the guardian's verified children", async () => {
    const rows = await asUser(story.guardian.id, (tx) => tx.execute(sql.raw(`select learner_id, display_name from guardian_children()`)));
    expect(rows.length).toBe(1);
    expect((rows[0] as { learner_id: string }).learner_id).toBe(story.ids.learnerA);
    expect((await asUser(story.stranger.id, (tx) => tx.execute(sql.raw(`select * from guardian_children()`)))).length).toBe(0);
  });

  it("returns a summary to the guardian and nothing to anyone else", async () => {
    const summary = async (userId: string) => {
      const rows = await asUser(userId, (tx) => tx.execute(sql.raw(`select guardian_child_summary('${story.ids.learnerA}') as s`)));
      return (rows[0] as { s: Record<string, unknown> | null }).s;
    };
    const mine = await summary(story.guardian.id);
    expect(mine).toMatchObject({
      learner: { id: story.ids.learnerA, name: "Ava A" },
      latest_diagnostic: { score: 40, max: 60 },
      plan: { total: 1, done: 0 },
    });
    expect((mine as { pending_approvals: unknown[] }).pending_approvals).toHaveLength(1);
    expect((mine as { weakest: { concept: string; severity: string }[] }).weakest[0]).toEqual({ concept: "Friction", severity: "weak" });
    // No score numbers for mastery leak through the weakest list.
    expect(JSON.stringify((mine as { weakest: unknown }).weakest)).not.toMatch(/mastery/);
    expect(await summary(story.stranger.id)).toBeNull();
    expect(await summary(story.b.id)).toBeNull();
    expect(await summary(story.a.id)).toBeNull();
  });

  it("stops reading once consent is withdrawn", async () => {
    await db.execute(sql.raw(`update guardian_relationships set consent_status = 'withdrawn' where id = '${story.ids.relationship}'`));
    const rows = await asUser(story.guardian.id, (tx) => tx.execute(sql.raw(`select guardian_child_summary('${story.ids.learnerA}') as s`)));
    expect((rows[0] as { s: unknown }).s).toBeNull();
    expect((await asUser(story.guardian.id, (tx) => tx.execute(sql.raw(`select * from guardian_children()`)))).length).toBe(0);
    const approvals = await asUser(story.guardian.id, (tx) => tx.execute(sql.raw(`select id from purchase_approvals`)));
    expect(approvals.length).toBe(0);
  });

  it("does not let anonymous callers run the functions", async () => {
    const { asAnon } = await import("./helpers");
    expect(await errorCode(asAnon((tx) => tx.execute(sql.raw(`select * from guardian_children()`))))).toBe("42501");
  });
});
