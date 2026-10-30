import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Scheduled jobs: the daily reminders and the hourly registered agent checks. */

const config = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as { crons: { path: string; schedule: string }[] };

describe("vercel crons", () => {
  it("keeps the daily reminders job", () => {
    expect(config.crons).toContainEqual({
      path: "/api/cron/reminders",
      schedule: "0 13 * * *",
    });
  });

  it("runs the registered agent checks every hour", () => {
    const job = config.crons.find((c) => c.path === "/api/cron/services");
    expect(job).toBeDefined();
    const [minute, hour, dom, month, dow] = job!.schedule.split(" ");
    expect(Number.isInteger(Number(minute))).toBe(true);
    expect([hour, dom, month, dow]).toEqual(["*", "*", "*", "*"]);
  });
});
