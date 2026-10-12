import { cyclePath, type Edge } from "@/domains/admin/rules";

/*
  Curriculum graph rules (BE-3.5, K7). Edges are by concept code and mean "from is a prerequisite of
  to". Pure functions: the service loads and stores, these decide.
*/

export const G5_TARGET = 12;

export const edgeKey = (e: Edge) => `${e.from}>${e.to}`;

export interface EdgeDiff {
  added: Edge[];
  removed: Edge[];
}

export function diffEdges(baseline: Edge[], draft: Edge[]): EdgeDiff {
  const base = new Set(baseline.map(edgeKey));
  const now = new Set(draft.map(edgeKey));
  return { added: draft.filter((e) => !base.has(edgeKey(e))), removed: baseline.filter((e) => !now.has(edgeKey(e))) };
}

export const applyDiff = (baseline: Edge[], diff: EdgeDiff): Edge[] => {
  const gone = new Set(diff.removed.map(edgeKey));
  const kept = baseline.filter((e) => !gone.has(edgeKey(e)));
  const have = new Set(kept.map(edgeKey));
  return [...kept, ...diff.added.filter((e) => !have.has(edgeKey(e)))];
};

/** The first loop in the graph (as a path of codes), or null when it is acyclic. */
export function findCycle(edges: Edge[]): string[] | null {
  const built: Edge[] = [];
  for (const e of edges) {
    const loop = cyclePath(built, e.from, e.to);
    if (loop) return [...loop, e.to];
    built.push(e);
  }
  return null;
}

export interface GraphProblem {
  edge?: Edge;
  message: string;
}

/** Everything wrong with a proposed edge set; empty means it can be saved as a draft. */
export function graphProblems(edges: Edge[], knownCodes: ReadonlySet<string>, names: (code: string) => string = (c) => c): GraphProblem[] {
  const out: GraphProblem[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!knownCodes.has(e.from) || !knownCodes.has(e.to)) out.push({ edge: e, message: `Unknown concept in ${e.from} → ${e.to}.` });
    else if (e.from === e.to) out.push({ edge: e, message: `${names(e.from)} cannot be its own prerequisite.` });
    if (seen.has(edgeKey(e))) out.push({ edge: e, message: `${names(e.from)} → ${names(e.to)} is listed twice.` });
    seen.add(edgeKey(e));
  }
  if (out.length === 0) {
    const loop = findCycle(edges);
    if (loop) out.push({ message: `This would create a loop: ${loop.map(names).join(" → ")}.` });
  }
  return out;
}

/** "v3" for version 3; the console shows the number with a leading v. */
export const versionLabel = (n: number) => `v${n}`;

/** Where a concept stands against the launch target. */
export const coverageState = (published: number) => (published >= G5_TARGET ? "met" : published > 0 ? "partial" : "none");
