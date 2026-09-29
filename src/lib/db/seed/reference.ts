import { sql } from "drizzle-orm";
import { PLANS } from "@/domains/credits/costs";
import { concepts as sampleConcepts } from "@/lib/data";
import type { Db } from "../connection";
import * as s from "../schema";

/*
  Reference data every environment needs (BE-D62): exams, the Class 11 Mechanics graph on all
  three tracks, plans, the launch coupon and feature flags. Idempotent: run it any time.

  The graph is authored once and cloned per track (TRD §5.2). The sample story has concepts for
  three of the six chapters; the rest are authored with the content pipeline (BE-3).
  Per-track weights start equal to the JEE Main weights and are tuned in the curriculum editor (K7).
*/

export const EXAMS = [
  { code: "jee_main", name: "JEE Main" },
  { code: "neet", name: "NEET" },
  { code: "cbse_11", name: "CBSE Class 11" },
] as const;

/** The six NCERT Class 11 Physics Part I chapters of the launch unit. */
export const MECHANICS_CHAPTERS = [
  { key: "ch-straight", name: "Motion in a Straight Line", ncert: "NCERT Class 11 Physics Part I, Ch. 2" },
  { key: "ch-plane", name: "Motion in a Plane", ncert: "NCERT Class 11 Physics Part I, Ch. 3" },
  { key: "ch-lom", name: "Laws of Motion", ncert: "NCERT Class 11 Physics Part I, Ch. 4" },
  { key: "ch-wep", name: "Work, Energy and Power", ncert: "NCERT Class 11 Physics Part I, Ch. 5" },
  { key: "ch-rotation", name: "System of Particles and Rotational Motion", ncert: "NCERT Class 11 Physics Part I, Ch. 6" },
  { key: "ch-gravitation", name: "Gravitation", ncert: "NCERT Class 11 Physics Part I, Ch. 7" },
] as const;

const FLAGS = [
  { key: "practice_confidence_capture", enabled: true, description: "Ask Sure / Not sure after a practice answer (D8)." },
  { key: "minor_signup", enabled: false, description: "Let under-18 learners sign up. Off until the guardian stage passes (BE-D50)." },
  { key: "guardian_sms", enabled: false, description: "Offer SMS OTP for guardian consent. Off until DLT registration (G10)." },
  { key: "deep_diagnostic", enabled: true, description: "60-minute Deep diagnostic on Pro." },
  { key: "payments_live", enabled: false, description: "Accept live Razorpay payments. Off until launch (BE-14)." },
  { key: "push_delivery", enabled: false, description: "Send Web Push. Off until BE-12." },
] as const;

const ENGINE = { fast_only: "fast_only", learner_choice: "learner_choice", auto: "auto", auto_extended: "auto_extended" } as const;
const ADAPTATION = { free: "retest_only", starter: "retest_only", plus: "after_practice", pro: "daily" } as const;
const QUEUE = { free: 0, starter: 0, plus: 1, pro: 2 } as const;

export interface SeedSummary {
  exams: number;
  concepts: number;
  edges: number;
  plans: number;
  flags: number;
}

export async function seedReference(db: Db): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    // Exams
    const examRows = new Map<string, string>();
    for (const e of EXAMS) {
      const [row] = await tx
        .insert(s.exams)
        .values({ code: e.code, name: e.name, version: "v1", active: true })
        .onConflictDoUpdate({ target: s.exams.code, set: { name: e.name, active: true } })
        .returning();
      examRows.set(e.code, row.id);
    }

    const jeeConceptIds = new Map<string, string>();

    for (const e of EXAMS) {
      const examId = examRows.get(e.code)!;
      const [subject] = await tx
        .insert(s.subjects)
        .values({ examId, name: "Physics", orderIndex: 1 })
        .onConflictDoUpdate({ target: [s.subjects.examId, s.subjects.name], set: { active: true } })
        .returning();

      const chapterIds = new Map<string, string>();
      for (const [i, ch] of MECHANICS_CHAPTERS.entries()) {
        const [row] = await tx
          .insert(s.chapters)
          .values({ subjectId: subject.id, name: ch.name, ncert: ch.ncert, orderIndex: i + 1 })
          .onConflictDoUpdate({ target: [s.chapters.subjectId, s.chapters.name], set: { ncert: ch.ncert, orderIndex: i + 1 } })
          .returning();
        chapterIds.set(ch.key, row.id);
      }

      // Topics come from the concepts' topic labels, in first-seen order within a chapter.
      const topicIds = new Map<string, string>();
      const topicOrder = new Map<string, number>();
      for (const c of sampleConcepts) {
        const key = `${c.chapterId}:${c.topic}`;
        if (topicIds.has(key)) continue;
        const n = (topicOrder.get(c.chapterId) ?? 0) + 1;
        topicOrder.set(c.chapterId, n);
        const [row] = await tx
          .insert(s.topics)
          .values({ chapterId: chapterIds.get(c.chapterId)!, name: c.topic, orderIndex: n })
          .onConflictDoUpdate({ target: [s.topics.chapterId, s.topics.name], set: { orderIndex: n } })
          .returning();
        topicIds.set(key, row.id);
      }

      const conceptIds = new Map<string, string>();
      for (const [i, c] of sampleConcepts.entries()) {
        const [row] = await tx
          .insert(s.concepts)
          .values({
            examId,
            topicId: topicIds.get(`${c.chapterId}:${c.topic}`)!,
            code: c.id,
            name: c.name,
            examImportance: c.examWeight,
            estimatedMinutes: c.estimatedMinutes,
            orderIndex: i,
            cloneSourceConceptId: e.code === "jee_main" ? null : (jeeConceptIds.get(c.id) ?? null),
          })
          .onConflictDoUpdate({
            target: [s.concepts.examId, s.concepts.code],
            set: { name: c.name, examImportance: c.examWeight, estimatedMinutes: c.estimatedMinutes, orderIndex: i, active: true },
          })
          .returning();
        conceptIds.set(c.id, row.id);
        if (e.code === "jee_main") jeeConceptIds.set(c.id, row.id);
      }

      for (const c of sampleConcepts) {
        for (const pre of c.prerequisites) {
          await tx
            .insert(s.conceptEdges)
            .values({ fromConceptId: conceptIds.get(pre)!, toConceptId: conceptIds.get(c.id)!, edgeType: "prerequisite" })
            .onConflictDoNothing();
        }
      }

      await tx
        .insert(s.curriculumVersions)
        .values({ examId, versionNumber: 1, status: "published", reason: "Initial seed", publishedAt: new Date() })
        .onConflictDoNothing();
    }

    // Plans (values from domains/credits/costs, the single source; the table is read from BE-4).
    for (const p of Object.values(PLANS)) {
      const values = {
        code: p.code,
        name: p.name,
        priceInr: p.priceInr,
        passDays: p.code === "free" ? null : 30,
        creditPeriod: p.period === "monthly" ? ("monthly" as const) : ("daily" as const),
        periodCredits: p.periodCredits,
        welcomeCredits: p.code === "free" ? 100 : 0,
        enginePolicy: ENGINE[p.engine],
        queuePriority: QUEUE[p.code],
        planAdaptation: ADAPTATION[p.code],
        deepDiagnostic: p.code === "pro",
        recommended: Boolean(p.recommended),
        active: true,
      };
      await tx.insert(s.plans).values(values).onConflictDoUpdate({ target: s.plans.code, set: values });
    }

    // Launch coupon (§1.9). The end date is a stand-in until the launch date is set.
    await tx
      .insert(s.coupons)
      .values({
        code: "EARLYACCESS",
        discountType: "percentage",
        discountValue: 20,
        bonusCredits: 100,
        perUserLimit: 1,
        firstPassOnly: true,
        startsAt: new Date("2026-09-01T00:00:00+05:30"),
        endsAt: new Date("2026-11-15T23:59:59+05:30"),
      })
      .onConflictDoNothing();

    // Flags (BE-D49). `ai_budget` carries the breaker configuration (K8).
    for (const f of FLAGS) {
      await tx.insert(s.featureFlags).values(f).onConflictDoNothing();
    }
    await tx
      .insert(s.featureFlags)
      .values({ key: "ai_budget", enabled: true, description: "AI spend circuit breaker (K8).", config: { warningRatio: 0.2, restrictedRatio: 0.3, hardCapInr: 5000, override: null } })
      .onConflictDoNothing();

    const [{ n: edges }] = (await tx.execute(sql`select count(*)::int as n from public.concept_edges`)) as unknown as { n: number }[];
    const [{ n: concepts }] = (await tx.execute(sql`select count(*)::int as n from public.concepts`)) as unknown as { n: number }[];
    return { exams: examRows.size, concepts, edges, plans: Object.keys(PLANS).length, flags: FLAGS.length + 1 };
  });
}
