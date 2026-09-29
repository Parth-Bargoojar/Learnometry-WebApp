/**
 * Deterministic scoring and evidence aggregation — PRD §4.8 stages 1–2. The rules live in
 * `src/domains/diagnosis/rules.ts` (BE-0.4); this module binds them to the sample data and
 * holds the stage-3 stand-in text (`CAUSE_TEXT`), which has the same output shape the AI
 * gateway will return (BE-7).
 */
import * as rules from "@/domains/diagnosis/rules";
import { conceptById, concepts, questionById } from "./data";
import type { AttemptConfig, ErrorCategory, Response, WeaknessFinding } from "./types";

export { CATEGORY_LABEL, compareRetest } from "@/domains/diagnosis/rules";
export { isCorrect, masteryFrom } from "@/domains/learning/rules";

const CAUSE_TEXT: Record<string, string> = {
  "resolution:conceptual": "Took mg cos θ along the incline, the component that belongs to the normal force.",
  "friction:conceptual": "Used the limiting value μN when the block was not about to slip.",
  "circular:time_pressure": "The method is right; one question was left unanswered near the end.",
  "circular:conceptual": "Unclear which force supplies the centripetal force in the set-up.",
  "vectors:conceptual": "Swapped the sin and cos components of a vector.",
  "work-energy:calculation": "Arithmetic slip in the change of kinetic energy.",
};

const CAUSE_FALLBACK: Record<ErrorCategory, string> = {
  conceptual: "The idea behind the question is not yet secure.",
  prerequisite: "A concept this one builds on needs work first.",
  calculation: "The method was right; an arithmetic step went wrong.",
  misread: "The question was misread.",
  strategy: "The approach chosen made the problem longer than it needed to be.",
  careless: "A small slip on a question you can do.",
  time_pressure: "Ran short of time on this concept.",
};

const NEXT_TEXT: Record<string, string> = {
  resolution: "Revise the incline components, then 10 targeted questions.",
  friction: "Practise limiting vs actual friction: 10 questions.",
  circular: "A timed practice set. The method is already right.",
};

const deps: rules.DiagnosisDeps = {
  questionById,
  conceptById,
  concepts,
  causeText: (conceptId, cause) => (cause ? CAUSE_TEXT[`${conceptId}:${cause}`] ?? CAUSE_FALLBACK[cause] : "No errors on this concept."),
  nextText: (conceptId, severity) =>
    severity === "strong" || severity === "stable"
      ? "Nothing to do now. A later retest checks it again."
      : NEXT_TEXT[conceptId] ?? "Revise the concept, then a 5-question practice set.",
};

export const scoreAttempt = (config: AttemptConfig, responses: Response[]) => rules.scoreAttempt(deps, config, responses);

export const diagnose = (questionIds: string[], responses: Response[]): WeaknessFinding[] => rules.diagnose(deps, questionIds, responses);
