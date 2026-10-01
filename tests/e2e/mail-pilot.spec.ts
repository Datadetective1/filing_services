import { expect, test } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * December 31 postcard pilot on staging: import associations from the PA open register,
 * build the pilot, review the card and costs, download the export, and follow one printed
 * landing URL. Nothing is purchased or mailed (there is no vendor integration).
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Grants admin and writes outreach data: staging only.");

test("admin builds the Dec 31 postcard pilot and exports it; a printed URL lands on the record", async ({ browser }) => {
  const admin = await createConfirmedUser("mail-admin");
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

    await page.locator("#i-grp").selectOption("other");
    await page.getByLabel("County (optional)").fill("Dauphin");
    await page.getByLabel("How many (max 500)").fill("60");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(main).toContainText(/Imported \d+ businesses/, { timeout: 30_000 });

    const name = `E2E Dec 31 pilot ${uniqueSuffix()}`;
    await page.locator("#m-name").fill(name);
    await page.getByRole("button", { name: "Create postcard pilot" }).click();
    await expect(main).toContainText("Postcard pilot created");
    await page.reload();
    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/outreach\/[0-9a-f-]{36}$/);
    const campaignUrl = page.url();

    await expect(main).toContainText("Nothing is purchased or mailed from here");
    await expect(main).toContainText("THIS IS A SOLICITATION. NOT A BILL OR OFFICIAL GOVERNMENT DOCUMENT.");
    await expect(main).toContainText("may be due by December 31");
    await expect(main).toContainText("$49.00 service fee + $7.00 state fee = $56.00");
    await expect(main).toContainText("Cost and unit economics");
    await expect(main).not.toContainText(/\b(Active|compliant|outstanding|Not filed)\b/);
    await page.screenshot({ path: "test-results/mail-pilot-desktop.png", fullPage: true });

    const csv = await page.request.get(`${campaignUrl}/export`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const lines = (await csv.text()).trim().split("\r\n");
    expect(lines[0]).toContain("business_name,entity_number,entity_type");
    expect(lines.length).toBeGreaterThan(1);
    const included = lines.slice(1).filter((l) => l.startsWith('"yes"'));
    const excluded = lines.slice(1).filter((l) => l.startsWith('"no"'));
    expect(included.length + excluded.length).toBe(lines.length - 1);
    for (const l of excluded) expect(l).not.toMatch(/^"no",""/); // every exclusion has a reason

    const html = await page.request.get(`${campaignUrl}/export?format=html`);
    expect(await html.text()).toContain("{{landing_url}}");

    if (included.length) {
      const url = /"(https:\/\/[^"]+\/m\/[^"]+)"/.exec(included[0])![1];
      const landing = await ctx.newPage();
      await landing.goto(new URL(new URL(url).pathname, campaignUrl).toString());
      await landing.waitForURL(/\/find\/result/);
      await expect(landing.locator("main")).toContainText("Pennsylvania record found");
    }

    // A forged code falls back to the normal lookup.
    const forged = await ctx.newPage();
    await forged.goto(new URL("/m/00000000-123-AAAAAAAAAA", campaignUrl).toString());
    await forged.waitForURL(/\/find\?state=PA/);
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", admin.id);
    await ctx.close();
  }
});
