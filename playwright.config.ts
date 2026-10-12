import { defineConfig, devices } from "@playwright/test";

/*
  End-to-end journeys (TRD §15.3) against a production build and the local Supabase stack:
    npm run db:start && npm run db:reset && npm run db:seed
    npm run build && npm run test:e2e
  The app is started for you (`npm start`, port 3001) unless one is already running.
  Auth emails are read from Mailpit (http://127.0.0.1:54324).
*/
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
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3001/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
