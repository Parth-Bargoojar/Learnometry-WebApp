import { describe, expect, it } from "vitest";
import {
  classifyItem,
  conceptCause,
  errorProfile,
  matchWrongAnswer,
  validateRootCause,
  type ItemEvidence,
  type RootCauseOutput,
} from "./rules";

const wrong = (o: Partial<ItemEvidence> = {}): ItemEvidence => ({
  answered: true,
  correct: false,
  position: 2,
  totalItems: 15,
  hitDeadline: false,
  secondsSpent: 80,
  expectedSeconds: 90,
  prerequisiteWeak: false,
  ...o,
});

describe("classifyItem (ALG §5)", () => {
  it("gives correct answers no candidates", () => {
    expect(classifyItem(wrong({ correct: true }))).toEqual({ skipped: false, candidates: [] });
  });

  it("marks unanswered items at the deadline or in the last 20% as time pressure, others as skipped", () => {
    expect(classifyItem(wrong({ answered: false, hitDeadline: true }))).toEqual({ skipped: false, candidates: ["time_pressure"] });
    expect(classifyItem(wrong({ answered: false, position: 12 })).candidates).toEqual(["time_pressure"]);
    expect(classifyItem(wrong({ answered: false, position: 11 }))).toEqual({ skipped: true, candidates: [] });
    expect(classifyItem(wrong({ answered: false, position: 0, totalItems: 5 })).skipped).toBe(true);
    expect(classifyItem(wrong({ answered: false, position: 4, totalItems: 5 })).skipped).toBe(false);
  });

  it("uses the option misconception first, then a known wrong answer", () => {
    expect(classifyItem(wrong({ optionMisconception: "conceptual" })).candidates).toEqual(["conceptual"]);
    expect(classifyItem(wrong({ optionMisconception: "conceptual", wrongAnswerCategory: "calculation" })).candidates).toEqual(["conceptual", "calculation"]);
    expect(classifyItem(wrong({ wrongAnswerCategory: "calculation" })).candidates).toEqual(["calculation"]);
  });

  it("flags careless when answered in under 25% of the expected time, misread when the stem is risky", () => {
    expect(classifyItem(wrong({ secondsSpent: 20 })).candidates).toEqual(["careless"]);
    expect(classifyItem(wrong({ secondsSpent: 20, misreadRisk: true })).candidates).toEqual(["misread"]);
    expect(classifyItem(wrong({ secondsSpent: 22.5 })).candidates).toEqual(["conceptual"]);
    expect(classifyItem(wrong({ secondsSpent: 1, expectedSeconds: 0 })).candidates).toEqual(["conceptual"]);
  });

  it("adds prerequisite when a direct prerequisite is weak, and defaults to conceptual", () => {
    expect(classifyItem(wrong({ prerequisiteWeak: true })).candidates).toEqual(["prerequisite"]);
    expect(classifyItem(wrong({ prerequisiteWeak: true, optionMisconception: "conceptual" })).candidates).toEqual(["conceptual", "prerequisite"]);
    expect(classifyItem(wrong()).candidates).toEqual(["conceptual"]);
  });

  it("ranks conceptual first when the learner was sure (D8)", () => {
    expect(classifyItem(wrong({ saidSure: true, wrongAnswerCategory: "calculation" })).candidates).toEqual(["conceptual", "calculation"]);
    expect(classifyItem(wrong({ saidSure: true })).candidates).toEqual(["conceptual"]);
    expect(classifyItem(wrong({ saidSure: true, prerequisiteWeak: true, optionMisconception: "conceptual" })).candidates).toEqual(["conceptual", "prerequisite"]);
  });
});

describe("matchWrongAnswer", () => {
  const entries = [{ value: 10, category: "calculation" as const }, { value: -4, category: "conceptual" as const }];
  it("matches within 1%", () => {
    expect(matchWrongAnswer(10.05, entries)).toBe("calculation");
    expect(matchWrongAnswer(10.2, entries)).toBeNull();
    expect(matchWrongAnswer(-4.03, entries)).toBe("conceptual");
    expect(matchWrongAnswer(1, [])).toBeNull();
  });
});

describe("conceptCause (ALG §5)", () => {
  const item = (...candidates: ("conceptual" | "prerequisite" | "calculation" | "careless" | "time_pressure")[]) => ({ skipped: false, candidates });

  it("picks the most frequent candidate", () => {
    const c = conceptCause([item("calculation"), item("calculation"), item("conceptual")], 3);
    expect(c).toMatchObject({ category: "calculation", likely: false });
  });

  it("breaks ties prerequisite > conceptual > calculation > ... > time_pressure", () => {
    expect(conceptCause([item("conceptual"), item("prerequisite")], 2).category).toBe("prerequisite");
    expect(conceptCause([item("careless"), item("time_pressure")], 2).category).toBe("careless");
    expect(conceptCause([item("calculation"), item("conceptual")], 2).category).toBe("conceptual");
  });

  it("says 'likely' with fewer than two wrong items, and has no cause without errors", () => {
    expect(conceptCause([item("conceptual")], 1).likely).toBe(true);
    expect(conceptCause([], 0)).toEqual({ category: null, likely: true, counts: {} });
    expect(conceptCause([{ skipped: true, candidates: [] }], 0).category).toBeNull();
  });
});

describe("errorProfile", () => {
  it("counts first-choice categories and ignores skipped items", () => {
    expect(errorProfile([{ skipped: false, candidates: ["conceptual", "prerequisite"] }, { skipped: false, candidates: ["conceptual"] }, { skipped: true, candidates: [] }, { skipped: false, candidates: [] }])).toEqual({ conceptual: 2 });
  });
});

describe("validateRootCause (stage 3)", () => {
  const ctx = { candidates: { c1: ["conceptual", "calculation"] as ("conceptual" | "calculation")[] }, evidence: { c1: ["i1", "i2", "i3"] } };
  const ok: RootCauseOutput = { concept_id: "c1", category: "conceptual", cited_item_ids: ["i1", "i2"], explanation: "Because.", next_step: "Practise.", certainty: "medium" };

  it("accepts a well-formed answer", () => {
    expect(validateRootCause(ok, ctx)).toEqual([]);
    expect(validateRootCause({ ...ok, category: "insufficient_evidence", cited_item_ids: [] }, ctx)).toEqual([]);
  });

  it("rejects unknown concepts, categories outside the candidates and unknown citations", () => {
    expect(validateRootCause({ ...ok, concept_id: "zz" }, ctx)).toEqual(["unknown concept"]);
    expect(validateRootCause({ ...ok, category: "strategy" }, ctx)).toContain("category outside the candidate set");
    expect(validateRootCause({ ...ok, cited_item_ids: ["i9"] }, ctx)).toContain("cites unknown items");
    expect(validateRootCause({ ...ok, cited_item_ids: [] }, ctx)).toContain("cites no evidence");
  });

  it("rejects high certainty on thin evidence and over-long text", () => {
    const thin = { candidates: ctx.candidates, evidence: { c1: ["i1", "i2"] } };
    expect(validateRootCause({ ...ok, certainty: "high" }, thin)).toContain("high certainty with fewer than 3 evidence items");
    expect(validateRootCause({ ...ok, certainty: "high" }, ctx)).toEqual([]);
    expect(validateRootCause({ ...ok, explanation: "x".repeat(241) }, ctx)).toContain("explanation too long");
    expect(validateRootCause({ ...ok, next_step: "x".repeat(161) }, ctx)).toContain("next step too long");
  });
});
