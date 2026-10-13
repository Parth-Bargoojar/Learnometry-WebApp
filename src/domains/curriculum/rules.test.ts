import { describe, expect, it } from "vitest";
import { applyDiff, coverageState, diffEdges, edgeKey, findCycle, graphProblems, versionLabel } from "./rules";

const e = (from: string, to: string) => ({ from, to });
const known = new Set(["a", "b", "c", "d"]);

describe("diffEdges / applyDiff", () => {
  const base = [e("a", "b"), e("b", "c")];

  it("finds what a draft added and removed", () => {
    expect(diffEdges(base, [e("a", "b"), e("c", "d")])).toEqual({ added: [e("c", "d")], removed: [e("b", "c")] });
    expect(diffEdges(base, base)).toEqual({ added: [], removed: [] });
  });

  it("applies a diff to give back the draft, without duplicating an edge", () => {
    const diff = { added: [e("c", "d"), e("a", "b")], removed: [e("b", "c")] };
    expect(applyDiff(base, diff).map(edgeKey).sort()).toEqual(["a>b", "c>d"]);
  });
});

describe("findCycle", () => {
  it("is null for a chain or a diamond", () => {
    expect(findCycle([e("a", "b"), e("b", "c")])).toBeNull();
    expect(findCycle([e("a", "b"), e("a", "c"), e("b", "d"), e("c", "d")])).toBeNull();
  });
  it("returns the loop", () => {
    expect(findCycle([e("a", "b"), e("b", "c"), e("c", "a")])).toEqual(["a", "b", "c", "a"]);
  });
});

describe("graphProblems", () => {
  const names = (c: string) => c.toUpperCase();
  it("accepts a clean graph", () => {
    expect(graphProblems([e("a", "b"), e("b", "c")], known)).toEqual([]);
  });
  it("refuses self edges, unknown concepts, duplicates and loops", () => {
    expect(graphProblems([e("a", "a")], known, names)[0].message).toMatch(/own prerequisite/);
    expect(graphProblems([e("a", "zzz")], known)[0].message).toMatch(/Unknown concept/);
    expect(graphProblems([e("a", "b"), e("a", "b")], known, names)[0].message).toMatch(/listed twice/);
    expect(graphProblems([e("a", "b"), e("b", "a")], known, names)[0].message).toBe("This would create a loop: A → B → A.");
  });
});

describe("labels", () => {
  it("formats versions and coverage against the G5 target of 12", () => {
    expect(versionLabel(3)).toBe("v3");
    expect([0, 5, 12, 20].map(coverageState)).toEqual(["none", "partial", "met", "met"]);
  });
});
