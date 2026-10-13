import { createHash } from "node:crypto";
import type { QuestionItem } from "./schema";

/** Normalised content hash: formatting changes do not count as new content. */
export function contentHash(q: Pick<QuestionItem, "stem" | "options" | "answer">): string {
  const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const payload = JSON.stringify([squash(q.stem), (q.options ?? []).map((o) => [o.key, squash(o.text)]), q.answer]);
  return createHash("sha256").update(payload).digest("hex");
}
