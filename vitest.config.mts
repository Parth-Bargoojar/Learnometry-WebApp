import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside a Server Component build; tests import services directly.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domains/**/rules.ts"],
      // Gate BE-0: ≥ 90% on pure rules (ARCHITECTURE §7).
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
