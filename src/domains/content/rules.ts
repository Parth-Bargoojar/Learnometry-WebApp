import katex from "katex";
import { contentHash } from "./hash";
import { POOLS, POOL_TARGET, TRACKS, conceptFileSchema, questionSchema, type ConceptFile, type Pool, type QuestionItem, type Track } from "./schema";

/*
  Deterministic content validators (BE-3.2). Pure functions: no database, no network. The
  semantic checks (is it correct, is the difficulty right, is it exam-style, is it safe) are
  LLM validators run later (BE-6); these catch everything a program can prove.
*/

export { contentHash };
export type Severity = "error" | "warning";
export interface Finding {
  file: string;
  id: string;
  validator: "schema" | "math" | "answer" | "options" | "duplicate";
  severity: Severity;
  message: string;
}

/* ---------- Parsing ---------- */

export function parseConceptFile(path: string, raw: unknown): { file?: ConceptFile; findings: Finding[] } {
  const findings: Finding[] = [];
  const head = conceptFileSchema.safeParse(raw);
  if (!head.success) {
    for (const i of head.error.issues) findings.push({ file: path, id: "(file)", validator: "schema", severity: "error", message: `${i.path.join(".") || "file"}: ${i.message}` });
    return { findings };
  }
  const items: QuestionItem[] = [];
  head.data.questions.forEach((entry, index) => {
    const id = typeof (entry as { id?: unknown })?.id === "string" ? (entry as { id: string }).id : `#${index + 1}`;
    const parsed = questionSchema.safeParse(entry);
    if (parsed.success) items.push(parsed.data);
    else for (const i of parsed.error.issues) findings.push({ file: path, id, validator: "schema", severity: "error", message: `${i.path.join(".") || "item"}: ${i.message}` });
  });
  return { file: { path, concept: head.data.concept, items }, findings };
}

/* ---------- KaTeX ---------- */

const SPAN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/** Every `$$…$$` and `$…$` span in a Markdown string. */
export function mathSpans(markdown: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = [];
  for (const m of markdown.matchAll(SPAN)) out.push(m[1] !== undefined ? { tex: m[1], display: true } : { tex: m[2], display: false });
  return out;
}

export function texProblems(markdown: string): string[] {
  const problems: string[] = [];
  if (markdown.replace(SPAN, "").includes("$")) problems.push("an unmatched $ (a math span is not closed)");
  for (const { tex, display } of mathSpans(markdown)) {
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: "error" });
    } catch (e) {
      problems.push(`${tex.slice(0, 40)}: ${(e as Error).message.replace(/^KaTeX parse error: /, "")}`);
    }
  }
  return problems;
}

/* ---------- Per-item checks ---------- */

const GIVEAWAY = /\b(all|none) of the (above|these)\b|\bboth (a|b) and (b|c|d)\b/i;

export function checkItem(file: string, q: QuestionItem): Finding[] {
  const out: Finding[] = [];
  const add = (validator: Finding["validator"], severity: Severity, message: string) => out.push({ file, id: q.id, validator, severity, message });

  // Math: every field a learner reads must render.
  const fields: [string, string][] = [
    ["stem", q.stem],
    ["hint", q.hint ?? ""],
    ...q.solution.map((s, i): [string, string] => [`solution[${i}]`, s]),
    ...(q.options ?? []).map((o): [string, string] => [`option ${o.key}`, o.text]),
  ];
  for (const [name, value] of fields) for (const p of texProblems(value)) add("math", "error", `${name}: ${p}`);

  // Answer.
  if (q.type === "mcq" && typeof q.answer === "string") {
    const keys = (q.options ?? []).map((o) => o.key);
    if (!keys.includes(q.answer)) add("answer", "error", `answer ${q.answer} is not one of the option keys (${keys.join(", ")})`);
  }
  if (q.type === "numerical" && typeof q.answer !== "string") {
    const { value, tolerance, tolerance_pct } = q.answer;
    if (tolerance === undefined && tolerance_pct === undefined && !Number.isInteger(value)) add("answer", "warning", "a non-integer answer should state a tolerance or tolerance_pct");
    const band = tolerance ?? (tolerance_pct !== undefined ? (Math.abs(value) * tolerance_pct) / 100 : 0);
    for (const w of q.wrong_answers ?? []) if (Math.abs(w.value - value) <= band) add("answer", "error", `wrong answer ${w.value} falls inside the accepted range of ${value}`);
    const values = (q.wrong_answers ?? []).map((w) => w.value);
    if (new Set(values).size !== values.length) add("answer", "warning", "wrong_answers lists the same value twice");
  }

  // Options.
  if (q.options) {
    const keys = q.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) add("options", "error", "option keys repeat");
    if (keys.join("") !== [...keys].sort().join("")) add("options", "warning", "option keys are not in order");
    const texts = q.options.map((o) => o.text.replace(/\s+/g, " ").toLowerCase());
    if (new Set(texts).size !== texts.length) add("options", "error", "two options have the same text");
    if (q.options.some((o) => GIVEAWAY.test(o.text))) add("options", "warning", "“all/none of the above” options make the item hard to score fairly");
    for (const o of q.options) if (o.misconception && o.key === q.answer) add("options", "error", `option ${o.key} is the correct answer but carries a misconception note`);
    const noted = q.options.filter((o) => o.key !== q.answer && o.misconception).length;
    if (noted === 0 && q.pool === "diagnostic") add("options", "warning", "no wrong option names its misconception; diagnosis will have less to go on");
  }

  // A diagnostic item that needs minutes is a practice item.
  if (q.pool === "diagnostic" && q.expected_seconds > 180) add("options", "warning", `expected_seconds ${q.expected_seconds} is long for a diagnostic item`);
  return out;
}

/* ---------- Across files ---------- */

export function checkAll(files: ConceptFile[]): Finding[] {
  const out: Finding[] = [];
  const ids = new Map<string, string>();
  const hashes = new Map<string, { id: string; file: string }>();
  for (const f of files) {
    for (const q of f.items) {
      out.push(...checkItem(f.path, q));
      const seen = ids.get(q.id);
      if (seen) out.push({ file: f.path, id: q.id, validator: "duplicate", severity: "error", message: `id already used in ${seen}` });
      else ids.set(q.id, f.path);
      const h = contentHash(q);
      const dup = hashes.get(h);
      if (dup && dup.id !== q.id) out.push({ file: f.path, id: q.id, validator: "duplicate", severity: "error", message: `same content as ${dup.id} (${dup.file})` });
      else hashes.set(h, { id: q.id, file: f.path });
    }
    // A parallel group needs a sibling, otherwise there is nothing to compare.
    const groups = new Map<string, QuestionItem[]>();
    for (const q of f.items) if (q.parallel_group) groups.set(q.parallel_group, [...(groups.get(q.parallel_group) ?? []), q]);
    for (const [g, members] of groups) if (members.length < 2) out.push({ file: f.path, id: members[0].id, validator: "schema", severity: "warning", message: `parallel_group ${g} has only one item` });
  }
  return out;
}

/* ---------- Coverage ---------- */

export type Coverage = Record<string, Record<Track, Record<Pool, number>>>;

export function coverage(files: ConceptFile[]): Coverage {
  const out: Coverage = {};
  for (const f of files) {
    const row = (out[f.concept] ??= Object.fromEntries(TRACKS.map((t) => [t, Object.fromEntries(POOLS.map((p) => [p, 0]))])) as Record<Track, Record<Pool, number>>);
    for (const q of f.items) for (const t of q.tracks) row[t][q.pool]++;
  }
  return out;
}

export interface CoverageGap {
  concept: string;
  track: Track;
  pool: Pool;
  have: number;
  need: number;
}

/** Concept/track/pool cells short of the launch target (3 diagnostic, 3 retest, 6 practice). */
export function coverageGaps(cov: Coverage, concepts: readonly string[], tracks: readonly Track[] = TRACKS): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const concept of concepts)
    for (const track of tracks)
      for (const pool of POOLS) {
        const have = cov[concept]?.[track]?.[pool] ?? 0;
        if (have < POOL_TARGET[pool]) gaps.push({ concept, track, pool, have, need: POOL_TARGET[pool] });
      }
  return gaps;
}

export const difficultyFor = (q: QuestionItem, track: Track) => q.track_difficulty?.[track] ?? q.difficulty;
