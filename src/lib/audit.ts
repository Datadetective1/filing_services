import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActorType = "customer" | "staff" | "system" | "webhook";

export interface AuditEntry {
  actorUserId: string | null;
  actorType: ActorType;
  action: string;
  entityType: string;
  entityId?: string | null;
  filingId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
}

/**
 * Append an audit record. audit_logs is append-only at the database level. Audit
 * writes throw on failure: an important action without its audit record is a bug.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({
      actor_user_id: entry.actorUserId,
      actor_type: entry.actorType,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      filing_id: entry.filingId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ip_hash: entry.ipHash ?? null,
    });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}
