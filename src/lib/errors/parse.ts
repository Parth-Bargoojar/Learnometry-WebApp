import type { z } from "zod";
import { AppError } from "./app-error";

/**
 * Parse untrusted input with Zod and turn a failure into a `validation_failed` error carrying
 * per-field messages (first message wins per field). `rename` maps schema keys to the ids the
 * form uses (e.g. `password` → `new-password`).
 */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown, rename: Record<string, string> = {}): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    const id = rename[key] ?? key;
    fields[id] ??= issue.message;
  }
  throw new AppError("validation_failed", { fields, message: Object.values(fields)[0] });
}
