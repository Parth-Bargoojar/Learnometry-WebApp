import { describe, expect, it } from "vitest";
import {
  MARKING,
  diagnosticFormat,
  isAnswerCorrect,
  orderConcepts,
  outcomeOf,
  pickForConcept,
  prerequisiteDepth,
  scoreOutcomes,
  selectDiagnostic,
  type PoolItem,
  type SelectableConcept,
} from "./rules";

describe("answer checking (ALG §1)", () => {
  it("matches MCQ keys exactly", () => {
    expect(isAnswerCorrect({ type: "mcq", answer: "B" }, "B")).toBe(true);
    expect(isAnswerCorrect({ type: "mcq", answer: "B" }, " B ")).toBe(true);
    expect(isAnswerCorrect({ type: "mcq", answer: "B" }, "b")).toBe(false);
    expect(isAnswerCorrect({ type: "mcq", answer: "B" }, null)).toBe(false);
  });

  it("uses exact match for integers and 1% for non-integers by default", () => {
    expect(isAnswerCorrect({ type: "numerical", answer: "12" }, "12")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "12" }, "12.01")).toBe(false);
    expect(isAnswerCorrect({ type: "numerical", answer: "12.5" }, "12.6")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "12.5" }, "12.7")).toBe(false);
  });

  it("honours absolute and percentage tolerance, in that order", () => {
    expect(isAnswerCorrect({ type: "numerical", answer: "100", tolerance: 2 }, "102")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "100", tolerance: 2 }, "102.5")).toBe(false);
    expect(isAnswerCorrect({ type: "numerical", answer: "100", tolerancePct: 5 }, "95")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "100", tolerancePct: 5 }, "94")).toBe(false);
    expect(isAnswerCorrect({ type: "numerical", answer: "100", tolerance: 0, tolerancePct: 50 }, "101")).toBe(false);
    expect(isAnswerCorrect({ type: "numerical", answer: "-3.5", tolerancePct: 10 }, "-3.4")).toBe(true);
  });

  it("rejects blank and non-numeric input, accepts exponents", () => {
    for (const bad of ["", "  ", "abc", "12abc", "1,5", "--2", "Infinity", "NaN", "0x10"]) {
      expect(isAnswerCorrect({ type: "numerical", answer: "0" }, bad)).toBe(false);
    }
    expect(isAnswerCorrect({ type: "numerical", answer: "1000" }, "1e3")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "0.5" }, ".5")).toBe(true);
    expect(isAnswerCorrect({ type: "numerical", answer: "abc" }, "1")).toBe(false);
  });

  it("classifies outcomes", () => {
    const key = { type: "mcq", answer: "A" } as const;
    expect([outcomeOf(key, "A"), outcomeOf(key, "C"), outcomeOf(key, null), outcomeOf(key, "  ")]).toEqual(["correct", "incorrect", "unanswered", "unanswered"]);
  });
});

describe("scoring (ALG §1)", () => {
  it("marks JEE +4/−1 and stores percentage and accuracy", () => {
    const s = scoreOutcomes("jee_main", ["correct", "correct", "incorrect", "unanswered"], { marked: true });
    expect(s).toEqual({ score: 7, max: 16, percentage: 43.8, accuracy: 67, correct: 2, incorrect: 1, unanswered: 1, total: 4 });
  });

  it("marks NEET like JEE and CBSE +1/0", () => {
    expect(MARKING.neet).toEqual(MARKING.jee_main);
    const s = scoreOutcomes("cbse_11", ["correct", "incorrect", "incorrect"], { marked: true });
    expect([s.score, s.max]).toEqual([1, 3]);
  });

  it("floors a negative score at 0% and handles empty attempts", () => {
    const s = scoreOutcomes("jee_main", ["incorrect", "incorrect", "correct"], { marked: true });
    expect(s.score).toBe(2);
    const neg = scoreOutcomes("jee_main", ["incorrect", "incorrect", "incorrect"], { marked: true });
    expect([neg.score, neg.percentage]).toEqual([-3, 0]);
    expect(scoreOutcomes("neet", [], { marked: true })).toMatchObject({ score: 0, max: 0, percentage: null, accuracy: 0 });
    expect(scoreOutcomes("neet", ["unanswered"], { marked: true }).accuracy).toBe(0);
  });

  it("does not mark practice", () => {
    const s = scoreOutcomes("jee_main", ["correct", "incorrect"], { marked: false });
    expect(s).toMatchObject({ score: 1, max: 2, percentage: null, accuracy: 50 });
  });
});

const concept = (o: Partial<SelectableConcept> & { id: string }): SelectableConcept => ({
  prerequisites: [],
  weight: 0.5,
  chapterOrder: 1,
  topicOrder: 1,
  order: 1,
  hasEvidence: false,
  confidence: "insufficient",
  ...o,
});

const poolFor = (id: string, seen: string[] = []): PoolItem[] =>
  (["easy", "medium", "hard"] as const).flatMap((d) =>
    [1, 2].map((n) => ({ id: `${id}-${d}-${n}`, conceptId: id, difficulty: d, seen: seen.includes(`${id}-${d}-${n}`) })),
  );

describe("diagnostic format (ALG §8)", () => {
  it("uses the per-track counts and doubles them for deep", () => {
    expect(diagnosticFormat("full", "jee_main")).toEqual({ items: 15, perConcept: 3 });
    expect(diagnosticFormat("full", "neet").items).toBe(24);
    expect(diagnosticFormat("chapter", "cbse_11").items).toBe(10);
    expect(diagnosticFormat("deep", "jee_main")).toEqual({ items: 30, perConcept: 6 });
  });
});

describe("concept ordering (ALG §8)", () => {
  it("computes prerequisite depth and ignores outside and cyclic references", () => {
    const d = prerequisiteDepth([
      { id: "a", prerequisites: [] },
      { id: "b", prerequisites: ["a"] },
      { id: "c", prerequisites: ["b", "outside"] },
      { id: "x", prerequisites: ["y"] },
      { id: "y", prerequisites: ["x"] },
    ]);
    expect([d.get("a"), d.get("b"), d.get("c")]).toEqual([0, 1, 2]);
    expect(Number.isFinite(d.get("x"))).toBe(true);
  });

  it("puts unassessed first, roots before dependents, then weight, then curriculum order", () => {
    const out = orderConcepts([
      concept({ id: "seen", hasEvidence: true, confidence: "high" }),
      concept({ id: "dep", prerequisites: ["root"], weight: 0.9 }),
      concept({ id: "root", weight: 0.4, order: 2 }),
      concept({ id: "root2", weight: 0.4, order: 1 }),
      concept({ id: "heavy-root", weight: 0.8, order: 3 }),
    ]).map((c) => c.id);
    expect(out).toEqual(["heavy-root", "root2", "root", "dep", "seen"]);
  });

  it("orders by lowest confidence once everything is assessed", () => {
    const out = orderConcepts([
      concept({ id: "hi", hasEvidence: true, confidence: "high" }),
      concept({ id: "lo", hasEvidence: true, confidence: "low" }),
      concept({ id: "md", hasEvidence: true, confidence: "medium" }),
    ]).map((c) => c.id);
    expect(out).toEqual(["lo", "md", "hi"]);
  });
});

describe("picking items for a concept", () => {
  it("takes one easy, one medium, one hard", () => {
    expect(pickForConcept(poolFor("c"), 3).map((p) => p.difficulty)).toEqual(["easy", "medium", "hard"]);
  });

  it("never returns a seen item and falls back to the nearest difficulty", () => {
    const seen = ["c-easy-1", "c-easy-2"];
    const picks = pickForConcept(poolFor("c", seen), 3);
    expect(picks.map((p) => p.difficulty)).toEqual(["medium", "medium", "hard"]);
    expect(picks.every((p) => !p.seen)).toBe(true);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });

  it("leans medium for one slot and easy+medium for two, and cycles for six", () => {
    expect(pickForConcept(poolFor("c"), 1).map((p) => p.difficulty)).toEqual(["medium"]);
    expect(pickForConcept(poolFor("c"), 2).map((p) => p.difficulty)).toEqual(["easy", "medium"]);
    expect(pickForConcept(poolFor("c"), 6).map((p) => p.difficulty)).toEqual(["easy", "medium", "hard", "easy", "medium", "hard"]);
  });

  it("returns what exists when the pool is short", () => {
    expect(pickForConcept([{ id: "only", conceptId: "c", difficulty: "hard", seen: false }], 3)).toHaveLength(1);
    expect(pickForConcept([], 3)).toEqual([]);
  });
});

describe("selectDiagnostic (ALG §8)", () => {
  const cs = ["a", "b", "c", "d", "e", "f"].map((id, i) => concept({ id, order: i, chapterOrder: i < 3 ? 1 : 2, topicOrder: 1 }));
  const pool = cs.flatMap((c) => poolFor(c.id));

  it("fills a JEE full diagnostic: 5 concepts × 3 items in paper order, easy → hard", () => {
    const s = selectDiagnostic({ kind: "full", track: "jee_main", concepts: cs, pool });
    expect(s.itemIds).toHaveLength(15);
    expect(s.conceptIds).toEqual(["a", "b", "c", "d", "e"]);
    expect(s.short).toBe(false);
    expect(s.itemIds.slice(0, 3).map((id) => id.split("-")[1])).toEqual(["easy", "medium", "hard"]);
  });

  it("gives leftover slots one item each (CBSE 20 = 6×3 + 2)", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => concept({ id, order: i }));
    const s = selectDiagnostic({ kind: "full", track: "cbse_11", concepts: eight, pool: eight.flatMap((c) => poolFor(c.id)) });
    expect(s.itemIds).toHaveLength(20);
    expect(s.conceptIds).toHaveLength(8);
  });

  it("skips concepts with no unseen items and carries a shortfall on", () => {
    const seenAll = poolFor("a").map((p) => p.id);
    const s = selectDiagnostic({ kind: "chapter", track: "jee_main", concepts: cs, pool: cs.flatMap((c) => poolFor(c.id, c.id === "a" ? seenAll : [])) });
    expect(s.conceptIds).not.toContain("a");
    expect(s.itemIds).toHaveLength(8);
  });

  it("reports a short selection when the pools cannot fill the format", () => {
    const s = selectDiagnostic({ kind: "full", track: "jee_main", concepts: cs.slice(0, 2), pool: cs.slice(0, 2).flatMap((c) => poolFor(c.id)) });
    expect(s.itemIds).toHaveLength(6);
    expect(s.short).toBe(true);
  });

  it("is deterministic", () => {
    const a = selectDiagnostic({ kind: "full", track: "neet", concepts: cs, pool });
    const b = selectDiagnostic({ kind: "full", track: "neet", concepts: [...cs].reverse(), pool: [...pool].reverse() });
    expect(new Set(a.itemIds).size).toBe(a.itemIds.length);
    expect(a.conceptIds).toEqual(b.conceptIds);
  });
});
