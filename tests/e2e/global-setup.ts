import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

export const STORAGE_STATE = path.join(__dirname, ".auth", "state.json");

/**
 * Deployed previews are protected by Vercel Authentication. When E2E_SHARE_URL (a
 * temporary share link for the deployment) is set, visit it once so the access cookie
 * is captured, and reuse that browser state in every test context.
 */
export default async function globalSetup() {
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
