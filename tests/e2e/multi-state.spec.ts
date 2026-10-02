import { expect, test, type Page } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * Washington, Nevada and Utah on staging (lookup + preview-only sandbox sales switched on):
 * hero state picker -> manual lookup -> due date + itemized state fees with honest late-fee
 * conditions -> Washington sandbox journey -> operator runbook. Nothing is filed or charged.
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Creates users and sandbox orders: staging only.");

const tb = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const saveStep = (page: Page) => page.getByRole("button", { name: "Save and continue" }).click();

async function manualLookup(page: Page, state: string, name: string, entityLabel: RegExp, formation: string) {
  await page.goto(`/find?state=${state}&name=${encodeURIComponent(name)}`);
  await expect(page.getByLabel("Legal business name")).toHaveValue(name);
  await page.getByLabel("Entity type").selectOption({ label: (await page.getByLabel("Entity type").locator("option").allTextContents()).find((t) => entityLabel.test(t))! });
  await page.getByLabel("Formation date").fill(formation);
  await page.getByRole("button", { name: /see what.s due/i }).click();
  await page.waitForURL(/\/find\/result/);
}

test("hero state picker routes Washington to the short lookup, formation date required", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Find your business").selectOption("WA");
  await page.getByRole("textbox", { name: "Business legal name" }).fill("Rainier Test Co LLC");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/find\?state=WA&name=Rainier/);
  await expect(page.getByLabel("Legal business name")).toHaveValue("Rainier Test Co LLC");
  await page.getByLabel("Entity type").selectOption("llc");
  await page.getByRole("button", { name: /see what.s due/i }).click();
  await expect(page.locator("main")).toContainText("Washington sets the due date from the month the business formed");
});

test("Nevada LLC: two itemized state fees and the verified 'file by' penalties", async ({ page }) => {
  await manualLookup(page, "NV", `Silver Test ${uniqueSuffix()} LLC`, /^LLC/, "2018-11-05");
  const main = page.locator("main");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("may be due");
  await expect(main).toContainText("Due November 30, 2026");
  await expect(main).toContainText("Annual List fee");
  await expect(main).toContainText("State Business License fee");
  await expect(main).toContainText("$150.00");
  await expect(main).toContainText("$200.00");
  await expect(main).toContainText("File by November 30, 2026 to avoid Nevada's $75.00 annual list late penalty");
  await expect(main).toContainText("File by November 30, 2026 to avoid Nevada's $100.00 state business license late penalty");
  await expect(main).toContainText("Remind me about my Nevada filing");
  await page.screenshot({ path: "test-results/nv-result-desktop.png", fullPage: true });
});

test("Utah corporation: $18, late fee only if Utah's record shows Delinquent", async ({ page }) => {
  await manualLookup(page, "UT", `Wasatch Test ${uniqueSuffix()} Inc`, /^Corporation/, "2017-12-08");
  const main = page.locator("main");
  await expect(main).toContainText("Due December 31, 2026");
  await expect(main).toContainText("$18");
  await expect(main).toContainText("only if its own record shows the business as Delinquent");
  // Never a status claim about this business: the headline only says "may be due".
  await expect(page.getByRole("heading", { level: 1 })).toContainText("may be due");
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/overdue|delinquent|late/i);
});

test("Washington: reminder opt-in names the state and stores the state's consent text", async ({ browser }) => {
  const email = `wa.${uniqueSuffix()}@e2e.filewell.test`;
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await manualLookup(page, "WA", `Puget Test ${uniqueSuffix()} LLC`, /^LLC/, "2016-10-12");
    const main = page.locator("main");
    await expect(main).toContainText("Due October 31, 2026");
    await expect(main).toContainText("only if its own record shows the business as Delinquent");
    await expect(main).toContainText("Remind me about my Washington filing");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("checkbox", { name: /Washington annual report/i }).check();
    await page.getByRole("button", { name: "Email me reminders" }).click();
    await expect(main).toContainText("Check your inbox to confirm");
    const { data } = await backend().from("reminder_subscribers").select("state_code, entity_type, consent_text, status").eq("email", email).single();
    expect(data).toMatchObject({ state_code: "WA", entity_type: "llc", status: "pending" });
    expect(data!.consent_text).toContain("Washington annual report");
  } finally {
    await ctx.close();
  }
});

test("Washington sandbox journey: intake, authorization, itemized checkout, operator runbook", async ({ browser }) => {
  test.setTimeout(240_000);
  const customer = await createConfirmedUser("wa-customer");
  const operator = await createConfirmedUser("wa-operator");
  await grantStaff(operator.id, "admin");
  const name = `Cascade Test ${uniqueSuffix()} LLC`;
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await manualLookup(page, "WA", name, /^LLC/, "2016-10-12");
    await page.goto("/login?next=/file/start");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Password", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => u.pathname === "/file/start");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
    const filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];

    // Record (Washington asks for UBI and the nature of business).
    await expect(tb(page, "Legal name")).toHaveValue(name);
    await page.getByLabel("UBI number").fill("604123456");
    await tb(page, "Jurisdiction of formation").fill("Washington");
    await tb(page, "Nature of business").fill("Residential plumbing");
    await saveStep(page);
    await page.waitForURL(/step=registered_agent/);
    await tb(page, "Registered agent name").fill("Jane Agent");
    await tb(page, "Street address").fill("500 Pine Street");
    await tb(page, "City").fill("Seattle");
    const region = page.getByRole("combobox", { name: "State" });
    if (await region.isVisible()) await region.selectOption("WA");
    await tb(page, "ZIP code").fill("98101");
    await saveStep(page);
    await page.waitForURL(/step=principal_office/);
    await tb(page, "Street address").fill("1 Main Street");
    await tb(page, "City").fill("Tacoma");
    await page.getByRole("combobox", { name: "State" }).selectOption("WA");
    await tb(page, "ZIP code").fill("98402");
    await page.getByLabel("Business email").fill("owner@e2e.filewell.test");
    await saveStep(page);
    await page.waitForURL(/step=people/);
    await page.getByRole("textbox", { name: /Full name.*person 1/ }).first().fill("Dana Whitfield");
    await page.getByRole("combobox", { name: /Title.*person 1/ }).first().fill("Governor");
    await saveStep(page);
    await page.waitForURL(/step=extras/);
    await page.getByRole("radio", { name: "No" }).first().check();
    await page.getByRole("button", { name: "Save and review" }).click();

    await page.waitForURL(/\/review/);
    await expect(page.locator("main")).toContainText("Residential plumbing");
    await page.getByRole("textbox", { name: "Your full name" }).fill("Dana Whitfield");
    await page.getByRole("combobox", { name: "Your title or role" }).fill("Governor");
    await page.getByRole("checkbox", { name: /accurate and complete/i }).check();
    await page.getByRole("checkbox", { name: /authorize/i }).check();
    await page.getByRole("button", { name: "Sign and continue" }).click();

    await page.waitForURL(/\/checkout/);
    const main = page.locator("main");
    await expect(main).toContainText("$70.00");
    await expect(main).toContainText("Our service fee");
    await expect(main).toContainText("$119.00");
    await expect(main).toContainText("only if its own record shows the business as Delinquent");
    await expect(main).toContainText(/test mode|no real/i);
    await page.getByRole("button", { name: /^pay \$/i }).click();
    await page.waitForURL(/\/sandbox\/checkout\//);
    await page.getByRole("button", { name: /pay \(test\)/i }).click();
    await page.waitForURL(/\/confirmation/);

    const { data: f } = await backend().from("filings").select("order_id").eq("id", filingId).single();
    const { data: items } = await backend().from("order_items").select("kind, amount_cents").eq("order_id", f!.order_id);
    expect(items!.map((i) => [i.kind, i.amount_cents]).sort()).toEqual([
      ["government_fee", 7000],
      ["service_fee", 4900],
    ]);

    // Operator view: the Washington runbook.
    const op = await browser.newContext({ storageState: STORAGE_STATE });
    const opPage = await op.newPage();
    await opPage.goto(`/login?next=/admin/filings/${filingId}`);
    await opPage.getByLabel("Email").fill(operator.email);
    await opPage.getByLabel("Password", { exact: true }).fill(operator.password);
    await opPage.getByRole("button", { name: "Sign in" }).click();
    await opPage.waitForURL((u) => u.pathname === `/admin/filings/${filingId}`);
    const runbook = opPage.locator("#runbook");
    await expect(runbook).toContainText("Washington filing runbook");
    await expect(runbook).toContainText("Express Annual Report");
    await expect(runbook).toContainText("604123456");
    await expect(runbook).toContainText("Residential plumbing");
    await expect(runbook).toContainText("Collected for the state: $70.00");
    await expect(runbook).toContainText("Delinquency fee");
    await expect(runbook).toContainText("CCFS submission / filing confirmation number");
    await opPage.screenshot({ path: "test-results/wa-runbook.png", fullPage: true });
    await op.close();
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", operator.id);
    await ctx.close();
  }
});
