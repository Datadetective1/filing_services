import { absoluteUrl, site } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable, formationOpenStates } from "@/lib/registered-agent/sales";
import { formationStatePath, leadType } from "@/lib/seo/formation-pages";
import { BEST_OF_PATHS } from "@/lib/seo/best-of";
import { businessSearchStates } from "@/lib/seo/business-search";
import { assumedNameNoticeText } from "@/lib/seo/legal";
import { annualReportPlaces, pickableStates } from "@/lib/services/state-services";
import { publicServicePrices } from "@/lib/services/public-prices";

export const revalidate = 3600;

/**
 * /llms.txt: a plain summary of what Filewell does and costs, for AI assistants and search
 * tools that read it (llmstxt.org). Built from the same live prices and switches as the pages,
 * so it never states a price or a state that checkout would refuse.
 */
export async function GET() {
  const services = businessServicesIndexable();
  const [prices, places] = await Promise.all([
    services ? publicServicePrices().catch(() => ({}) as Awaited<ReturnType<typeof publicServicePrices>>) : Promise.resolve({} as Awaited<ReturnType<typeof publicServicePrices>>),
    services ? annualReportPlaces().catch(() => []) : Promise.resolve([]),
  ]);
  const money = (c: number) => formatCents(c, { trimZeros: true });
  const ra = prices.registered_agent;
  const bundle = prices.ra_annual_report_bundle;
  const formation = prices.formation;
  const reportFrom = places.length ? Math.min(...places.map((p) => p.serviceCents)) : null;
  const searchStates = businessSearchStates();

  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.name} is a private U.S. business filing service. It files state annual reports, acts as registered agent and forms new LLCs and corporations, online and self-serve. State fees are passed through at cost and shown before payment. ${site.disclaimer}`,
    "",
    "## Services and prices",
    "",
    ...(reportFrom !== null
      ? [`- [Annual report filing](${absoluteUrl("/annual-report")}): from ${money(reportFrom)} plus the state fee, in ${places.length} states. Orders are prefilled from the state's public register where available.`]
      : [`- [Annual report filing](${absoluteUrl("/annual-report")}): deadlines, state fees and filing for each supported state.`]),
    ...(services && ra !== undefined
      ? [`- [Registered agent](${absoluteUrl("/registered-agent")}): ${money(ra)} a year, the same at renewal, in ${pickableStates().length} states and territories. Switching from another agent: state fee only.`]
      : []),
    ...(services && bundle !== undefined ? [`- Registered agent plus annual report filing: ${money(bundle)} a year plus the state report fee.`] : []),
    ...(services && formation !== undefined ? [`- [Business formation](${absoluteUrl("/business-formation")}): ${money(formation)} plus the state fee, in ${formationOpenStates().length} states and territories. Registered agent service is an optional add-on.`] : []),
    "",
    ...(services && formation !== undefined && formationOpenStates().length
      ? [
          "## Start a business by state",
          "",
          ...formationOpenStates().map((s) => {
            const t = leadType(s);
            const fee = s.feeCents[t] as number;
            return `- [Start ${t === "llc" ? "an LLC" : "a corporation"} in ${s.name}](${absoluteUrl(formationStatePath(s.slug))}): ${money(fee)} state fee, ${money(formation + fee)} total with ${site.name}.`;
          }),
          "",
        ]
      : []),
    "## Free tools",
    "",
    `- [Business search](${absoluteUrl("/business-search")}): live search of official business registers in ${searchStates.map((s) => s.name).join(", ")}.`,
    `- [Find what's due](${absoluteUrl("/find")}): a business's next annual report due date, state fee and source, with free email reminders.`,
    "",
    ...(services
      ? [
          "## Comparisons",
          "",
          `- [Best annual report filing services](${absoluteUrl(BEST_OF_PATHS["annual-report"])}): ${site.name}, LegalZoom, ZenBusiness, Northwest, Bizee and Harbor Compliance, prices read on each company's own site.`,
          `- [Best registered agent services](${absoluteUrl(BEST_OF_PATHS["registered-agent"])}): first year, renewal and two-year total for the same six.`,
          `- [Pennsylvania: file it yourself or use a service?](${absoluteUrl("/pennsylvania/file-yourself-or-use-a-service")}): $7 state fee on your own, or $56 total with ${site.name}.`,
          "",
        ]
      : []),
    "## Company",
    "",
    `- [About ${site.name}](${absoluteUrl("/about")}): ${assumedNameNoticeText() ?? `${site.name} is a private filing service.`}${site.postalAddress ? ` Mailing address: ${site.postalAddress}.` : ""} A person checks every filing before it goes to the state.`,
    ...(site.trustpilotUrl ? [`- [${site.name} on Trustpilot](${site.trustpilotUrl}): customer reviews.`] : []),
    "",
    "## More",
    "",
    `- [Pricing](${absoluteUrl("/pricing")})`,
    `- [Annual report rules by state](${absoluteUrl("/states")})`,
    `- [Help](${absoluteUrl("/help")})`,
    `- Contact: ${site.supportEmail}`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
