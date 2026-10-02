import { expect, test, type Browser, type Page } from "@playwright/test";
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

const radio = (page: Page, group: RegExp, option: string | RegExp) =>
  page.getByRole("group", { name: group }).getByRole("radio", { name: option, exact: typeof option === "string" });

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === next.split("?")[0]);
}

async function fillAddress(page: Page, line1: string, city: string, zip: string) {
  await tb(page, "Street address").fill(line1);
  await tb(page, "City").fill(city);
  const region = page.getByRole("combobox", { name: "State" });
  if (await region.isVisible()) await region.selectOption("WA");
  await tb(page, "ZIP code").fill(zip);
}

/** Washington intake through the review page. `changes` = new registered agent + a reported ownership transfer. */
async function waIntake(page: Page, name: string, changes: boolean) {
  await expect(tb(page, "Legal name")).toHaveValue(name);
  await page.getByLabel("UBI number").fill("604 123 456");
  await tb(page, "Jurisdiction of formation").fill("Washington");
  await tb(page, "Nature of business").fill("Residential plumbing");
  await saveStep(page);
  await page.waitForURL(/step=registered_agent/);
  await radio(page, /registered agent changing/i, changes ? /^Yes: a new registered agent/ : /^No: keep/).check();
  await radio(page, /kind of registered agent/i, /^Noncommercial/).check();
  await tb(page, "Registered agent name").fill(changes ? "Dana Whitfield" : "Jane Agent");
  await fillAddress(page, "500 Pine Street", "Seattle", "98101");
  if (changes) await page.getByLabel("Registered agent email").fill("dana@e2e.filewell.test");
  await saveStep(page);
  await page.waitForURL(/step=principal_office/);
  await fillAddress(page, "1 Main Street", "Tacoma", "98402");
  await page.getByLabel("Business email").fill("owner@e2e.filewell.test");
  await saveStep(page);
  await page.waitForURL(/step=people/);
  await page.getByRole("textbox", { name: /Full name.*person 1/ }).first().fill("Dana Whitfield");
  await page.getByRole("combobox", { name: /Title.*person 1/ }).first().fill("Governor");
  await saveStep(page);
  await page.waitForURL(/step=controlling_interest/);
  await radio(page, /^1\. Does this entity own/, "No").check();
  await radio(page, /^2\. In the past 12 months/, changes ? "Yes" : "No").check();
  if (changes) await radio(page, /^2a\./, "No").check();
  await saveStep(page);
  await page.waitForURL(/step=extras/);
  await radio(page, /changed since your last annual report/i, changes ? /^Yes, something changed/ : /^No changes/).check();
  await page.getByRole("button", { name: "Save and review" }).click();
  await page.waitForURL(/\/review/);
}

async function signReview(page: Page, opts: { agentIsSigner?: boolean } = {}) {
  await page.getByRole("textbox", { name: "Your full name" }).fill("Dana Whitfield");
  await page.getByRole("combobox", { name: "Your title or role" }).fill("Governor");
  if (opts.agentIsSigner) {
    await page.getByRole("radio", { name: /I am the registered agent/ }).check();
    await page.getByRole("checkbox", { name: /Only if you are the agent/ }).check();
  }
  await page.getByRole("checkbox", { name: /I reviewed every item of the Washington filing information/ }).check();
  await page.getByRole("checkbox", { name: /accurate and complete/i }).check();
  await page.getByRole("checkbox", { name: /I authorize/i }).check();
  await page.getByRole("button", { name: /^Sign and (continue|resubmit)$/ }).click();
}

async function paySandbox(page: Page) {
  await page.waitForURL(/\/checkout/);
  const main = page.locator("main");
  await expect(main).toContainText("$70.00");
  await expect(main).toContainText("$119.00");
  await expect(main).toContainText("only if its own record shows the business as Delinquent");
  await page.getByRole("button", { name: /^pay \$/i }).click();
  await page.waitForURL(/\/sandbox\/checkout\//);
  await page.getByRole("button", { name: /pay \(test\)/i }).click();
  await page.waitForURL(/\/confirmation/);
}

/** Operator: provenance, review -> ready -> start filing -> comparison checkpoint. Never marks submitted. */
async function operatorToCheckpoint(browser: Browser, operator: { email: string; password: string }, filingId: string, expectText: string[]) {
  const op = await browser.newContext({ storageState: STORAGE_STATE });
  const opPage = await op.newPage();
  try {
    await signIn(opPage, operator.email, operator.password, `/admin/filings/${filingId}`);
    const runbook = opPage.locator("#runbook");
    await expect(runbook).toContainText("Washington filing runbook");
    await expect(runbook).toContainText("Express Annual Report");
    await expect(runbook).toContainText("Business Information");
    await expect(runbook).toContainText("Controlling Interest");
    await expect(runbook).toContainText("Customer-confirmed");
    await expect(runbook).not.toContainText("Changed after authorization: customer must reconfirm");
    await expect(runbook).toContainText("Collected for the state: $70.00");
    for (const t of expectText) await expect(runbook).toContainText(t);

    // The printable packet is the signed copy in CCFS order, with the certification.
    await opPage.goto(`/admin/filings/${filingId}/packet`);
    await expect(opPage.locator("main")).toContainText("customer-authorized, in CCFS order");
    await expect(opPage.locator("main")).toContainText("This document is hereby executed under penalty of law");
    await opPage.goto(`/admin/filings/${filingId}`);

    await opPage.getByRole("button", { name: "Mark ready to file" }).click();
    await expect(opPage.getByRole("button", { name: "Start filing" })).toBeVisible();
    await opPage.getByRole("button", { name: "Start filing" }).click();
    // Mark submitted waits for the checkpoint.
    await expect(opPage.getByText("Checkpoint first")).toBeVisible();
    await expect(opPage.getByRole("button", { name: "Mark submitted" })).toHaveCount(0);
    await opPage.getByRole("checkbox", { name: "I have compared the state filing against the customer-authorized filing packet." }).check();
    await opPage.getByRole("button", { name: "Record checkpoint" }).click();
    await expect(opPage.getByText("Checkpoint recorded")).toBeVisible();
    await expect(opPage.getByRole("button", { name: "Mark submitted" })).toBeVisible();
    await opPage.screenshot({ path: `test-results/wa-operator-${filingId.slice(0, 8)}.png`, fullPage: true });

    const { data: cp } = await backend().from("audit_logs").select("after").eq("filing_id", filingId).eq("action", "filing.state_comparison_confirmed");
    expect(cp).toHaveLength(1);
  } finally {
    await op.close();
  }
}

test("Washington sandbox journey without changes: full packet, certification, checkout, operator checkpoint", async ({ browser }) => {
  test.setTimeout(540_000);
  const customer = await createConfirmedUser("wa-customer");
  const operator = await createConfirmedUser("wa-operator");
  await grantStaff(operator.id, "admin");
  const name = `Cascade Test ${uniqueSuffix()} LLC`;
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await manualLookup(page, "WA", name, /^LLC/, "2016-10-12");
    await signIn(page, customer.email, customer.password, "/file/start");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
    const filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];
    await waIntake(page, name, false);

    // Review: the complete Washington packet, in CCFS order, before payment.
    const main = page.locator("main");
    for (const t of ["Business Information", "Registered Agent", "Principal Office", "Governors", "Nature of Business", "Controlling Interest", "Authorized Person"]) {
      await expect(main).toContainText(t);
    }
    await expect(main).toContainText("604 123 456");
    await expect(main).toContainText("Date of Filing");
    await expect(main).toContainText("doing business as Filewell");
    await expect(main).toContainText("This document is hereby executed under penalty of law");
    await expect(page.getByText("Your new registered agent's consent")).toHaveCount(0);
    await page.screenshot({ path: "test-results/wa-review.png", fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: "test-results/wa-review-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Signing without the packet confirmation is refused.
    await page.getByRole("textbox", { name: "Your full name" }).fill("Dana Whitfield");
    await page.getByRole("combobox", { name: "Your title or role" }).fill("Governor");
    await page.getByRole("checkbox", { name: /accurate and complete/i }).check();
    await page.getByRole("checkbox", { name: /I authorize/i }).check();
    await page.getByRole("button", { name: "Sign and continue" }).click();
    await expect(page.getByText("Confirm you reviewed every item").first()).toBeVisible();
    await signReview(page);
    await paySandbox(page);

    const { data: auth } = await backend()
      .from("filing_authorizations")
      .select("facts_certified, packet_sha256, packet_snapshot, filing_agent_name, certification_text, registered_agent_consent, terms_version")
      .eq("filing_id", filingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(auth!.facts_certified).toBe(true);
    expect(auth!.packet_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((auth!.packet_snapshot as { section: string }[])[0].section).toBe("Business Information");
    expect(auth!.certification_text).toContain("penalty of law");
    expect(auth!.registered_agent_consent).toBeNull();
    expect(auth!.terms_version).toMatch(/\.state1$/);
    const { data: f } = await backend().from("filings").select("order_id").eq("id", filingId).single();
    const { data: items } = await backend().from("order_items").select("kind, amount_cents").eq("order_id", f!.order_id);
    expect(items!.map((i) => [i.kind, i.amount_cents]).sort()).toEqual([
      ["government_fee", 7000],
      ["service_fee", 4900],
    ]);

    await operatorToCheckpoint(browser, operator, filingId, ["Jane Agent"]);
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", operator.id);
    await ctx.close();
  }
});

test("Washington sandbox journey with changes: agent consent, edit after signing forces re-signing, operator checkpoint", async ({ browser }) => {
  test.setTimeout(540_000);
  const customer = await createConfirmedUser("wa-customer-chg");
  const operator = await createConfirmedUser("wa-operator-chg");
  await grantStaff(operator.id, "admin");
  const name = `Cascade Change ${uniqueSuffix()} LLC`;
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await manualLookup(page, "WA", name, /^LLC/, "2016-10-12");
    await signIn(page, customer.email, customer.password, "/file/start");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
    const filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];
    await waIntake(page, name, true);

    const main = page.locator("main");
    await expect(main).toContainText("Yes: a new registered agent");
    await expect(page.getByText("Your new registered agent's consent")).toBeVisible();
    // Consent is never assumed: signing without choosing how the agent consents is refused.
    await signReview(page);
    await expect(page.getByText("Tell us who the new registered agent is.").first()).toBeVisible();
    await signReview(page, { agentIsSigner: true });
    await page.waitForURL(/\/checkout/);

    // Edit after signing: checkout refuses until the customer signs again.
    await page.goto(`/file/${filingId}/details?step=record`);
    await tb(page, "Nature of business").fill("Commercial plumbing");
    // Every section is complete, so the step saves straight back to review.
    await page.getByRole("button", { name: "Save and review" }).click();
    await page.waitForURL(/\/review/);
    await page.goto(`/file/${filingId}/checkout`);
    await expect(page).toHaveURL(/\/review/);
    const { data: changed } = await backend().from("audit_logs").select("before, after").eq("filing_id", filingId).eq("action", "filing.answers_changed_after_authorization");
    expect(changed!.length).toBeGreaterThan(0);
    expect((changed![0].before as Record<string, unknown>).nature_of_business).toBe("Residential plumbing");
    await expect(page.locator("main")).toContainText("Commercial plumbing");
    await signReview(page, { agentIsSigner: true });
    await paySandbox(page);

    const { data: auths } = await backend()
      .from("filing_authorizations")
      .select("registered_agent_consent, packet_snapshot, created_at")
      .eq("filing_id", filingId)
      .order("created_at", { ascending: true });
    expect(auths).toHaveLength(2);
    // The first signature is preserved exactly as signed.
    expect(JSON.stringify(auths![0].packet_snapshot)).toContain("Residential plumbing");
    expect(JSON.stringify(auths![1].packet_snapshot)).toContain("Commercial plumbing");
    expect((auths![1].registered_agent_consent as { mode: string; consentText: string }).mode).toBe("signer_is_agent");
    expect((auths![1].registered_agent_consent as { consentText: string }).consentText).toContain("I hereby consent to serve as Registered Agent");

    await operatorToCheckpoint(browser, operator, filingId, ["signed Washington's consent to serve", "Commercial plumbing"]);
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", operator.id);
    await ctx.close();
  }
});
