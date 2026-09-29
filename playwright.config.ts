import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { isProductionHost } from "./src/config/environments";

config({ path: ".env.local" });
config({ path: ".env.e2e", override: true });

/**
 * End-to-end tests run against a real app + real Supabase (local stack or a staging
 * project). Set E2E_BASE_URL to test a deployed environment; otherwise the tests start
 * `next start` locally (run `npm run build` first).
 *
 * Against a production host only the read-only public smoke spec is collected: the
 * journey creates users, grants staff and takes payments.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const startLocal = !process.env.E2E_BASE_URL;
const PUBLIC_SPEC = /public\.spec\.ts$/;
const productionTarget = isProductionHost(process.env.E2E_BASE_URL);
if (productionTarget) process.env.E2E_TARGET_IS_PRODUCTION = "true";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    storageState: "tests/e2e/.auth/state.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, ...(productionTarget ? { testMatch: PUBLIC_SPEC } : {}) },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: PUBLIC_SPEC },
  ],
  webServer: startLocal
    ? { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
