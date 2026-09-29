/**
 * Run one reminder cycle against the configured database, optionally "as of" a date.
 *   npx tsx --conditions=react-server scripts/run-reminders.ts [2026-09-29T15:00:00Z]
 * Uses the configured email provider (outbox unless EMAIL_PROVIDER=resend).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const asOf = process.argv[2] ? new Date(process.argv[2]) : new Date();
if (Number.isNaN(asOf.getTime())) throw new Error("Invalid date");
const { runReminderCycle } = await import("../src/lib/reminders/engine");
console.log("as of", asOf.toISOString(), JSON.stringify(await runReminderCycle(asOf)));
