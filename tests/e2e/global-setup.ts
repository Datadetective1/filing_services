import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { isProductionHost } from "../../src/config/environments";

export const STORAGE_STATE = path.join(__dirname, ".auth", "state.json");

/** True when every project can only collect the read-only public smoke spec. */
function onlyPublicSpec(config: FullConfig): boolean {
  return config.projects.every((p) => {
    const patterns = Array.isArray(p.testMatch) ? p.testMatch : [p.testMatch];
    return (
      patterns.length > 0 &&
      patterns.every((m) => (m instanceof RegExp ? m.test("public.spec.ts") && !m.test("journey.spec.ts") : /(^|\/)public\.spec\.ts$/.test(m)))
    );
  });
}

/**
 * Deployed previews are protected by Vercel Authentication. When E2E_SHARE_URL (a
 * temporary share link for the deployment) is set, visit it once so the access cookie
 * is captured, and reuse that browser state in every test context.
 *
 * Against a production host, only the public smoke spec may run (the journey creates
 * users, grants staff and takes payments). E2E_TARGET_IS_PRODUCTION is set for specs.
 */
export default async function globalSetup(config: FullConfig) {
  if (isProductionHost(process.env.E2E_BASE_URL)) {
    if (!onlyPublicSpec(config)) {
      throw new Error(
        "E2E_BASE_URL is a production host. Only tests/e2e/public.spec.ts may run against production: " +
          "npx playwright test tests/e2e/public.spec.ts",
      );
    }
    process.env.E2E_TARGET_IS_PRODUCTION = "true";
  }

  mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  const share = process.env.E2E_SHARE_URL;
  if (!share) {
    writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(share, { waitUntil: "domcontentloaded" });
  await context.storageState({ path: STORAGE_STATE });
  await browser.close();
}
