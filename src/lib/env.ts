import "server-only";
import { z } from "zod";

/*
  Environment contract (ARCHITECTURE §6, BE-D4). Validated once at boot (`instrumentation.ts`)
  and on first use. Variables that belong to a later stage are optional here and become
  required where they are first used, through `requireEnv`, so a half-configured
  environment fails with a clear message instead of a vague runtime error.
  Empty strings count as unset (a blank line in .env.local).
*/
const blank = (v: unknown) => (v === "" ? undefined : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());

const aiProvider = z.enum(["mock", "anthropic", "openai_compatible"]);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.preprocess(blank, z.url().default("http://localhost:3001")),
  NEXT_PUBLIC_MARKETING_URL: opt(z.url()),

  // BE-1
  NEXT_PUBLIC_SUPABASE_URL: opt(z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: opt(z.string().min(20)),
  SUPABASE_SERVICE_ROLE_KEY: opt(z.string().min(20)),
  DATABASE_URL: opt(z.string().startsWith("postgres")),
  DIRECT_DATABASE_URL: opt(z.string().startsWith("postgres")),

  // BE-2
  INNGEST_EVENT_KEY: opt(z.string()),
  INNGEST_SIGNING_KEY: opt(z.string()),
  RESEND_API_KEY: opt(z.string()),
  EMAIL_FROM: z.preprocess(blank, z.string().default("Learnometry <no-reply@localhost>")),

  // BE-6
  AI_PROVIDER_FAST: z.preprocess(blank, aiProvider.default("mock")),
  AI_PROVIDER_STANDARD: z.preprocess(blank, aiProvider.default("mock")),
  AI_PROVIDER_REASONING: z.preprocess(blank, aiProvider.default("mock")),
  AI_MODEL_FAST: opt(z.string()),
  AI_MODEL_STANDARD: opt(z.string()),
  AI_MODEL_REASONING: opt(z.string()),
  AI_FALLBACK_PROVIDER: opt(aiProvider),
  ANTHROPIC_API_KEY: opt(z.string()),
  AI_OPENAI_COMPAT_BASE_URL: opt(z.url()),
  AI_OPENAI_COMPAT_API_KEY: opt(z.string()),
  USD_INR: z.preprocess(blank, z.coerce.number().positive().default(84)),

  // BE-10
  RAZORPAY_KEY_ID: opt(z.string()),
  RAZORPAY_KEY_SECRET: opt(z.string()),
  RAZORPAY_WEBHOOK_SECRET: opt(z.string()),
  RAZORPAY_PLAN_ID_STARTER: opt(z.string()),
  RAZORPAY_PLAN_ID_PLUS: opt(z.string()),
  RAZORPAY_PLAN_ID_PRO: opt(z.string()),

  // BE-11
  CONSENT_TOKEN_SECRET: opt(z.string().min(32)),
  PII_ENCRYPTION_KEY: opt(z.string().min(43)), // 32 bytes, base64
  MSG91_AUTH_KEY: opt(z.string()),
  MSG91_OTP_TEMPLATE_ID: opt(z.string()),

  // BE-12
  VAPID_PRIVATE_KEY: opt(z.string()),
  VAPID_SUBJECT: opt(z.string()),

  // Observability
  SENTRY_DSN: opt(z.url()),
  POSTHOG_KEY: opt(z.string()),
  POSTHOG_HOST: opt(z.url()),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parse and cache `process.env`. Throws one error listing every invalid variable. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** A variable a feature cannot work without. Fails with the variable's name, never its value. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = getEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing environment variable ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}

/** Test hook: forget the cached parse. */
export function resetEnvCache() {
  cached = undefined;
}
