import "server-only";
import { z } from "zod";
import { isProductionEnvironment } from "@/config/site";

/**
 * Server environment. Parsed lazily so builds that don't touch a subsystem don't
 * require its secrets. Secrets are read only here and never logged.
 */

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  APP_SIGNING_SECRET: z.string().min(32),
  IP_HASH_SALT: z.string().min(16).default("dev-only-ip-hash-salt-change-me"),
  PAYMENTS_PROVIDER: z.enum(["sandbox", "stripe"]).default("sandbox"),
  PAYMENTS_LIVE_ENABLED: z.enum(["true", "false"]).default("false"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SANDBOX_WEBHOOK_SECRET: z.string().min(16).optional(),
  EMAIL_PROVIDER: z.enum(["outbox", "resend"]).default("outbox"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    // Names only — never values.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

/** True on the Vercel production deployment. Same answer as isProductionEnvironment(). */
export function isProductionDeployment(): boolean {
  return isProductionEnvironment();
}
