import { createHash } from "node:crypto";

/*
  Structured logger (BE-D48): JSON lines, one per event. Never log emails, phone numbers,
  answers, question text or tokens — those keys are redacted even if a caller passes them.
*/
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = /^(email|phone|password|token|secret|authorization|cookie|otp|answer|answers|stem|question|dob|otp_code|api_?key)$/i;

/** Stable, non-reversible id for correlating a user's log lines. */
export const hashUserId = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);

function clean(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, code: (value as { code?: unknown }).code };
  if (value === null || typeof value !== "object") return value;
  if (depth > 3) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => clean(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : clean(v, depth + 1);
  return out;
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(base: Record<string, unknown>): Logger;
}

export function createLogger(
  base: Record<string, unknown> = {},
  sink: (line: string) => void = (l) => process.stdout.write(l + "\n"),
  minLevel: Level = process.env.NODE_ENV === "test" ? "error" : "info",
): Logger {
  const emit = (level: Level, msg: string, ctx?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level, msg, ...(clean({ ...base, ...ctx }) as object) }));
  };
  return {
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
    child: (b) => createLogger({ ...base, ...b }, sink, minLevel),
  };
}

export const logger = createLogger();
