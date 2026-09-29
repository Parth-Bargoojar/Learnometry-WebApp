import { describe, expect, it } from "vitest";
import { difficultyMix, mixCounts, selectPractice, type PracticePoolItem } from "./rules";

const mk = (id: string, difficulty: "easy" | "medium" | "hard", lastSeenAt: number | null = null): PracticePoolItem => ({ id, difficulty, lastSeenAt });
const pool = [
  ...["e1", "e2", "e3", "e4"].map((id) => mk(id, "easy")),
  ...["m1", "m2", "m3", "m4"].map((id) => mk(id, "medium")),
  ...["h1", "h2", "h3", "h4"].map((id) => mk(id, "hard")),
];

describe("difficulty mix (§1.9)", () => {
  it("matches severity to a mix", () => {
    expect(difficultyMix("critical")).toEqual({ easy: 0.6, medium: 0.4, hard: 0 });
    expect(difficultyMix("weak")).toEqual(difficultyMix("critical"));
    expect(difficultyMix("needs_work")).toEqual({ easy: 0, medium: 1, hard: 0 });
    expect(difficultyMix("insufficient").medium).toBe(1);
    expect(difficultyMix("stable")).toEqual({ easy: 0, medium: 0.5, hard: 0.5 });
    expect(difficultyMix("strong")).toEqual(difficultyMix("stable"));
  });

  it("turns shares into whole counts that add up", () => {
    expect(mixCounts("weak", 5)).toEqual({ easy: 3, medium: 2, hard: 0 });
    expect(mixCounts("stable", 5)).toEqual({ easy: 0, medium: 3, hard: 2 });
    for (const sev of ["critical", "needs_work", "strong", "insufficient"] as const) {
      for (const size of [5, 10, 15]) {
        const c = mixCounts(sev, size);
        expect(c.easy + c.medium + c.hard).toBe(size);
      }
    }
  });
});

describe("selectPractice (ALG §9)", () => {
  it("builds a matched set, easy → hard", () => {
    const s = selectPractice({ severity: "weak", size: 5, pool });
    expect(s.itemIds).toEqual(["e1", "e2", "e3", "m1", "m2"]);
    expect(s).toMatchObject({ reusedSeen: false, short: false });
  });

  it("takes unseen items before seen ones, then the least recently seen", () => {
    const seen = pool.map((p) => (p.difficulty === "medium" ? { ...p, lastSeenAt: 100 + Number(p.id[1]) } : p));
    const unseenFirst = selectPractice({ severity: "needs_work", size: 5, pool: seen });
    expect(unseenFirst.itemIds.every((id) => !id.startsWith("m"))).toBe(true);
    expect(unseenFirst.reusedSeen).toBe(false);

    const allSeen = pool.map((p, i) => ({ ...p, lastSeenAt: 1000 - i }));
    const reuse = selectPractice({ severity: "needs_work", size: 3, pool: allSeen });
    expect(reuse.reusedSeen).toBe(true);
    expect(reuse.itemIds).toHaveLength(3);
  });

  it("falls back to the nearest difficulty and flags a short pool", () => {
    const onlyHard = [mk("h1", "hard"), mk("h2", "hard")];
    const s = selectPractice({ severity: "weak", size: 5, pool: onlyHard });
    expect(s.itemIds).toEqual(["h1", "h2"]);
    expect(s.short).toBe(true);
    expect(selectPractice({ severity: "weak", size: 5, pool: [] })).toEqual({ itemIds: [], reusedSeen: false, short: true });
  });

  it("never repeats an item and is deterministic", () => {
    const a = selectPractice({ severity: "strong", size: 10, pool });
    const b = selectPractice({ severity: "strong", size: 10, pool: [...pool].reverse() });
    expect(new Set(a.itemIds).size).toBe(a.itemIds.length);
    expect(a.itemIds).toEqual(b.itemIds);
  });
});
