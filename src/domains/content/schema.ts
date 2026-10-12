import { z } from "zod";

/*
  Question file format (BE-D30, BE-D31). One YAML file per concept; each file holds the
  items for that concept. Everything the selection, scoring, error-classification and retest
  algorithms read is a field here, so an item that parses is an item the engine can use.

    concept: resolution
    questions:
      - id: res-d01
        difficulty: easy
        ...
*/

export const TRACKS = ["jee_main", "neet", "cbse_11"] as const;
export const POOLS = ["diagnostic", "retest", "practice"] as const;
export const DIFFICULTY_VALUE = { easy: 0.3, medium: 0.55, hard: 0.8 } as const;
export const ERROR_CATEGORIES = ["conceptual", "prerequisite", "calculation", "misread", "strategy", "careless", "time_pressure"] as const;
/** Launch gate G5: items per assessed concept per track. */
export const POOL_TARGET = { diagnostic: 3, retest: 3, practice: 6 } as const;

const difficulty = z.enum(["easy", "medium", "hard"]);
const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use a lowercase slug such as res-d01");

const option = z.object({
  key: z.string().regex(/^[A-F]$/, "Option keys are single capital letters A–F"),
  text,
  /** Why a learner picks this wrong option; read by diagnosis stage 2 (ALG §5). */
  misconception: text.optional(),
});

const numericAnswer = z
  .object({
    value: z.number().finite(),
    tolerance: z.number().positive().optional(),
    tolerance_pct: z.number().positive().max(50).optional(),
  })
  .refine((a) => !(a.tolerance !== undefined && a.tolerance_pct !== undefined), "Give tolerance or tolerance_pct, not both");

export const questionSchema = z
  .object({
    id: slug.max(60),
    tracks: z.array(z.enum(TRACKS)).min(1).default([...TRACKS]),
    /** Per-track difficulty when a track finds the item easier or harder. */
    track_difficulty: z.partialRecord(z.enum(TRACKS), difficulty).optional(),
    type: z.enum(["mcq", "numerical"]),
    format: z.enum(["standard", "assertion_reason", "statement"]).default("standard"),
    difficulty,
    expected_seconds: z.number().int().min(15).max(600),
    stem: text,
    options: z.array(option).min(2).max(6).optional(),
    answer: z.union([z.string().regex(/^[A-F]$/), numericAnswer]),
    wrong_answers: z.array(z.object({ value: z.number().finite(), category: z.enum(ERROR_CATEGORIES) })).max(6).optional(),
    solution: z.array(text).min(1).max(12),
    hint: text.optional(),
    pool: z.enum(POOLS),
    /** Items that measure the same thing; the retest picks the sibling of a diagnostic item. */
    parallel_group: slug.optional(),
    misread_risk: z.boolean().default(false),
    source_type: z.enum(["original", "licensed", "public_domain"]).default("original"),
    source_reference: text.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (q.type === "mcq") {
      if (!q.options) issue("options", "An MCQ needs options");
      if (typeof q.answer !== "string") issue("answer", "An MCQ answer is an option key such as B");
      if (q.wrong_answers) issue("wrong_answers", "wrong_answers is for numerical items");
    } else {
      if (q.options) issue("options", "A numerical item has no options");
      if (typeof q.answer === "string") issue("answer", "A numerical answer is { value, tolerance? }");
    }
    if (q.source_type !== "original" && !q.source_reference) issue("source_reference", "Licensed or public-domain items must cite their source");
  });

export const conceptFileSchema = z
  .object({
    concept: slug,
    questions: z.array(z.unknown()).min(1),
  })
  .strict();

export type QuestionItem = z.infer<typeof questionSchema>;
export type Track = (typeof TRACKS)[number];
export type Pool = (typeof POOLS)[number];

/** A parsed file ready for the validators and the importer. */
export interface ConceptFile {
  path: string;
  concept: string;
  items: QuestionItem[];
}
