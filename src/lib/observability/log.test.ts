import { describe, expect, it } from "vitest";
import { createLogger, hashUserId } from "./log";

describe("logger", () => {
  it("writes JSON lines and redacts sensitive keys, including nested ones", () => {
    const lines: string[] = [];
    const log = createLogger({ service: "t" }, (l) => lines.push(l), "debug");
    log.info("hello", { email: "a@b.c", nested: { token: "abc", ok: 1 }, answers: ["A"] });
    const row = JSON.parse(lines[0]);
    expect(row).toMatchObject({ level: "info", msg: "hello", service: "t", email: "[redacted]", answers: "[redacted]" });
    expect(row.nested).toEqual({ token: "[redacted]", ok: 1 });
  });

  it("respects the minimum level and child context", () => {
    const lines: string[] = [];
    const log = createLogger({}, (l) => lines.push(l), "warn").child({ request_id: "r1" });
    log.info("skip");
    log.warn("keep");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).request_id).toBe("r1");
  });

  it("serialises errors without a stack and hashes user ids", () => {
    const lines: string[] = [];
    createLogger({}, (l) => lines.push(l), "error").error("boom", { err: new Error("x") });
    expect(JSON.parse(lines[0]).err).toEqual({ name: "Error", message: "x" });
    expect(hashUserId("u1")).toMatch(/^[0-9a-f]{12}$/);
    expect(hashUserId("u1")).toBe(hashUserId("u1"));
  });
});
