import { describe, expect, it } from "vitest";
import type { Severity } from "@/domains/learning/rules";
import { buildSchedule, cycleLength, minutesByDay, pickFocus, practiceMinutes, retestMinutes, type RankedConcept, type ScheduleInput } from "./rules";

const c = (id: string, severity: Severity, o: Partial<RankedConcept> = {}): RankedConcept => ({ id, severity, estimatedMinutes: 30, prerequisites: [], ...o });

function input(ranked: RankedConcept[], o: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    ranked,
    states: {},
    conceptsById: Object.fromEntries(ranked.map((r) => [r.id, r])),
    dailyMinutes: 60,
    today: "2026-09-28", // Monday
    ...o,
  };
}

describe("cycle length and durations (ALG §11)", () => {
  it("is 7 days, or the days to the exam when closer", () => {
    expect(cycleLength("2026-09-28")).toBe(7);
    expect(cycleLength("2026-09-28", "2027-01-20")).toBe(7);
    expect(cycleLength("2026-09-28", "2026-10-01")).toBe(3);
    expect(cycleLength("2026-09-28", "2026-09-28")).toBe(1);
    expect(cycleLength("2026-09-28", "2026-09-20")).toBe(1);
  });

  it("derives practice minutes from expected seconds, default 10 for 5 questions", () => {
    expect(practiceMinutes(5)).toBe(10);
    expect(practiceMinutes(10)).toBe(20);
    expect(practiceMinutes(5, 90)).toBe(10);
    expect(practiceMinutes(5, 60)).toBe(5);
    expect(practiceMinutes(5, 200)).toBe(20);
  });

  it("makes a retest 9 minutes per concept", () => {
    expect(retestMinutes(3)).toBe(27);
    expect(retestMinutes(1)).toBe(9);
  });
});

describe("pickFocus", () => {
  it("takes up to 3 concepts that need work, in rank order", () => {
    const ranked = [c("a", "critical"), c("b", "strong"), c("c", "weak"), c("d", "needs_work"), c("e", "insufficient")];
    expect(pickFocus(input(ranked))).toEqual(["a", "c", "d"]);
  });

  it("inserts a weak prerequisite before its dependent and counts it toward 3", () => {
    const ranked = [c("dep", "weak", { prerequisites: ["pre"] }), c("x", "weak"), c("y", "weak")];
    const i = input(ranked, { states: { pre: { mastery: 30, confidence: "medium" } }, conceptsById: { pre: c("pre", "weak"), dep: ranked[0], x: ranked[1], y: ranked[2] } });
    expect(pickFocus(i)).toEqual(["pre", "dep", "x"]);
  });

  it("ignores prerequisites with insufficient evidence or mastery ≥ 50, or unknown ones", () => {
    const ranked = [c("dep", "weak", { prerequisites: ["p1", "p2", "p3"] })];
    const i = input(ranked, { states: { p1: { mastery: 30, confidence: "insufficient" }, p2: { mastery: 50, confidence: "high" } }, conceptsById: { dep: ranked[0], p1: c("p1", "weak"), p2: c("p2", "weak") } });
    expect(pickFocus(i)).toEqual(["dep"]);
  });

  it("drops the dependent when only its prerequisite fits", () => {
    const ranked = [c("a", "weak"), c("b", "weak"), c("dep", "weak", { prerequisites: ["pre"] })];
    const i = input(ranked, { states: { pre: { mastery: 20, confidence: "high" } }, conceptsById: { pre: c("pre", "weak"), a: ranked[0], b: ranked[1], dep: ranked[2] } });
    expect(pickFocus(i)).toEqual(["a", "b", "pre"]);
  });

  it("returns nothing when nothing needs work", () => {
    expect(pickFocus(input([c("a", "strong"), c("b", "stable")]))).toEqual([]);
  });
});

describe("buildSchedule (ALG §11)", () => {
  it("places the templates on their days and a retest on the last day", () => {
    const s = buildSchedule(input([c("a", "weak")]));
    expect(s.cycleDays).toBe(7);
    expect(s.focus).toEqual(["a"]);
    expect(s.tasks.map((t) => [t.day, t.type, t.minutes])).toEqual([
      [1, "learn", 30],
      [2, "practice", 10],
      [4, "revise", 10],
      [5, "practice", 10],
      [7, "retest", 9],
    ]);
    expect(s.tasks[0].date).toBe("2026-09-28");
    expect(s.retest).toEqual({ date: "2026-10-04", concepts: ["a"], minutes: 9 });
  });

  it("uses the needs-work and insufficient templates", () => {
    const nw = buildSchedule(input([c("a", "needs_work")]));
    expect(nw.tasks.filter((t) => t.type !== "retest").map((t) => [t.day, t.type])).toEqual([[1, "revise"], [2, "practice"], [4, "practice"]]);
    const ins = buildSchedule(input([c("a", "insufficient")]));
    expect(ins.tasks.filter((t) => t.type !== "retest").map((t) => [t.day, t.type])).toEqual([[1, "practice"], [2, "review"]]);
  });

  it("splits a task longer than the daily minutes and never exceeds them", () => {
    const s = buildSchedule(input([c("a", "weak", { estimatedMinutes: 100 })], { dailyMinutes: 30 }));
    const learn = s.tasks.filter((t) => t.type === "learn");
    expect(learn.map((t) => t.minutes)).toEqual([30, 30, 30, 10]);
    expect(learn.map((t) => t.part)).toEqual([1, 2, 3, 4].map((index) => ({ index, of: 4 })));
    for (const m of Object.values(minutesByDay(s.tasks))) expect(m).toBeLessThanOrEqual(30);
  });

  it("spills what cannot fit into the cycle", () => {
    const s = buildSchedule(input([c("a", "weak", { estimatedMinutes: 300 })], { dailyMinutes: 30 }));
    expect(s.spill.length).toBeGreaterThan(0);
    for (const m of Object.values(minutesByDay(s.tasks))) expect(m).toBeLessThanOrEqual(30);
  });

  it("has no retest when the exam is under 3 days away, and shortens the cycle", () => {
    const s = buildSchedule(input([c("a", "weak")], { examDate: "2026-09-30" }));
    expect(s.cycleDays).toBe(2);
    expect(s.retest).toBeNull();
    expect(s.tasks.every((t) => t.type !== "retest" && t.day <= 2)).toBe(true);
  });

  it("retests at most as many concepts as fit in the daily minutes", () => {
    const ranked = [c("a", "weak"), c("b", "weak"), c("c", "weak")];
    expect(buildSchedule(input(ranked, { dailyMinutes: 30 })).retest?.concepts).toEqual(["a", "b", "c"]);
    expect(buildSchedule(input(ranked, { dailyMinutes: 20 })).retest?.concepts).toEqual(["a", "b"]);
  });

  it("plans a dependent no earlier than its prerequisite (prerequisites first)", () => {
    const ranked = [c("dep", "weak", { prerequisites: ["pre"] }), c("other", "weak")];
    const s = buildSchedule(input(ranked, { states: { pre: { mastery: 20, confidence: "high" } }, conceptsById: { pre: c("pre", "weak"), dep: ranked[0], other: ranked[1] } }));
    expect(s.focus).toEqual(["pre", "dep", "other"]);
    const first = (id: string) => s.tasks.findIndex((t) => t.conceptId === id);
    expect(first("pre")).toBeLessThan(first("dep"));
    const day = (id: string) => Math.min(...s.tasks.filter((t) => t.conceptId === id).map((t) => t.day));
    expect(day("pre")).toBeLessThanOrEqual(day("dep"));
  });

  it("outlines up to 3 further weeks from the remaining concepts", () => {
    const ranked = Array.from({ length: 12 }, (_, i) => c(`c${i}`, "weak"));
    const s = buildSchedule(input(ranked));
    expect(s.outline).toEqual([["c3", "c4", "c5"], ["c6", "c7", "c8"], ["c9", "c10", "c11"]]);
    expect(buildSchedule(input(ranked, { examDate: "2026-10-12" })).outline).toEqual([["c3", "c4", "c5"]]);
    expect(buildSchedule(input([c("a", "weak")])).outline).toEqual([]);
  });

  it("returns an empty plan when nothing needs work", () => {
    expect(buildSchedule(input([c("a", "strong")]))).toMatchObject({ focus: [], tasks: [], retest: null });
  });

  it("orders tasks by day", () => {
    const s = buildSchedule(input([c("a", "weak"), c("b", "needs_work")]));
    const days = s.tasks.map((t) => t.day);
    expect(days).toEqual([...days].sort((x, y) => x - y));
  });
});

/* Property tests (BE-8 gate): random inputs, fixed seed. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("schedule invariants under random input", () => {
  const severities: Severity[] = ["critical", "weak", "needs_work", "insufficient", "stable", "strong"];

  it("never exceeds daily minutes, keeps prerequisites first, and stays inside the cycle", () => {
    const rand = rng(42);
    for (let run = 0; run < 300; run++) {
      const n = 1 + Math.floor(rand() * 8);
      const ranked: RankedConcept[] = Array.from({ length: n }, (_, i) => ({
        id: `c${i}`,
        severity: severities[Math.floor(rand() * severities.length)],
        estimatedMinutes: 10 + Math.floor(rand() * 120),
        prerequisites: i > 0 && rand() < 0.5 ? [`c${Math.floor(rand() * i)}`] : [],
      }));
      const states = Object.fromEntries(ranked.map((r) => [r.id, { mastery: Math.floor(rand() * 100), confidence: "medium" as const }]));
      const dailyMinutes = [30, 45, 60, 90, 120][Math.floor(rand() * 5)];
      const examDate = rand() < 0.4 ? `2026-10-${String(1 + Math.floor(rand() * 20)).padStart(2, "0")}` : null;
      const s = buildSchedule({ ranked, states, conceptsById: Object.fromEntries(ranked.map((r) => [r.id, r])), dailyMinutes, today: "2026-09-28", examDate });

      for (const m of Object.values(minutesByDay(s.tasks))) expect(m).toBeLessThanOrEqual(dailyMinutes);
      expect(s.focus.length).toBeLessThanOrEqual(3);
      expect(new Set(s.focus).size).toBe(s.focus.length);
      for (const t of s.tasks) {
        expect(t.day).toBeGreaterThanOrEqual(1);
        expect(t.day).toBeLessThanOrEqual(s.cycleDays);
        expect(t.minutes).toBeGreaterThan(0);
      }
      // A dependent's first task never precedes its prerequisite's first task when both are in focus.
      for (const id of s.focus) {
        const def = ranked.find((r) => r.id === id)!;
        for (const p of def.prerequisites) {
          if (!s.focus.includes(p)) continue;
          const firstP = s.tasks.findIndex((t) => t.conceptId === p);
          const firstD = s.tasks.findIndex((t) => t.conceptId === id);
          if (firstP >= 0 && firstD >= 0) expect(s.tasks[firstP].day).toBeLessThanOrEqual(s.tasks[firstD].day);
        }
      }
      if (s.retest) {
        expect(s.retest.date).toBe(s.tasks.find((t) => t.type === "retest")!.date);
        expect(s.cycleDays).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
