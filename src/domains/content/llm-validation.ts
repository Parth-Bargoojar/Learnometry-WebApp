import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";

/*
  Semantic validators (BE-3.3): is the keyed answer correct, is the difficulty plausible, does it read
  like the exam, is it safe. They run through the AI gateway, which arrives in BE-6. Until then the
  provider is `mock` and every result is recorded as `pending` with a `provider: "mock"` note, so a
  reviewer sees that the semantic checks have NOT happened and cannot mistake silence for a pass.
*/

export const LLM_VALIDATORS = ["semantic", "difficulty", "exam_style", "safety"] as const;
export type LlmValidator = (typeof LLM_VALIDATORS)[number];

export interface LlmVerdict {
  status: "pass" | "fail" | "warning" | "pending";
  score?: number;
  details: Record<string, unknown>;
}

/** What the gateway will implement in BE-6. */
export interface QuestionJudge {
  provider: string;
  judge(validator: LlmValidator, question: { stem: string; options: unknown; answer: unknown; solution: unknown; difficulty: number }): Promise<LlmVerdict>;
}

/** Stand-in used until the gateway exists, and in every environment configured with the mock provider. */
export const mockJudge: QuestionJudge = {
  provider: "mock",
  judge: async (validator) => ({ status: "pending", details: { provider: "mock", note: `${validator} check not run: no AI provider configured (BE-6)` } }),
};

/** Record one verdict per validator for a question version. Safe to repeat: the previous result is replaced. */
export async function runLlmValidators(db: Db | Tx, questionId: string, version: number, judge: QuestionJudge = mockJudge): Promise<LlmValidator[]> {
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, questionId));
  if (!q || q.versionNumber !== version) return []; // a newer import superseded this one

  for (const validator of LLM_VALIDATORS) {
    const verdict = await judge.judge(validator, { stem: q.stem, options: q.options, answer: q.answer, solution: q.solution, difficulty: q.difficulty });
    await db
      .delete(s.questionValidations)
      .where(and(eq(s.questionValidations.questionId, questionId), eq(s.questionValidations.versionNumber, version), eq(s.questionValidations.validatorType, validator)));
    await db.insert(s.questionValidations).values({ questionId, versionNumber: version, validatorType: validator, status: verdict.status, score: verdict.score ?? null, details: verdict.details });
  }
  return [...LLM_VALIDATORS];
}
