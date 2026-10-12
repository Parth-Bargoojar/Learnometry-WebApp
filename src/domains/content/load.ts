import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { checkAll, parseConceptFile, type Finding } from "./rules";
import type { ConceptFile } from "./schema";

/* Reads `content/**.yaml` from disk (scripts and tests only; never imported by the app). */

export const CONTENT_DIR = path.resolve(process.cwd(), "content");

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.ya?ml$/.test(name) ? [full] : [];
    });
}

export interface LoadedContent {
  files: ConceptFile[];
  findings: Finding[];
}

export function loadContent(dir: string = CONTENT_DIR): LoadedContent {
  const files: ConceptFile[] = [];
  const findings: Finding[] = [];
  for (const full of walk(dir)) {
    const rel = path.relative(dir, full).split(path.sep).join("/");
    let raw: unknown;
    try {
      raw = parse(readFileSync(full, "utf8"));
    } catch (e) {
      findings.push({ file: rel, id: "(file)", validator: "schema", severity: "error", message: `YAML: ${(e as Error).message.split("\n")[0]}` });
      continue;
    }
    const parsed = parseConceptFile(rel, raw);
    findings.push(...parsed.findings);
    if (parsed.file) {
      // The folder layout is part of the contract: <subject>/<chapter>/<concept>.yaml.
      if (path.basename(full).replace(/\.ya?ml$/, "") !== parsed.file.concept) {
        findings.push({ file: rel, id: "(file)", validator: "schema", severity: "error", message: `file name must match its concept (${parsed.file.concept}.yaml)` });
      }
      files.push(parsed.file);
    }
  }
  findings.push(...checkAll(files));
  return { files, findings };
}
