import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.e2e", override: true });

/**
 * End-to-end tests run against a real app + real Supabase (local stack or a staging
 * project). Set E2E_BASE_URL to test a deployed environment; otherwise the tests start
 * `next start` locally (run `npm run build` first).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const startLocal = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: startLocal
    ? { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
