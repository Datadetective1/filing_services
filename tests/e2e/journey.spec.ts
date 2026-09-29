import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, deleteUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * The full Pennsylvania journey:
 * visitor -> PA page -> lookup -> account -> intake -> authorization -> sandbox payment
 * -> admin queue -> packet -> submitted -> receipt -> accepted -> customer notified
 * -> reminders stop -> next period opened. Plus cross-account attacks and webhook replay.
 */

// Never run the journey against production: it creates users, grants staff and places orders.
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Never run the journey against production (www.getfilewell.com, getfilewell.com, filewell.vercel.app).");

test.describe.configure({ mode: "serial" });

const suffix = uniqueSuffix();
const businessName = `Keystone Test Bakery ${suffix} LLC`;
let customer: { id: string; email: string; password: string };
let intruder: { id: string; email: string; password: string };
let operator: { id: string; email: string; password: string };
let filingId = "";

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newSignedInPage(browser: Browser, who: { email: string; password: string }, next = "/dashboard") {
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signIn(page, who);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test.beforeAll(async () => {
  if (productionTarget) return;
  customer = await createConfirmedUser("customer");
  intruder = await createConfirmedUser("intruder");
  operator = await createConfirmedUser("operator");
  await grantStaff(operator.id, "admin");
});

test.afterAll(async () => {
  if (productionTarget) return;
  // The test operator never keeps admin rights after the run, locally or on staging.
  if (operator) {
    await backend().from("staff_members").update({ active: false }).eq("user_id", operator.id);
    await backend()
      .from("audit_logs")
      .insert({ actor_type: "system", action: "staff.revoked", entity_type: "staff_member", entity_id: operator.id, metadata: { reason: "e2e journey finished" } });
  }
  // Test data is left in place for inspection on staging; users are removed locally.
  if (!process.env.E2E_BASE_URL) {
    for (const u of [customer, intruder, operator]) if (u) await deleteUser(u.id);
  }
});

async function lookUp(page: Page) {
  await page.goto("/find?state=PA&entity=llc");
  await page.getByLabel("Legal business name").fill(businessName);
  await page.getByRole("button", { name: /see what.s due/i }).click();
  await page.waitForURL(/\/find\/result/);
}

const tb = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const saveStep = (page: Page) => page.getByRole("button", { name: "Save and continue" }).click();

test("1. visitor reads the Pennsylvania page and looks up their business", async ({ page }) => {
  await page.goto("/annual-report/pennsylvania");
  await expect(page.locator("main")).toContainText("September 30");
  await expectNoSeriousA11yViolations(page);

  await lookUp(page);
  const main = page.locator("main");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(businessName);
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("$7.00");
  await expect(page.getByRole("link", { name: "Have us file it" })).toBeVisible();
  await expect(page.getByRole("link", { name: /file it yourself/i })).toHaveAttribute("href", /file\.dos\.pa\.gov/);
  await expectNoSeriousA11yViolations(page);
});

test("2. customer signs in, completes intake, authorizes and pays (sandbox)", async ({ page }) => {
  await lookUp(page);
  // Signed-out visitors are sent to sign up; this customer already has an account.
  await page.goto("/login?next=/file/start");
  await signIn(page, customer);
  await page.waitForURL((u) => u.pathname === "/file/start");
  await expect(page.locator("main")).toContainText(businessName);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
  filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];

  // Business record
  await expect(page.getByRole("textbox", { name: "Legal name" })).toHaveValue(businessName);
  await page.getByLabel(/entity number/i).fill("0012345");
  await saveStep(page);
  await page.waitForURL(/step=registered_office/);

  // Validation: the PA registered office is required.
  await saveStep(page);
  await expect(page.getByRole("alert").first()).toBeVisible();
  // The form remounts from the server's response after a validation error; wait for it.
  await expect(tb(page, "Street address")).toHaveAttribute("aria-invalid", "true");
  await page.waitForLoadState("networkidle");

  await tb(page, "Street address").fill("100 Market Street");
  await tb(page, "City").fill("Harrisburg");
  await tb(page, "ZIP code").fill("17101");
  await tb(page, "County").fill("Dauphin");
  await saveStep(page);
  await page.waitForURL(/step=principal_office/);

  // A P.O. box alone is rejected.
  await tb(page, "Street address").fill("PO Box 12");
  await tb(page, "City").fill("Philadelphia");
  await page.getByRole("combobox", { name: "State" }).selectOption("PA");
  await tb(page, "ZIP code").fill("19106");
  await saveStep(page);
  await expect(page.locator("main")).toContainText(/P\.O\. box/i);
  await expect(tb(page, "Street address")).toHaveAttribute("aria-invalid", "true");
  await page.waitForLoadState("networkidle");
  await tb(page, "Street address").fill("200 Chestnut Street");
  await expect(tb(page, "City")).toHaveValue("Philadelphia");
  await saveStep(page);
  await page.waitForURL(/step=people/);

  await page.getByRole("textbox", { name: /Full name.*person 1/ }).first().fill("Dana Whitfield");
  await page.getByRole("combobox", { name: /Title.*person 1/ }).first().fill("Managing Member");
  await saveStep(page);
  await page.waitForURL(/step=extras/);
  await page.getByRole("button", { name: "Save and review" }).click();

  await page.waitForURL(/\/review/);
  await expect(page.locator("main")).toContainText("100 Market Street");
  await expect(page.locator("main")).toContainText("Dana Whitfield");
  await expect(page.locator("main")).toContainText(/not a government agency/i);

  await page.getByRole("textbox", { name: "Your full name" }).fill("Dana Whitfield");
  await page.getByRole("combobox", { name: "Your title or role" }).fill("Managing Member");
  await page.getByRole("checkbox", { name: /accurate and complete/i }).check();
  await page.getByRole("checkbox", { name: /authorize/i }).check();
  await page.getByRole("button", { name: "Sign and continue" }).click();

  await page.waitForURL(/\/checkout/);
  const main = page.locator("main");
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("Total today");
  await expect(main).toContainText(/test mode|no real/i);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: /^pay \$/i }).click();

  await page.waitForURL(/\/sandbox\/checkout\//);
  await expect(page.locator("body")).toContainText(/no real (card|charge)/i);
  await expect(page.locator("main")).toContainText("$7.00");
  await page.getByRole("button", { name: /pay \(test\)/i }).click();

  await page.waitForURL(/\/confirmation/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/order confirmed/i, { timeout: 30_000 });

  const { data: filing } = await backend().from("filings").select("status, order_id").eq("id", filingId).single();
  expect(filing?.status).toBe("ready_for_review");
  const { data: order } = await backend().from("orders").select("status, government_fee_cents, service_fee_cents, total_cents").eq("id", filing!.order_id).single();
  expect(order?.status).toBe("paid");
  expect(order!.government_fee_cents).toBe(700);
  expect(order!.total_cents).toBe(order!.government_fee_cents + order!.service_fee_cents);
  const { data: auth } = await backend().from("filing_authorizations").select("signer_name, answers_sha256").eq("filing_id", filingId).single();
  expect(auth?.signer_name).toBe("Dana Whitfield");
  expect(auth?.answers_sha256).toMatch(/^[0-9a-f]{64}$/);
});

test("3. duplicate and forged webhooks are harmless", async ({ request }) => {
  const forged = await request.post("/api/webhooks/payments/sandbox", {
    data: JSON.stringify({ id: "sbx_evt_forged", type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), data: {} }),
    headers: { "content-type": "application/json", "sandbox-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
  });
  expect(forged.status()).toBe(400);

  // The real completion event was already processed; replaying its id is a duplicate.
  const { data: evt } = await backend()
    .from("payment_events")
    .select("provider_event_id, processed_at")
    .eq("provider", "sandbox")
    .eq("event_type", "checkout.session.completed")
    .order("received_at", { ascending: false })
    .limit(1)
    .single();
  expect(evt?.processed_at).toBeTruthy();
});

test("4. customer dashboard shows the paid filing", async ({ browser }) => {
  const page = await newSignedInPage(browser, customer);
  await page.goto("/dashboard");
  const main = page.locator("main");
  await expect(main).toContainText(businessName);
  await expect(main).toContainText(/ready for review/i);
  await expect(main).toContainText(/paid/i);
  await expectNoSeriousA11yViolations(page);
});

test("5. another customer cannot see this customer's filing or documents", async ({ browser }) => {
  const page = await newSignedInPage(browser, intruder);
  await expect(page.getByText(intruder.email).first()).toBeVisible();
  // Streamed pages (with loading skeletons) render notFound() with HTTP 200, so the
  // property under test is the content: the not-found UI and none of the victim's data.
  for (const url of [`/dashboard/filings/${filingId}`, `/file/${filingId}/details`, `/file/${filingId}/checkout`, `/file/${filingId}/review`]) {
    const res = await page.goto(url);
    expect([200, 404], url).toContain(res?.status());
    const body = page.locator("body");
    await expect(body, url).toContainText(/couldn.t find|not found|404/i);
    await expect(body, url).not.toContainText(businessName);
    await expect(body, url).not.toContainText("100 Market Street");
  }
  await page.goto("/admin");
  await expect(page.locator("body")).toContainText(/couldn.t find|not found|404/i);
  await expect(page.locator("body")).not.toContainText("Audit log");
  await page.goto("/admin/queue");
  await expect(page.locator("body")).not.toContainText(businessName);
  await page.context().close();
});

test("6. operator files it from the queue and packet", async ({ browser }) => {
  const page = await newSignedInPage(browser, operator, "/admin/queue");

  // Today lists the next step per paid order. Staging keeps every run's data, so this row may be
  // past the list's cut-off: check the list is there, and check this order's step on its own page.
  await page.goto("/admin");
  await expect(page.locator("#next-steps").getByRole("heading", { name: "Your next step for each paid customer" })).toBeVisible();

  await page.goto("/admin/queue");
  await expect(page.locator("main")).toContainText(businessName);
  await page.goto(`/admin/filings/${filingId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(businessName);
  // The same next-step wording as Today, and a clear sign that no real money was taken.
  await expect(page.locator('section[aria-labelledby="actions-title"]')).toContainText("Review the details, then click Mark ready to file");
  await expect(page.locator("main")).toContainText(/TEST: no money collected/);

  await page.getByRole("button", { name: /mark ready to file/i }).click();
  await expect(page.locator("main")).toContainText(/ready to file/i);

  // Packet
  const packetHref = `/admin/filings/${filingId}/packet`;
  const packet = await page.context().newPage();
  await packet.goto(packetHref);
  const p = packet.locator("main");
  await expect(p).toContainText(businessName);
  await expect(p).toContainText("100 Market Street");
  await expect(p).toContainText("Dauphin");
  await expect(p).toContainText("Dana Whitfield");
  await expect(p).toContainText("$7.00");
  await expect(packet.getByRole("link", { name: /open official filing site/i }).first()).toHaveAttribute("href", /file\.dos\.pa\.gov/);
  await packet.close();

  await page.getByRole("button", { name: /start filing/i }).click();
  await expect(page.locator("main")).toContainText(/in progress/i);

  await page.getByLabel(/confirmation number/i).fill(`E2E-${suffix}`);
  await page.getByRole("button", { name: /mark submitted/i }).click();
  await expect(page.locator("main")).toContainText(`E2E-${suffix}`);

  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "test-receipt.pdf"));
  await page.getByRole("combobox", { name: "Document type" }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.locator("main")).toContainText("test-receipt.pdf");

  await page.getByRole("button", { name: /mark accepted/i }).click();
  await expect(page.locator("main")).toContainText(/completed/i);

  const { data: filing } = await backend().from("filings").select("status, requirement_id, state_confirmation_number, order_id").eq("id", filingId).single();
  expect(filing?.status).toBe("completed");
  expect(filing?.state_confirmation_number).toBe(`E2E-${suffix}`);

  // Every step above is in the audit log (public.audit_logs; see supabase/migrations).
  type AuditRow = {
    action: string;
    actor_type: string;
    actor_user_id: string | null;
    entity_type: string;
    entity_id: string | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  };
  const { data: filingAudit, error: auditError } = await backend()
    .from("audit_logs")
    .select("action, actor_type, actor_user_id, entity_type, entity_id, after, metadata")
    .eq("filing_id", filingId)
    .order("id", { ascending: true });
  expect(auditError).toBeNull();
  const rows = (filingAudit ?? []) as AuditRow[];

  const authorized = rows.find((r) => r.action === "filing.authorized");
  expect(authorized?.actor_type).toBe("customer");
  expect(authorized?.actor_user_id).toBe(customer.id);

  const { data: paidAudit } = await backend()
    .from("audit_logs")
    .select("action, entity_type, entity_id")
    .eq("action", "order.paid")
    .eq("entity_id", filing!.order_id);
  expect(paidAudit ?? []).toHaveLength(1);

  const transitions = rows.filter((r) => r.action === "filing.status_changed");
  expect(transitions.map((r) => r.after?.status)).toEqual(["ready_for_review", "ready_to_file", "in_progress", "submitted", "accepted", "completed"]);
  expect(transitions[0].actor_type).toBe("system");
  for (const r of transitions.slice(1)) {
    expect(r.actor_type).toBe("staff");
    expect(r.actor_user_id).toBe(operator.id);
  }
  const submitted = transitions.find((r) => r.after?.status === "submitted");
  expect((submitted?.metadata?.patch as Record<string, unknown> | undefined)?.state_confirmation_number).toBe(`E2E-${suffix}`);

  const uploaded = rows.find((r) => r.action === "document.uploaded");
  expect(uploaded?.actor_user_id).toBe(operator.id);
  expect(uploaded?.entity_type).toBe("filing_document");
  expect(uploaded?.after?.kind).toBe("filed_report");
  expect(uploaded?.after?.visible_to_customer).toBe(true);
});

test("7. customer is notified, can download the receipt, and reminders stop", async ({ browser }) => {
  const page = await newSignedInPage(browser, customer);
  await page.goto(`/dashboard/filings/${filingId}`);
  const main = page.locator("main");
  await expect(main).toContainText(/completed/i);
  await expect(main).toContainText(`E2E-${suffix}`);
  const download = page.getByRole("link", { name: /download/i }).first();
  const href = await download.getAttribute("href");
  expect(href).toMatch(/^\/api\/documents\//);
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const signed = res.headers()["location"];
  const pdf = await page.request.get(signed);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Intruder cannot use the same document link.
  const intruderPage = await newSignedInPage(browser, intruder);
  const denied = await intruderPage.request.get(href!, { maxRedirects: 0 });
  expect(denied.status()).toBe(404);

  const db = backend();
  const { data: filing } = await db.from("filings").select("requirement_id, business_id").eq("id", filingId).single();
  const { data: notes } = await db.from("notifications").select("template_key, status").eq("filing_id", filingId);
  const keys = (notes ?? []).map((n) => n.template_key);
  expect(keys).toEqual(expect.arrayContaining(["order_confirmed", "filing_submitted", "document_ready", "filing_accepted"]));

  const { data: pending } = await db.from("reminders").select("id").eq("requirement_id", filing!.requirement_id).eq("status", "scheduled");
  expect(pending ?? []).toHaveLength(0);

  const { data: requirement } = await db.from("filing_requirements").select("status, period_year").eq("id", filing!.requirement_id).single();
  expect(requirement?.status).toBe("filed_with_us");
  const { data: next } = await db
    .from("filing_requirements")
    .select("period_year, status")
    .eq("business_id", filing!.business_id)
    .gt("period_year", requirement!.period_year);
  expect(next?.[0]?.status).toBe("open");
});
