import { INDEXNOW_KEY } from "@/lib/seo/indexnow";

/** IndexNow ownership file (indexnow.org): its body is the key. The key is public by design. */
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
