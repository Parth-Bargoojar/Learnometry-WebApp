import { describe, expect, it } from "vitest";
import { loadContent } from "./load";
import { coverage, coverageGaps } from "./rules";
import { POC_CONCEPTS } from "./scope";
import { TRACKS } from "./schema";

/*
  The real question bank (BE-3.6 gate): every file parses, every validator passes, and every POC concept
  has the launch pool split on every track. A failing edit to content/ fails CI here.
*/
const { files, findings } = loadContent();

describe("content/ bank", () => {
  it("has no validation errors or warnings", () => {
    expect(findings.map((f) => `${f.severity} ${f.file} ${f.id} [${f.validator}] ${f.message}`)).toEqual([]);
  });

  it("gives every POC concept 3 diagnostic, 3 retest and 6 practice items on every track", () => {
    expect(coverageGaps(coverage(files), POC_CONCEPTS, TRACKS)).toEqual([]);
  });

  it("pairs each diagnostic item with a retest sibling in the same parallel group", () => {
    for (const f of files.filter((x) => (POC_CONCEPTS as readonly string[]).includes(x.concept))) {
      const groups = new Map<string, Set<string>>();
      for (const q of f.items) if (q.parallel_group) groups.set(q.parallel_group, (groups.get(q.parallel_group) ?? new Set()).add(q.pool));
      const diagnostics = f.items.filter((q) => q.pool === "diagnostic");
      for (const d of diagnostics) {
        if (!d.parallel_group) continue; // the original sample items predate parallel groups
        expect([...(groups.get(d.parallel_group) ?? [])].sort(), `${d.id} needs a retest sibling`).toEqual(["diagnostic", "retest"]);
      }
    }
  });

  it("gives every MCQ a single correct option and names the mistake behind each wrong option of a diagnostic item", () => {
    for (const f of files)
      for (const q of f.items) {
        if (q.type !== "mcq" || q.pool !== "diagnostic") continue;
        const wrong = q.options!.filter((o) => o.key !== q.answer);
        expect(wrong.every((o) => o.misconception), `${q.id} has an unexplained wrong option`).toBe(true);
      }
  });
});
