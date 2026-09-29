import { describe, expect, it } from "vitest";
import { masteryFrom } from "./rules";
import {
  attemptMastery,
  evidenceConfidence,
  evidenceWeight,
  evidenceWindow,
  forgetting,
  masteryFor,
  rankPriorities,
  weightedMastery,
  conceptStateFrom,
  type EvidenceItem,
  type PriorityInput,
  type SessionedEvidence,
} from "./rules";

const item = (o: Partial<EvidenceItem> = {}): EvidenceItem => ({
  correct: true,
  answered: true,
  difficulty: "medium",
  source: "diagnostic",
  laterSessions: 0,
  ...o,
});

describe("weighted mastery (ALG §3)", () => {
  it("reduces to the smoothed accuracy of the UI for one medium diagnostic", () => {
    for (const [c, t] of [[1, 3], [0, 3], [3, 3], [2, 5]]) {
      const items = Array.from({ length: t }, (_, i) => item({ correct: i < c }));
      expect(weightedMastery(items)).toBe(masteryFrom(c, t));
    }
    expect(weightedMastery([item(), item({ correct: false }), item({ correct: false })])).toBe(38);
  });

  it("weights hard items above easy ones and practice below diagnostics", () => {
    expect(evidenceWeight(item({ difficulty: "hard" }))).toBeGreaterThan(evidenceWeight(item({ difficulty: "easy" })));
    expect(evidenceWeight(item({ source: "practice" }))).toBeCloseTo(0.7);
    expect(evidenceWeight(item({ source: "practice_assisted" }))).toBeCloseTo(0.4);
  });

  it("decays older sessions and halves unanswered weight", () => {
    expect(evidenceWeight(item({ laterSessions: 2 }))).toBeCloseTo(0.85 ** 2);
    expect(evidenceWeight(item({ answered: false, correct: false }))).toBeCloseTo(0.5);
  });

  it("treats unanswered as wrong", () => {
    const with_ = weightedMastery([item(), item({ answered: false, correct: true })]);
    expect(with_).toBeLessThan(weightedMastery([item(), item()]));
  });

  it("recent evidence moves mastery more than old evidence", () => {
    const oldWrong = [item({ correct: false, laterSessions: 3 }), item({ correct: true })];
    const newWrong = [item({ correct: false }), item({ correct: true, laterSessions: 3 })];
    expect(weightedMastery(newWrong)).toBeLessThan(weightedMastery(oldWrong));
  });

  it("is 50 with no evidence and stays within 0–100", () => {
    expect(weightedMastery([])).toBe(50);
    expect(weightedMastery(Array.from({ length: 30 }, () => item()))).toBeLessThanOrEqual(100);
    expect(weightedMastery(Array.from({ length: 30 }, () => item({ correct: false })))).toBeGreaterThanOrEqual(0);
  });

  it("attempt mastery ignores recency", () => {
    expect(attemptMastery([{ correct: true, answered: true, difficulty: "medium", source: "retest" }])).toBe(75);
  });
});

describe("evidence window (ALG §2)", () => {
  const ev = (n: number, session: string, at: number): SessionedEvidence[] =>
    Array.from({ length: n }, () => ({ correct: true, answered: true, difficulty: "medium", source: "diagnostic", sessionId: session, at }));

  it("keeps the 12 most recent items and derives k from later sessions", () => {
    const items = [...ev(10, "old", 1), ...ev(3, "mid", 2), ...ev(2, "new", 3)];
    const win = evidenceWindow(items);
    expect(win).toHaveLength(12);
    expect(win.filter((i) => i.laterSessions === 0)).toHaveLength(2);
    expect(win.filter((i) => i.laterSessions === 1)).toHaveLength(3);
    expect(win.filter((i) => i.laterSessions === 2)).toHaveLength(7);
  });

  it("maps counts to confidence bands", () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(evidenceConfidence)).toEqual(["insufficient", "insufficient", "low", "medium", "medium", "high", "high"]);
  });

  it("gives severity only from Low confidence upward", () => {
    expect(masteryFor([item({ correct: false })]).severity).toBe("insufficient");
    const three = masteryFor([item(), item({ correct: false }), item({ correct: false })]);
    expect(three).toEqual({ mastery: 38, confidence: "medium", severity: "weak" });
  });
});

describe("forgetting (ALG §6)", () => {
  it("is 1 when never seen, 0 today and rises with days", () => {
    expect(forgetting(null)).toBe(1);
    expect(forgetting(0)).toBe(0);
    expect(forgetting(21)).toBeCloseTo(1 - Math.exp(-1));
    expect(forgetting(60)).toBeGreaterThan(forgetting(7));
    expect(forgetting(-5)).toBe(0);
  });
});

describe("priority (ALG §7)", () => {
  const base: PriorityInput = { conceptId: "a", mastery: 40, severity: "weak", examWeight: 0.8, weakDependents: 0, forgetting: 0, estimatedMinutes: 30 };

  it("ranks the weakest, most examined, cheapest-to-fix concept first", () => {
    const r = rankPriorities([
      { ...base, conceptId: "strong", mastery: 90, severity: "strong" },
      { ...base, conceptId: "weak" },
      { ...base, conceptId: "weak-light", examWeight: 0.2 },
    ]);
    expect(r.map((x) => x.conceptId)).toEqual(["weak", "weak-light", "strong"]);
    expect(r[0].score).toBe(1);
    expect(r[0].band).toBe(1);
  });

  it("boosts a prerequisite of many weak dependents", () => {
    const r = rankPriorities([
      { ...base, conceptId: "root", weakDependents: 4 },
      { ...base, conceptId: "leaf", weakDependents: 0 },
    ]);
    expect(r[0].conceptId).toBe("root");
    expect(r[0].raw / r[1].raw).toBeCloseTo(1.5);
  });

  it("treats insufficient evidence as W = 0.5 and floors intervention time at 15 min", () => {
    const [ins] = rankPriorities([{ ...base, severity: "insufficient", mastery: 0, estimatedMinutes: 5, forgetting: 1 }]);
    const [same] = rankPriorities([{ ...base, severity: "insufficient", mastery: 99, estimatedMinutes: 15, forgetting: 1 }]);
    expect(ins.raw).toBeCloseTo(same.raw);
    expect(ins.raw).toBeCloseTo((0.5 * 0.8 * 1 * 1 * 0.6) / (15 / 60));
  });

  it("raises priority as forgetting grows and handles an empty list", () => {
    const [a, b] = rankPriorities([{ ...base, conceptId: "fresh" }, { ...base, conceptId: "stale", forgetting: 1 }]);
    expect([a.conceptId, b.conceptId]).toEqual(["stale", "fresh"]);
    expect(rankPriorities([])).toEqual([]);
  });

  it("returns score 0 when every concept has zero raw priority", () => {
    const r = rankPriorities([{ ...base, mastery: 100, examWeight: 0 }]);
    expect(r[0]).toMatchObject({ score: 0, band: 4 });
  });

  it("orders ties by concept id for determinism", () => {
    const r = rankPriorities([{ ...base, conceptId: "b" }, { ...base, conceptId: "a" }]);
    expect(r.map((x) => x.conceptId)).toEqual(["a", "b"]);
  });
});

describe("knowledge state (ALG §4)", () => {
  it("stores mastery 0–1, confidence score and accuracies", () => {
    const items = [item(), item({ correct: false }), item({ correct: false }), item(), item()];
    const state = conceptStateFrom(items, [{ correct: true }, { correct: false }, { correct: false }, { correct: true }, { correct: true }, { correct: true }]);
    expect(state.confidence).toBe("high");
    expect(state.confidenceScore).toBe(1);
    expect(state.masteryScore).toBeGreaterThan(0);
    expect(state.masteryScore).toBeLessThanOrEqual(1);
    expect(state.accuracy).toBeCloseTo(4 / 6);
    expect(state.recentAccuracy).toBeCloseTo(3 / 5);
    expect(conceptStateFrom([], []).accuracy).toBe(0);
    expect(conceptStateFrom([], []).recentAccuracy).toBe(0);
  });
});
