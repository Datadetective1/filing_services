import { expect, test } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { createConfirmedUser } from "./support/backend";

/**
 * Register search -> account -> prefilled draft -> "Has anything changed?" (staging only:
 * creates a user and a draft filing; never signs, pays or files).
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Creates a user and a draft: staging only.");

test("a register pick prefills the draft and asks only what's missing", async ({ browser }) => {
  const customer = await createConfirmedUser("prefill");
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();

  await page.goto("/find");
  await page.getByRole("textbox", { name: "Business name or Pennsylvania entity number" }).fill("7380992");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Daff Trucking LLC/ }).click({ timeout: 15_000 });
  await page.waitForURL(/\/find\/result/);

  await page.goto("/login?next=/file/start");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/file/start");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);

  const main = page.locator("main");
  await expect(page.getByRole("heading", { name: "We found your Pennsylvania record" })).toBeVisible();
  await expect(main).toContainText("Daff Trucking LLC");
  await expect(main).toContainText("0007380992");
  await expect(main).toContainText("85 Willow St");
  await expect(main).toContainText("ALIOU DAFF");
  await expect(main).toContainText("From Pennsylvania's business register");
  await expect(main).toContainText("We still need this from you");
  await expect(main).toContainText("Has anything changed?");
  await page.screenshot({ path: "test-results/prefill-panel-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/prefill-panel-mobile.png", fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: /No, it's all current/ }).click();
  await page.waitForURL(/step=principal_office/);
  await expect(main).toContainText("Everything else is saved");
  await ctx.close();
});
