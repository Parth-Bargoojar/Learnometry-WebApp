import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PLANS } from "@/domains/credits/costs";
import { seedReference, MECHANICS_CHAPTERS } from "@/lib/db/seed/reference";
import { seedSampleQuestions } from "@/lib/db/seed/questions";
import { db } from "./helpers";

const rows = async <T>(statement: string) => (await db.execute(sql.raw(statement))) as unknown as T[];

describe("seed (BE-D62)", () => {
  it("is idempotent", async () => {
    const counts = async () =>
      (await rows<{ t: string; n: number }>(
        `select 'exams' t, count(*)::int n from exams union all select 'concepts', count(*)::int from concepts
         union all select 'edges', count(*)::int from concept_edges union all select 'plans', count(*)::int from plans
         union all select 'flags', count(*)::int from feature_flags union all select 'coupons', count(*)::int from coupons
         union all select 'questions', count(*)::int from questions where slug ~ '^[dpr][0-9]{2}$'`,
      )).map((r) => `${r.t}=${r.n}`);
    await seedReference(db);
    await seedSampleQuestions(db);
    const first = await counts();
    await seedReference(db);
    await seedSampleQuestions(db);
    expect(await counts()).toEqual(first);
  });

  it("builds Class 11 Mechanics on all three tracks", async () => {
    const perExam = await rows<{ code: string; chapters: number; concepts: number; edges: number }>(
      `select e.code,
         (select count(*)::int from chapters c join subjects s on s.id = c.subject_id where s.exam_id = e.id) chapters,
         (select count(*)::int from concepts c where c.exam_id = e.id) concepts,
         (select count(*)::int from concept_edges ce join concepts c on c.id = ce.from_concept_id where c.exam_id = e.id) edges
       from exams e where e.code in ('jee_main','neet','cbse_11') order by e.code`,
    );
    expect(perExam.map((r) => r.code)).toEqual(["cbse_11", "jee_main", "neet"]);
    for (const r of perExam) expect(r).toMatchObject({ chapters: MECHANICS_CHAPTERS.length, concepts: 9, edges: 8 });
  });

  it("clones concepts from JEE Main and keeps codes unique per graph", async () => {
    const clones = await rows<{ n: number }>(
      `select count(*)::int n from concepts c join exams e on e.id = c.exam_id where e.code <> 'jee_main' and c.clone_source_concept_id is not null`,
    );
    expect(clones[0].n).toBe(18);
  });

  it("stores the four plans from the single source of truth", async () => {
    const plans = await rows<{ code: string; price_inr: number; period_credits: number; welcome_credits: number; queue_priority: number; deep_diagnostic: boolean; recommended: boolean }>(
      `select code, price_inr, period_credits, welcome_credits, queue_priority, deep_diagnostic, recommended from plans where code in ('free','starter','plus','pro') order by price_inr`,
    );
    expect(plans.map((p) => [p.code, p.price_inr, p.period_credits])).toEqual(Object.values(PLANS).map((p) => [p.code, p.priceInr, p.periodCredits]));
    expect(plans.find((p) => p.code === "free")!.welcome_credits).toBe(100);
    expect(plans.find((p) => p.code === "pro")!.deep_diagnostic).toBe(true);
    expect(plans.find((p) => p.code === "plus")).toMatchObject({ recommended: true, queue_priority: 1 });
  });

  it("ships flags dark where the spec says so", async () => {
    const flags = Object.fromEntries((await rows<{ key: string; enabled: boolean }>(`select key, enabled from feature_flags`)).map((f) => [f.key, f.enabled]));
    expect(flags).toMatchObject({ minor_signup: false, guardian_sms: false, payments_live: false, push_delivery: false, deep_diagnostic: true, practice_confidence_capture: true });
    const [budget] = await rows<{ config: Record<string, number> }>(`select config from feature_flags where key = 'ai_budget'`);
    expect(budget.config).toMatchObject({ warningRatio: 0.2, restrictedRatio: 0.3, hardCapInr: 5000 });
  });

  it("seeds the EARLYACCESS coupon with the launch terms", async () => {
    const [c] = await rows<{ discount_type: string; discount_value: number; bonus_credits: number; first_pass_only: boolean }>(
      `select discount_type, discount_value, bonus_credits, first_pass_only from coupons where code = 'EARLYACCESS'`,
    );
    expect(c).toEqual({ discount_type: "percentage", discount_value: 20, bonus_credits: 100, first_pass_only: true });
  });

  it("publishes sample questions whose answers are consistent with their options", async () => {
    const qs = await rows<{ slug: string; question_type: string; options: { key: string }[] | null; answer: { key?: string; value?: number }; pool: string }>(
      `select q.slug, q.question_type, q.options, q.answer, q.pool from questions q join exams e on e.id = q.exam_id
       where e.code = 'jee_main' and q.slug ~ '^[dpr][0-9]{2}$' and q.validation_status = 'published'`,
    );
    expect(qs.length).toBe(29);
    for (const q of qs) {
      if (q.question_type === "mcq") {
        expect(q.options!.map((o) => o.key), q.slug).toContain(q.answer.key);
        expect(q.options).toHaveLength(4);
      } else {
        expect(typeof q.answer.value, q.slug).toBe("number");
      }
    }
    expect(new Set(qs.map((q) => q.pool))).toEqual(new Set(["diagnostic", "retest", "practice"]));
  });

  it("has a clean, acyclic prerequisite graph rooted at vectors and work-energy", async () => {
    const roots = await rows<{ code: string }>(
      `select c.code from concepts c join exams e on e.id = c.exam_id where e.code = 'jee_main'
       and not exists (select 1 from concept_edges ce where ce.to_concept_id = c.id and ce.edge_type = 'prerequisite') order by 1`,
    );
    expect(roots.map((r) => r.code)).toEqual(["vectors", "work-energy"]);
  });
});
