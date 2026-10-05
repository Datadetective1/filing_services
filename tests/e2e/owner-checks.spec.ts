import { expect, test, type Page } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, grantStaff } from "./support/backend";

/**
 * Owner checks page: admin only (operators and customers get a 404, visitors sign in),
 * never indexed or listed, and progress (ticks + recorded wording) persists.
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("owner checks is not public: not in the sitemap, disallowed in robots, sign-in required", async ({ page }) => {
  // Fetched through the page so preview deployments' access cookie applies.
  const sitemap = await (await page.goto("/sitemap.xml"))!.text();
  expect(sitemap).not.toContain("owner-checks");
  expect(sitemap).not.toContain("/admin");
  const robots = await (await page.goto("/robots.txt"))!.text();
  // Production disallows /admin; previews disallow everything.
  expect(robots).toMatch(/Disallow: \/(admin)?\s*$/m);
  await page.goto("/admin/owner-checks");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("staging only", () => {
  test.skip(productionTarget, "Creates users and staff: staging only.");

  test("operators and customers get the not-found page; the admin sees, ticks and records, and it persists", async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await createConfirmedUser("owner-admin");
    const operator = await createConfirmedUser("owner-operator");
    const customer = await createConfirmedUser("owner-customer");
    await grantStaff(admin.id, "admin");
    await grantStaff(operator.id, "operator");
    const keys = ["wa.row1", "wa.row4"];
    const before = await backend().from("owner_checks").select("*").in("item_key", keys);
    try {
      for (const who of [operator, customer]) {
        const ctx = await browser.newContext({ storageState: STORAGE_STATE });
        const p = await ctx.newPage();
        await signIn(p, who.email, who.password, "/admin/owner-checks");
        await p.waitForLoadState("networkidle");
        await p.goto("/admin/owner-checks");
        // Streamed pages render the not-found UI (the console's existence isn't revealed).
        await expect(p.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible();
        await expect(p.getByRole("heading", { name: "Owner checks" })).toHaveCount(0);
        await expect(p.locator("body")).not.toContainText("(775) 684-5708");
        await ctx.close();
      }

      const ctx = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await ctx.newPage();
      await signIn(page, admin.email, admin.password, "/admin/owner-checks");
      await page.waitForURL(/\/admin\/owner-checks/);
      await expect(page.getByRole("heading", { name: "Owner checks", level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      for (const name of ["Washington", "Nevada", "Utah"]) await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
      await expect(page.getByText("Checks done").first()).toBeVisible();
      await expect(page.locator("main")).toContainText("This document is hereby executed under penalty of law");
      await expect(page.locator("main")).toContainText("(775) 684-5708");
      await expect(page.locator("main")).toContainText("(801) 530-4849");
      await expect(page.getByRole("link", { name: "Owner checks" })).toBeVisible();

      // Tick row 1 (saves on change) and record row 4's exact wording.
      const row1 = page.getByRole("checkbox", { name: /1\. Express Annual Report search/ });
      await row1.check();
      await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();
      const note = page.getByRole("textbox", { name: "Exact wording of each radio button" });
      await note.fill("E2E: radio wording placeholder");
      await note.locator("xpath=ancestor::form").getByRole("button", { name: "Save" }).click();
      await expect.poll(async () => (await backend().from("owner_checks").select("note").eq("item_key", "wa.row4").maybeSingle()).data?.note).toBe(
        "E2E: radio wording placeholder",
      );

      await page.reload();
      await expect(page.getByRole("checkbox", { name: /1\. Express Annual Report search/ })).toBeChecked();
      await expect(page.getByRole("textbox", { name: "Exact wording of each radio button" })).toHaveValue("E2E: radio wording placeholder");
      const { data: audits } = await backend().from("audit_logs").select("entity_id").eq("action", "owner_check.saved").eq("actor_user_id", admin.id);
      expect(audits!.map((a) => a.entity_id).sort()).toEqual(["wa.row1", "wa.row4"]);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.reload();
      await expect(page.getByRole("heading", { name: "Owner checks", level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: "test-results/owner-checks-mobile.png", fullPage: true });
      await ctx.close();
    } finally {
      // Restore whatever was there before (staging).
      await backend().from("owner_checks").delete().in("item_key", keys);
      if (before.data?.length) await backend().from("owner_checks").insert(before.data);
      await backend().from("staff_members").update({ active: false }).in("user_id", [admin.id, operator.id]);
    }
  });
});
