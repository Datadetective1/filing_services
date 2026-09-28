import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit backed by Postgres (public.rate_limit_hit). Fails OPEN on
 * infrastructure errors for low-risk endpoints, CLOSED when `failClosed` is set.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return !opts.failClosed;
    return data === true;
  } catch {
    return !opts.failClosed;
  }
}
