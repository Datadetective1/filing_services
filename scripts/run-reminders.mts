/**
 * Run one reminder cycle against the configured database, optionally "as of" a date.
 *   npx tsx --conditions=react-server scripts/run-reminders.mts [2026-09-29T15:00:00Z]
 * Email goes wherever the app would send it (getEmailReadiness in src/lib/email/provider.ts):
 * off the Vercel production runtime that is the outbox, unless EMAIL_PROVIDER=resend and
 * EMAIL_DELIVERY_OUTSIDE_PRODUCTION=true are both set (with RESEND_API_KEY). The script
 * prints the delivery mode before doing anything.
 *
 * Prints the target project. Production requires CONFIRM_PRODUCTION=<production ref>,
 * never accepts a custom "as of" date (that would email real customers early), and is
 * refused unless email is actually delivering: an outbox run would record real
 * customers' reminders as sent without delivering them, and the cron would then skip
 * them. Leave production reminders to the cron. Production operations should use a
 * separate env file, not .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const { assertSupabaseTargetAllowed } = await import("../src/config/environments");
const { siteUrl } = await import("../src/config/site");

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) refuse("Missing NEXT_PUBLIC_SUPABASE_URL");
let target: ReturnType<typeof assertSupabaseTargetAllowed>;
try {
  target = assertSupabaseTargetAllowed(url, "run-reminders");
} catch (e) {
  refuse(e instanceof Error ? e.message : String(e));
}
console.log(`Target Supabase project: ${target.label}`);

// The same decision the app makes, so the run records exactly what it delivers.
const { getEmailReadiness } = await import("../src/lib/email/provider");
const email = getEmailReadiness();
console.log(`Email delivery: ${email.mode}${email.reason ? ` (${email.reason})` : ""}`);
if (target.production && !email.delivering) {
  refuse(
    `Against production, reminders would be recorded as sent without being delivered (email mode: ${email.mode}). Leave production reminders to the cron.`,
  );
}

const customAsOf = process.argv[2];
const asOf = customAsOf ? new Date(customAsOf) : new Date();
if (Number.isNaN(asOf.getTime())) refuse("Invalid date");
if (target.production && customAsOf) {
  refuse("Refusing a custom as-of date against production: reminders would be sent to real customers early.");
}

// Email links are absolute: never deliver real email that points at a non-public host.
const links = siteUrl();
console.log(`Email links use: ${links}`);
if (email.delivering) {
  const host = new URL(links).hostname;
  if (!links.startsWith("https://") || host === "localhost" || host === "127.0.0.1") {
    refuse("Email is delivering but the site URL is not a public https address. Set NEXT_PUBLIC_SITE_URL first.");
  }
}

const { runReminderCycle } = await import("../src/lib/reminders/engine");
console.log("as of", asOf.toISOString(), JSON.stringify(await runReminderCycle(asOf)));
