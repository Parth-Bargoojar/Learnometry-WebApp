import { describe, expect, it } from "vitest";
import { getEnv } from "./env";

const base = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

describe("env", () => {
  it("accepts an empty environment with safe defaults", () => {
    const env = getEnv(base);
    expect(env.AI_PROVIDER_FAST).toBe("mock");
    expect(env.USD_INR).toBe(84);
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3001");
  });

  it("treats blank values as unset", () => {
    const env = getEnv({ ...base, SENTRY_DSN: "", RESEND_API_KEY: "" });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("reports every invalid variable in one error, without values", () => {
    expect(() => getEnv({ ...base, DATABASE_URL: "mysql://secret-host", AI_PROVIDER_FAST: "gpt" })).toThrow(
      /DATABASE_URL[\s\S]*AI_PROVIDER_FAST|AI_PROVIDER_FAST[\s\S]*DATABASE_URL/,
    );
    try {
      getEnv({ ...base, DATABASE_URL: "mysql://secret-host" });
    } catch (e) {
      expect(String(e)).not.toContain("secret-host");
    }
  });
});
