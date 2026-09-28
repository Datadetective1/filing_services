/**
 * Grant (or revoke) staff access. Roles live in the database, never in the client.
 *   npx tsx scripts/grant-staff.ts someone@example.com admin
 *   npx tsx scripts/grant-staff.ts someone@example.com operator
 *   npx tsx scripts/grant-staff.ts someone@example.com revoke
 * The user must already have signed up.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const [email, role] = process.argv.slice(2);
if (!email || !["admin", "operator", "revoke"].includes(role ?? "")) {
  console.error("Usage: tsx scripts/grant-staff.ts <email> <admin|operator|revoke>");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
  auth: { persistSession: false },
});

async function main() {
  const { data: profile, error } = await db.from("profiles").select("id, email").ilike("email", email).maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error(`No user with email ${email}. Sign up first.`);
  if (role === "revoke") {
    await db.from("staff_members").update({ active: false }).eq("user_id", profile.id);
  } else {
    const { error: upErr } = await db
      .from("staff_members")
      .upsert({ user_id: profile.id, role, active: true, display_name: email.split("@")[0] }, { onConflict: "user_id" });
    if (upErr) throw upErr;
  }
  await db.from("audit_logs").insert({
    actor_type: "system",
    action: role === "revoke" ? "staff.revoked" : "staff.granted",
    entity_type: "staff_member",
    entity_id: profile.id,
    after: { role },
  });
  console.log(`${email}: ${role === "revoke" ? "staff access revoked" : `granted ${role}`}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
