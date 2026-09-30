import "server-only";
import { createAdminClient } from "./admin";
import { createAnonClient } from "./server";

export interface KeyCheck {
  ok: boolean;
  /** Short reason when rejected (e.g. "Invalid API key"). Never contains a key. */
  detail: string | null;
}

type ProbeResult = { error: { message: string } | null };

/** Run one harmless read and report whether the project accepted the key. */
export async function probeSupabase(run: () => PromiseLike<ProbeResult>): Promise<KeyCheck> {
  try {
    const { error } = await run();
    return error ? { ok: false, detail: error.message.slice(0, 120) } : { ok: true, detail: null };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 120) : "Unreachable" };
  }
}

/**
 * Live check that both Supabase keys belong to the configured project. A key from
 * another project (for example the staging key left on the Production target) is
 * rejected with "Invalid API key", which otherwise fails silently in background writes.
 */
export async function checkSupabaseKeys(): Promise<{ server: KeyCheck; publicKey: KeyCheck }> {
  const [server, publicKey] = await Promise.all([
    probeSupabase(() => createAdminClient().from("states").select("code", { count: "exact", head: true }).limit(1)),
    probeSupabase(async () => {
      const anon = createAnonClient();
      if (!anon) return { error: { message: "Public Supabase URL or key is not configured" } };
      return anon.from("states").select("code", { count: "exact", head: true }).limit(1);
    }),
  ]);
  return { server, publicKey };
}
