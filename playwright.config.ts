import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

/*
  End-to-end journeys (TRD §15.3) against a production build and the LOCAL Supabase stack:
    npm run db:start && npm run db:reset && npm run db:seed
    npm run test:e2e   (builds and starts the app with the local settings)
  The app is started for you (`npm start`, port 3001) unless E2E_BASE_URL points at a deployed one.
  Auth emails are read from Mailpit (http://127.0.0.1:54324).

  `.env.local` may point at the hosted project. The journeys create accounts, so the started app and
  the helpers are given the local connection settings explicitly (a process variable beats .env.local).
*/
function localStack(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const s: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?\s*$/.exec(line.trim());
    if (m) s[m[1]] = m[2];
  }
  return {
    DIRECT_DATABASE_URL: s.DB_URL,
    DATABASE_URL: s.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: "http://localhost:3001",
    INNGEST_DEV: "1",
  };
}

const deployed = Boolean(process.env.E2E_BASE_URL);
const local = deployed ? {} : localStack();
Object.assign(process.env, local);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium-mobile", use: { ...devices["Pixel 7"] } }, { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: deployed
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3001/login",
        // A server left running from an earlier session would carry the wrong environment.
        reuseExistingServer: false,
        timeout: 300_000,
        env: local,
      },
});
