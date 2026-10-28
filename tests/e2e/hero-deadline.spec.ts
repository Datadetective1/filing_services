import { expect, test } from "@playwright/test";
import { rulesForState } from "../../src/lib/compliance/registry";
import { formatLongDate, todayInTimeZone } from "../../src/lib/domain/dates";
import { ENTITY_TYPE_LABELS } from "../../src/lib/domain/types";
import { ENTITY_COPY } from "../../src/lib/seo/entities";
import { heroRule } from "../../src/lib/seo/hero-rule";

/**
 * Read only. The homepage hero shows the Pennsylvania rule whose next verified due date is
 * soonest, and "Have us file it" carries the same entity. The expectation is computed from
 * the registry for today (Eastern), so it holds on any date.
 */

test("homepage hero shows the next Pennsylvania deadline, and its CTA carries that entity", async ({ page }) => {
  await page.route("**/api/analytics", (r) => r.fulfill({ status: 204 }));
  const pick = heroRule(rulesForState("PA"), todayInTimeZone("America/New_York"));
  expect(pick).not.toBeNull();
  const { rule, dueDate } = pick!;

  await page.goto("/");
  const hero = page.locator('section[aria-labelledby="hero-title"]');
  await expect(hero).toContainText(`Pennsylvania · ${ENTITY_TYPE_LABELS[rule.entityType]}`);
  await expect(hero).toContainText(`Due ${formatLongDate(dueDate)}`);

  const cta = page.getByRole("link", { name: "Have us file it" });
  await expect(cta).toHaveAttribute("href", `/find?state=PA&entity=${rule.entityType}`);
  await expect(page.locator("main")).toContainText(`Pennsylvania ${ENTITY_COPY[rule.entityType].singular} annual report`);
});
