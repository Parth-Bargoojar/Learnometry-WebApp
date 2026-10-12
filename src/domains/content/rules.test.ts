import { describe, expect, it } from "vitest";
import { checkAll, checkItem, contentHash, coverage, coverageGaps, difficultyFor, mathSpans, parseConceptFile, texProblems } from "./rules";
import { questionSchema, type ConceptFile, type QuestionItem } from "./schema";

const mcq = (over: Record<string, unknown> = {}) =>
  ({
    id: "t-d01",
    type: "mcq",
    difficulty: "easy",
    expected_seconds: 90,
    pool: "diagnostic",
    stem: "A $2\\,\\text{kg}$ block rests on a rough incline. What is $f$?",
    options: [
      { key: "A", text: "$5$ N", misconception: "halved the weight" },
      { key: "B", text: "$10$ N" },
      { key: "C", text: "$20$ N" },
    ],
    answer: "B",
    solution: ["Friction balances $mg\\sin\\theta$."],
    ...over,
  }) as Record<string, unknown>;
const item = (over: Record<string, unknown> = {}): QuestionItem => questionSchema.parse(mcq(over));
const numeric = (over: Record<string, unknown> = {}) => item({ type: "numerical", options: undefined, answer: { value: 4, tolerance: 0.1 }, ...over });
const file = (items: QuestionItem[], concept = "t"): ConceptFile => ({ path: `physics/x/${concept}.yaml`, concept, items });
const messages = (fs: { message: string }[]) => fs.map((f) => f.message);

describe("question schema", () => {
  it("accepts a complete MCQ and applies defaults", () => {
    const q = item();
    expect(q.tracks).toEqual(["jee_main", "neet", "cbse_11"]);
    expect(q.format).toBe("standard");
    expect(q.misread_risk).toBe(false);
  });

  it("rejects the shapes the engine cannot use", () => {
    expect(questionSchema.safeParse(mcq({ options: undefined })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ answer: { value: 3 } })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ wrong_answers: [{ value: 1, category: "calculation" }] })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ id: "Bad Id" })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ surprise: 1 })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ source_type: "licensed" })).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ source_type: "licensed", source_reference: "NCERT Ex 4.2" })).success).toBe(true);
    const raw = mcq({ type: "numerical", options: undefined });
    expect(questionSchema.safeParse({ ...raw, answer: "B" }).success).toBe(false);
    expect(questionSchema.safeParse({ ...raw, answer: { value: 4 }, options: [{ key: "A", text: "x" }, { key: "B", text: "y" }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...raw, answer: { value: 4, tolerance: 0.1, tolerance_pct: 2 } }).success).toBe(false);
    expect(questionSchema.safeParse(mcq({ expected_seconds: 5 })).success).toBe(false);
  });
});

describe("parseConceptFile", () => {
  it("returns the valid items and reports each bad one by id", () => {
    const { file: f, findings } = parseConceptFile("a.yaml", { concept: "t", questions: [mcq(), mcq({ id: "t-d02", answer: 7 }), { stem: "no id" }] });
    expect(f?.items.map((i) => i.id)).toEqual(["t-d01"]);
    expect(findings.map((x) => x.id)).toEqual(expect.arrayContaining(["t-d02", "#3"]));
    expect(findings.every((x) => x.validator === "schema" && x.severity === "error")).toBe(true);
  });

  it("rejects a file without a concept", () => {
    const { file: f, findings } = parseConceptFile("a.yaml", { questions: [] });
    expect(f).toBeUndefined();
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe("KaTeX", () => {
  it("finds inline and display spans", () => {
    expect(mathSpans("a $x$ b $$y^2$$ c")).toEqual([
      { tex: "x", display: false },
      { tex: "y^2", display: true },
    ]);
  });
  it("passes valid math and plain text", () => {
    expect(texProblems("Price is 5 rupees, $\\frac{1}{2}mv^2$")).toEqual([]);
  });
  it("flags an unknown command and an unclosed span", () => {
    expect(texProblems("$\\notacommand{x}$").length).toBe(1);
    expect(texProblems("cost $5 and more")[0]).toMatch(/unmatched/);
  });
});

describe("checkItem", () => {
  it("is clean for a good item", () => {
    expect(checkItem("f", item())).toEqual([]);
  });

  it("flags math that will not render in any field", () => {
    const out = checkItem("f", item({ stem: "bad $\\oops$", hint: "$\\nope$", solution: ["$\\x{$"], options: [{ key: "A", text: "$\\bad$" }, { key: "B", text: "ok" }] }));
    expect(out.filter((f) => f.validator === "math").length).toBeGreaterThanOrEqual(4);
  });

  it("flags an answer that is not an option", () => {
    expect(messages(checkItem("f", item({ answer: "D" })))).toEqual([expect.stringContaining("not one of the option keys")]);
  });

  it("checks option sanity", () => {
    const dup = checkItem("f", item({ options: [{ key: "A", text: "Same", misconception: "m" }, { key: "B", text: "same" }] }));
    expect(messages(dup)).toContain("two options have the same text");
    const keys = checkItem("f", item({ options: [{ key: "B", text: "x" }, { key: "B", text: "y" }], answer: "B" }));
    expect(messages(keys)).toContain("option keys repeat");
    const order = checkItem("f", item({ options: [{ key: "B", text: "x", misconception: "m" }, { key: "A", text: "y" }], answer: "A" }));
    expect(messages(order)).toContain("option keys are not in order");
    const all = checkItem("f", item({ options: [{ key: "A", text: "None of the above", misconception: "m" }, { key: "B", text: "ok" }] }));
    expect(messages(all).join()).toMatch(/all\/none/);
    const flagged = checkItem("f", item({ options: [{ key: "A", text: "x", misconception: "m" }, { key: "B", text: "y", misconception: "wrongly noted" }] }));
    expect(messages(flagged).join()).toMatch(/correct answer but carries/);
  });

  it("warns when a diagnostic item has no misconception notes, but not a practice item", () => {
    const bare = { options: [{ key: "A", text: "x" }, { key: "B", text: "y" }] };
    expect(messages(checkItem("f", item(bare))).join()).toMatch(/misconception/);
    expect(checkItem("f", item({ ...bare, pool: "practice" }))).toEqual([]);
  });

  it("warns on a slow diagnostic item", () => {
    expect(messages(checkItem("f", item({ expected_seconds: 240 }))).join()).toMatch(/long for a diagnostic/);
  });

  it("checks numerical answers and the known wrong values", () => {
    expect(checkItem("f", numeric())).toEqual([]);
    expect(messages(checkItem("f", numeric({ answer: { value: 4.5 } })))).toEqual([expect.stringContaining("tolerance")]);
    expect(messages(checkItem("f", numeric({ wrong_answers: [{ value: 4.05, category: "calculation" }] }))).join()).toMatch(/inside the accepted range/);
    expect(messages(checkItem("f", numeric({ answer: { value: 100, tolerance_pct: 2 }, wrong_answers: [{ value: 101, category: "calculation" }] }))).join()).toMatch(/inside the accepted range/);
    expect(messages(checkItem("f", numeric({ wrong_answers: [{ value: 8, category: "conceptual" }, { value: 8, category: "calculation" }] }))).join()).toMatch(/same value twice/);
    expect(checkItem("f", numeric({ wrong_answers: [{ value: 8, category: "conceptual" }] }))).toEqual([]);
  });
});

describe("checkAll", () => {
  it("catches a repeated id and repeated content, across files", () => {
    const out = checkAll([file([item()], "a"), file([item(), item({ id: "t-d02" })], "b")]);
    expect(messages(out).join("|")).toMatch(/id already used in physics\/x\/a\.yaml/);
    expect(messages(out).join("|")).toMatch(/same content as t-d01/);
  });

  it("ignores formatting differences when hashing", () => {
    expect(contentHash(item({ stem: "  The  Stem " }))).toBe(contentHash(item({ stem: "the stem" })));
    expect(contentHash(item({ stem: "one" }))).not.toBe(contentHash(item({ stem: "two" })));
  });

  it("warns about a parallel group with one member", () => {
    const lone = checkAll([file([item({ parallel_group: "pg-1" })])]);
    expect(messages(lone).join()).toMatch(/only one item/);
    const pair = checkAll([file([item({ parallel_group: "pg-1" }), item({ id: "t-r01", pool: "retest", parallel_group: "pg-1", stem: "other $x$" })])]);
    expect(messages(pair).join()).not.toMatch(/only one item/);
  });
});

describe("coverage", () => {
  const items = [
    ...["d1", "d2", "d3"].map((id) => item({ id: `t-${id}`, stem: `s ${id}` })),
    item({ id: "t-r1", pool: "retest", stem: "s r1" }),
    item({ id: "t-n1", pool: "practice", tracks: ["neet"], stem: "s n1" }),
  ];
  const cov = coverage([file(items)]);

  it("counts items per concept, track and pool", () => {
    expect(cov.t.jee_main).toEqual({ diagnostic: 3, retest: 1, practice: 0 });
    expect(cov.t.neet.practice).toBe(1);
  });

  it("lists every cell below the 3/3/6 target", () => {
    const gaps = coverageGaps(cov, ["t", "missing"], ["jee_main"]);
    expect(gaps).toEqual(
      expect.arrayContaining([
        { concept: "t", track: "jee_main", pool: "retest", have: 1, need: 3 },
        { concept: "t", track: "jee_main", pool: "practice", have: 0, need: 6 },
        { concept: "missing", track: "jee_main", pool: "diagnostic", have: 0, need: 3 },
      ]),
    );
    expect(gaps.some((g) => g.concept === "t" && g.pool === "diagnostic")).toBe(false);
  });
});

describe("difficultyFor", () => {
  it("uses the track override when present", () => {
    const q = item({ track_difficulty: { neet: "hard" } });
    expect(difficultyFor(q, "neet")).toBe("hard");
    expect(difficultyFor(q, "jee_main")).toBe("easy");
  });
});
