import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isProductionSupabaseUrl, PRODUCTION_SUPABASE_REF } from "../../../src/config/environments";

/**
 * Test-only backend helpers (service role). Used to create confirmed test users and
 * staff, and to assert database state the UI doesn't expose. Never used by the app,
 * and never pointed at the production project.
 */
let db: SupabaseClient | null = null;

export function backend(): SupabaseClient {
  if (db) return db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  if (isProductionSupabaseUrl(url)) {
    throw new Error(
      `E2E refuses to use the production Supabase project (${PRODUCTION_SUPABASE_REF}). Point NEXT_PUBLIC_SUPABASE_URL at staging or a local stack.`,
    );
  }
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return db;
}

export function uniqueSuffix(): string {
  return randomBytes(3).toString("hex");
}

export function testPassword(): string {
  // Meets the app's policy (10+ chars, upper, lower, digit). Random per run; never committed.
  return `Aa1${randomBytes(9).toString("base64url")}`;
}

export async function createConfirmedUser(prefix: string): Promise<{ id: string; email: string; password: string }> {
  const email = `${prefix}.${uniqueSuffix()}@e2e.filewell.test`;
  const password = testPassword();
  const { data, error } = await backend().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function grantStaff(userId: string, role: "admin" | "operator" = "admin") {
  const { error } = await backend().from("staff_members").upsert({ user_id: userId, role, active: true, display_name: "E2E Operator" });
  if (error) throw new Error(`grantStaff failed: ${error.message}`);
}

export async function deleteUser(userId: string) {
  await backend().auth.admin.deleteUser(userId).catch(() => {});
}
