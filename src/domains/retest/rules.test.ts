import { describe, expect, it } from "vitest";
import { retestConceptResult, retestDurationSeconds, selectRetestItems, type RetestPoolItem } from "./rules";

const pool = (rows: [string, "easy" | "medium" | "hard", string | null, boolean?][]): RetestPoolItem[] =>
  rows.map(([id, difficulty, parallelGroup, seen]) => ({ id, difficulty, parallelGroup, seen: seen ?? false }));

describe("selectRetestItems (ALG §10)", () => {
  const baseline = [
    { difficulty: "easy" as const, parallelGroup: "g1" },
    { difficulty: "medium" as const, parallelGroup: "g2" },
    { difficulty: "hard" as const, parallelGroup: "g3" },
  ];

  it("prefers the parallel group of each baseline item", () => {
    const p = pool([["a", "hard", "g1"], ["b", "easy", "g2"], ["c", "medium", "g3"], ["d", "medium", null]]);
    expect(selectRetestItems(baseline, p)).toEqual({ itemIds: ["a", "b", "c"], insufficient: false });
  });

  it("falls back to the same difficulty, then the nearest", () => {
    const p = pool([["e", "easy", null], ["m", "medium", null], ["h", "hard", null]]);
    expect(selectRetestItems(baseline, p).itemIds).toEqual(["e", "m", "h"]);
    const nearest = pool([["e1", "easy", null], ["e2", "easy", null], ["e3", "easy", null]]);
    expect(selectRetestItems(baseline, nearest).itemIds).toEqual(["e1", "e2", "e3"]);
  });

  it("never returns a seen item and reports insufficient when fewer than 3 remain", () => {
    const p = pool([["a", "easy", "g1", true], ["b", "medium", "g2"], ["c", "hard", "g3"]]);
    expect(selectRetestItems(baseline, p)).toEqual({ itemIds: ["b", "c"], insufficient: true });
    expect(selectRetestItems(baseline, [])).toEqual({ itemIds: [], insufficient: true });
  });

  it("does not use an item twice and handles a short or empty baseline", () => {
    const p = pool([["a", "medium", null], ["b", "medium", null], ["c", "medium", null]]);
    expect(selectRetestItems([], p).itemIds).toEqual(["a", "b", "c"]);
    expect(selectRetestItems([{ difficulty: "easy", parallelGroup: "zz" }], p).itemIds).toEqual(["a", "b", "c"]);
  });

  it("takes 3 minutes per item", () => {
    expect(retestDurationSeconds(9)).toBe(27 * 60);
  });
});

describe("retestConceptResult", () => {
  const item = (correct: boolean) => ({ correct, answered: true, difficulty: "medium" as const, source: "retest" as const });
  it("compares attempt-scoped mastery and applies the ±10 rule", () => {
    const up = retestConceptResult([item(false), item(false), item(true)], [item(true), item(true), item(true)]);
    expect(up).toMatchObject({ before: 38, after: 88, delta: 50, outcome: "improved" });
    expect(retestConceptResult([item(true), item(true), item(true)], [item(false), item(false), item(true)]).outcome).toBe("declined");
    expect(retestConceptResult([item(true), item(false), item(false)], [item(true), item(false), item(false)]).outcome).toBe("stable");
  });
  it("is insufficient with fewer than 3 retest items", () => {
    expect(retestConceptResult([item(false), item(false), item(false)], [item(true), item(true)]).outcome).toBe("insufficient");
  });
});
