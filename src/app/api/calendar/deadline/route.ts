import { createHash } from "node:crypto";
import { absoluteUrl, site } from "@/config/site";
import { deadlineHref, parseDeadlineQuery } from "@/lib/calendar/deadline";
import { deadlineIcs } from "@/lib/calendar/ics";

/**
 * "Add to calendar" for a filing due date shown on the result page. Everything in the file
 * is rebuilt from the verified rule; the only free text is the business name, cleaned and
 * capped. Nothing is stored.
 */
export async function GET(request: Request) {
  const parsed = parseDeadlineQuery(new URL(request.url).searchParams);
  if (!parsed) return new Response("Not found", { status: 404 });
  const { stateCode, stateName, filingName, dueDate, businessName } = parsed;

  const url = absoluteUrl(deadlineHref(stateCode));
  const summary = `${businessName ? `${businessName}: ` : ""}${stateName} ${filingName.toLowerCase()} may be due`;
  const description = `${site.name} can file it for you or remind you again. Check what's due: ${url}\n${site.name} is a private service, not a state agency.`;
  const uid = `${createHash("sha256").update(`${stateCode}|${businessName}|${dueDate}`).digest("hex").slice(0, 24)}@getfilewell.com`;
  const body = deadlineIcs({ dueDate, summary, description, url, uid });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stateCode.toLowerCase()}-${filingName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dueDate}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
