import { expect, test } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * Admin outreach on staging: import a few businesses from the PA open register, create a
 * campaign, preview recipients and the exact email, and confirm nothing can send.
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Grants admin and writes outreach data: staging only.");

test("admin previews a dry-run campaign; every sending gate is closed", async ({ browser }) => {
  const admin = await createConfirmedUser("outreach-admin");
  await grantStaff(admin.id, "admin");
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await page.goto("/login?next=/admin/outreach");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin\/outreach/);

    const main = page.locator("main");
    await expect(main).toContainText("Real outreach sending is off");
    await expect(main).toContainText("No public postal address configured");
    await expect(main).toContainText("Resend forbids cold outreach");

    // Import 10 Lehigh County LLCs (business-level data only).
    await page.getByLabel("County (optional)").fill("Lehigh");
    await page.getByLabel("How many (max 500)").fill("10");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(main).toContainText(/Imported \d+ businesses/, { timeout: 30_000 });
    await page.reload();
    await expect(main).toContainText("PA businesses in dataset");
    await page.screenshot({ path: "test-results/outreach-overview-desktop.png", fullPage: true });

    const name = `E2E dry run ${uniqueSuffix()}`;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(main).toContainText("Campaign created as a draft");
    await page.reload();
    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/outreach\/[0-9a-f-]{36}/);

    await expect(main).toContainText("Nothing is sent from this page");
    await expect(main).toContainText("Filewell is a private filing service. It is not the Pennsylvania Department of State");
    await expect(main).toContainText("file.dos.pa.gov for the $7.00 state fee");
    await expect(main).toContainText("This is an advertisement from Filewell.");
    // Which segment the imported LLCs fall in depends on today's date; either way nobody would receive it.
    await expect(main).toContainText(/No business email on file|No imported business is in this segment today/);
    await expect(main).toContainText(/ 0 would receive it right now/);
    await expect(main).not.toContainText("Would send");
    await page.screenshot({ path: "test-results/outreach-campaign-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Record dry run" }).click();
    await expect(main).toContainText(/0 would receive it\. Nothing was sent\./);
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", admin.id);
    await ctx.close();
  }
});
