import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
  Dependency rules (BE-D11, ARCHITECTURE §1) made mechanical. Each block restricts imports
  for a set of files; flat config replaces (not merges) `no-restricted-imports` per file,
  so every block lists ALL patterns that apply to its files.
*/
const SERVICE_LAYER = ["@/domains/*/service", "@/domains/*/queries", "@/domains/*/schemas", "@/inngest/*"];
const INFRA = ["@/lib/db", "@/lib/db/*", "@/lib/env", "@/lib/auth", "@/lib/auth/*", "@/lib/messaging/*", "@/lib/push/*", "@/lib/storage/*"];
// Package names, matched exactly (a `paths` entry), so `@/inngest/client` is not mistaken for the `inngest` SDK.
const VENDOR_SDKS = ["@anthropic-ai/sdk", "openai", "razorpay", "resend", "web-push", "postgres", "drizzle-orm", "inngest"];
const AI_PROVIDERS = "@/lib/ai/providers/*";
const DB_SYSTEM = "@/lib/db/system";

const group = (patterns, message) => ({ group: patterns, message });

const providerRule = group([AI_PROVIDERS], "Only lib/ai/gateway may import AI providers (BE-D11). Call the gateway.");
const systemRule = group([DB_SYSTEM], "db.system bypasses RLS: only jobs, webhooks, the credit ledger and admin services after requireAdmin() (BE-D16).");
const sdkPaths = VENDOR_SDKS.map((name) => ({ name, message: "Vendor SDKs are imported only inside their adapter in src/lib (BE-D11)." }));

const restrict = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });
const restrictWithSdks = (...patterns) => ({ "no-restricted-imports": ["error", { patterns, paths: sdkPaths }] });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Default rule for the app: no direct provider access, no RLS bypass.
  {
    files: ["src/**/*.{ts,tsx}"],
    // db.system is for the trusted server layer only (BE-D16, amended by BE-D74): domain services, jobs, webhooks, the ledger, admin.
    ignores: ["src/lib/ai/gateway/**", "src/lib/db/**", "src/lib/flags.ts", "src/inngest/**", "src/domains/**/service.ts", "src/domains/credits/**", "src/domains/admin/**", "src/app/api/**", "**/*.test.ts"],
    rules: restrict(providerRule, systemRule, group(["razorpay"], "Only src/lib/payments imports Razorpay (BE-D11).")),
  },
  // Pure rules: no I/O, no framework, no service layer, no clock.
  {
    files: ["src/domains/**/rules.ts", "src/domains/**/costs.ts", "src/domains/**/constants.ts"],
    rules: restrictWithSdks(
      group([...SERVICE_LAYER, ...INFRA, "next", "next/*", "react", "react-dom", "server-only", "node:*"], "Pure rules import no I/O, framework or service code (BE-D11)."),
      providerRule,
      systemRule,
    ),
  },
  // UI components receive data as props (BE-D12): no service layer, no infrastructure.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: restrictWithSdks(
      group([...SERVICE_LAYER, ...INFRA], "Components get data as props from the server page (BE-D12); they never import services or infrastructure."),
      providerRule,
      systemRule,
    ),
  },
  // Pages and layouts call services/queries but never touch vendor SDKs or the database client directly.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: restrictWithSdks(group(["@/lib/db", "@/lib/db/*"], "Pages and actions go through domains/*/service or queries (BE-D7, BE-D11)."), providerRule, systemRule),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "audit-report/**",
  ]),
]);

export default eslintConfig;
