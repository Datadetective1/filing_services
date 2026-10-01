import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The PA open dataset is monthly and has no standing or filing history. Nothing shown to
 * customers, admins or mail/email recipients from it may claim a status. This scans the
 * user-facing strings of every surface that renders register data (comments stripped).
 */
const SURFACES = [
  "src/components/funnel/registry-search.tsx",
  "src/components/intake/prefill-panel.tsx",
  "src/app/(marketing)/find/result/page.tsx",
  "src/app/(marketing)/find/registry-actions.ts",
  "src/app/admin/outreach/page.tsx",
  "src/app/admin/outreach/[id]/page.tsx",
  "src/lib/outreach/email.ts",
  "src/lib/outreach/postcard.ts",
  "src/lib/outreach/mail.ts",
];

const FORBIDDEN = /\b(active|inactive|in good standing|compliant|non-?compliant|outstanding|not filed|unfiled|delinquent|past due)\b/i;

function strings(src: string): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...noComments.matchAll(/(["'`])((?:\.|(?!\1).)*)\1/g)].map((m) => m[2]).concat([...noComments.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]));
}

describe("register-derived wording never claims a status", () => {
  for (const file of SURFACES) {
    it(file, () => {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      const hits = strings(src).filter((s) => FORBIDDEN.test(s) && !/^[a-z_]+$/.test(s));
      expect(hits).toEqual([]);
    });
  }
});
