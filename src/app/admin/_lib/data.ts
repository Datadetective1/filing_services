import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Read helpers for the operations console. Every caller has already run
 * requireStaff(); reads go through the RLS client, whose staff policies allow
 * reading all rows (so a revoked staff member sees nothing even if a page forgot
 * its check).
 */

export interface StaffEntry {
  id: string;
  role: "operator" | "admin";
  active: boolean;
  displayName: string | null;
  email: string | null;
}

export interface ProfileEntry {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
}

export async function staffDirectory(): Promise<Map<string, StaffEntry>> {
  const db = await createClient();
  const { data: staff } = await db.from("staff_members").select("user_id, role, display_name, active");
  const rows = (staff ?? []) as { user_id: string; role: "operator" | "admin"; display_name: string | null; active: boolean }[];
  const profiles = await profilesByIds(rows.map((r) => r.user_id));
  const map = new Map<string, StaffEntry>();
  for (const r of rows) {
    map.set(r.user_id, {
      id: r.user_id,
      role: r.role,
      active: r.active,
      displayName: r.display_name,
      email: profiles.get(r.user_id)?.email ?? null,
    });
  }
  return map;
}

export function staffLabel(entry: StaffEntry | undefined | null, fallback = "Unassigned"): string {
  if (!entry) return fallback;
  return entry.displayName || entry.email || "Staff member";
}

export async function profilesByIds(ids: (string | null | undefined)[]): Promise<Map<string, ProfileEntry>> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))];
  const map = new Map<string, ProfileEntry>();
  if (!unique.length) return map;
  const db = await createClient();
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await db.from("profiles").select("id, email, full_name, phone").in("id", unique.slice(i, i + 200));
    for (const p of (data ?? []) as { id: string; email: string; full_name: string | null; phone: string | null }[]) {
      map.set(p.id, { id: p.id, email: p.email, fullName: p.full_name, phone: p.phone });
    }
  }
  return map;
}

/** Map order id -> filing id, for linking payments and refunds back to their filing. */
export async function filingIdsByOrder(orderIds: (string | null | undefined)[]): Promise<Map<string, { filingId: string; businessName: string | null }>> {
  const unique = [...new Set(orderIds.filter((v): v is string => typeof v === "string" && v.length > 0))];
  const map = new Map<string, { filingId: string; businessName: string | null }>();
  if (!unique.length) return map;
  const db = await createClient();
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await db
      .from("filings")
      .select("id, order_id, businesses(legal_name)")
      .in("order_id", unique.slice(i, i + 200));
    for (const f of (data ?? []) as { id: string; order_id: string; businesses: { legal_name: string } | { legal_name: string }[] | null }[]) {
      const b = Array.isArray(f.businesses) ? f.businesses[0] : f.businesses;
      map.set(f.order_id, { filingId: f.id, businessName: b?.legal_name ?? null });
    }
  }
  return map;
}

/** PostgREST returns embedded to-one relations as an object or a one-element array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
