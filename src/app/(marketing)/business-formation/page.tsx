import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Prose, Section } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable, businessServicesPagesEnabled, formationOpenStates } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { breadcrumbJsonLd, businessServiceJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Business Formation",
    description: "Form an LLC or corporation with Filewell: one service fee plus the state's filing fee, with registered agent service only if you choose it.",
    path: "/business-formation",
    noindex: !businessServicesIndexable(),
  });
}

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Business formation", path: "/business-formation" },
];

const STEPS = [
  { n: "1", title: "Tell us about it", body: "Name, address, owners. About five minutes." },
  { n: "2", title: "Pay once", body: "Our fee and the state fee, each on its own line." },
  { n: "3", title: "We file it", body: "You get the state's approval in your dashboard." },
];

function money(cents: number) {
  return formatCents(cents, { trimZeros: true });
}

export default async function BusinessFormationPage() {
  if (!businessServicesPagesEnabled()) notFound();
  const prices = await publicServicePrices();
  const open = formationOpenStates();
  const fee = prices.formation;
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(CRUMBS),
          businessServiceJsonLd({
            name: "Business formation",
            serviceType: "LLC and corporation formation filing",
            description: "We file your LLC or corporation with the state for one service fee plus the state's own fee, each shown on its own line.",
            path: "/business-formation",
          }),
        )}
      />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title="Start your business"
        lede={<p>We file your LLC or corporation with the state{fee !== undefined ? ` for ${money(fee)}` : ""} plus the state&apos;s own fee.</p>}
      />
      <Section>
        <div className="grid gap-8">
          {open.length === 0 || fee === undefined ? (
            <Notice tone="info" title="Not open yet">
              <p>We only take formation orders in a state once we&apos;ve checked its filing fee on the state&apos;s own site.</p>
            </Notice>
          ) : (
            <>
              <ol className="grid gap-3 sm:grid-cols-3">
                {STEPS.map((s) => (
                  <li key={s.n} className="grid gap-1 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card">
                    <span className="grid size-8 place-items-center rounded-full bg-accent/10 text-sm font-bold text-accent">{s.n}</span>
                    <span className="text-[15px] font-semibold text-fg">{s.title}</span>
                    <span className="text-sm leading-6 text-muted">{s.body}</span>
                  </li>
                ))}
              </ol>
              <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
                <table className="w-full min-w-[22rem] text-left text-sm">
                  <caption className="sr-only">Total price to form a business, by state</caption>
                  <thead className="border-b border-border text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">State</th>
                      <th scope="col" className="px-4 py-3 font-medium">LLC</th>
                      <th scope="col" className="px-4 py-3 font-medium">Corporation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((s) => (
                      <tr key={s.code} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-3 font-semibold text-fg">{s.name}</th>
                        {(["llc", "corporation"] as const).map((t) => {
                          const stateFee = s.feeCents[t];
                          return (
                            <td key={t} className="px-4 py-3 align-top">
                              {stateFee === undefined ? (
                                <span className="text-muted">Not offered</span>
                              ) : (
                                <span className="grid">
                                  <span className="font-semibold text-fg">{money(fee + stateFee)}</span>
                                  <span className="text-xs text-muted">{money(stateFee)} state fee</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/dashboard/services/formation" prefetch={false} className={buttonClasses("primary", "md", "w-fit")}>
                Start your business
              </Link>
            </>
          )}
          <Prose>
            <h2>Good to know</h2>
            <ul>
              <li>The state fee is passed through at cost. We add nothing to it.</li>
              <li>
                Registered agent service is optional{prices.registered_agent !== undefined ? ` (${money(prices.registered_agent)} a year)` : ""}. You can name any agent you like.
              </li>
              <li>
                Already formed? See{" "}
                <Link href="/registered-agent" className={textLinkClasses}>
                  registered agent
                </Link>{" "}
                and{" "}
                <Link href="/annual-report" className={textLinkClasses}>
                  annual reports
                </Link>
                .
              </li>
            </ul>
          </Prose>
        </div>
      </Section>
    </>
  );
}
