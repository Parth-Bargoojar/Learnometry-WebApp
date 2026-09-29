import { describe, expect, it, vi } from "vitest";
import { AppError, ERROR_STATUS } from "./app-error";
import { ERROR_MESSAGES } from "./messages";
import { fail, ok, run, toErrorBody } from "./result";

describe("error model", () => {
  it("has user copy for every code", () => {
    for (const code of Object.keys(ERROR_STATUS)) {
      expect(ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]).toBeTruthy();
    }
  });

  it("maps AppError to a body with copy, fields and status", () => {
    const e = new AppError("validation_failed", { fields: { email: "Enter a valid email" } });
    expect(e.status).toBe(422);
    expect(toErrorBody(e)).toEqual({
      code: "validation_failed",
      message: ERROR_MESSAGES.validation_failed,
      fields: { email: "Enter a valid email" },
    });
  });

  it("keeps a custom message and retryAfter", () => {
    expect(toErrorBody(new AppError("rate_limited", { message: "Slow down", retryAfter: 30 }))).toEqual({
      code: "rate_limited",
      message: "Slow down",
      retryAfter: 30,
    });
  });

  it("hides unknown errors behind `internal`", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const body = toErrorBody(new Error("connection string postgres://secret"));
    write.mockRestore();
    expect(body.code).toBe("internal");
    expect(body.message).not.toContain("secret");
  });

  it("run() wraps success and failure, and rethrows Next control flow", async () => {
    expect(await run(async () => 5)).toEqual(ok(5));
    expect(await run(async () => { throw new AppError("forbidden"); })).toEqual(fail(new AppError("forbidden")));
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await expect(run(async () => { throw redirect; })).rejects.toBe(redirect);
  });
});
