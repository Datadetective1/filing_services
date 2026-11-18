import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section } from "@/components/marketing/section";
import { site } from "@/config/site";
import { badgeEmbedHtml, badgeImagePath, badgeRows } from "@/lib/seo/badge";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { BadgeBuilder } from "./badge-builder";

export const revalidate = 86400;

const PATH = "/tools/deadline-badge";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Free tools", path: "/tools" },
  { name: "Deadline badge", path: PATH },
];

export const metadata: Metadata = pageMetadata({
  title: "Free Annual Report Deadline Badge for Your Website",
  description:
    "Show your clients or readers when their state's annual report is due. Free badge for accountants, bookkeepers and business sites. Copy one line of code.",
  path: PATH,
  absoluteTitle: true,
});

const POINTS = [
  "Always shows the state's current due date and fee, checked against the state's rules.",
  "One line of plain HTML. No script, no cookies, no tracking on your site.",
  "Clicking it opens that state's annual report page with free reminders.",
];

export default function DeadlineBadgePage() {
  const rows = badgeRows();
  const options = rows.map((r) => ({ slug: r.slug, name: r.name, imageSrc: badgeImagePath(r.slug), embedHtml: badgeEmbedHtml(r) }));
  const initial = rows.find((r) => r.code === "PA")?.slug ?? rows[0]?.slug ?? "";
  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            A free <span className="mark-highlight">deadline badge</span> for your site
          </>
        }
        lede={<p>Accountants, bookkeepers and business blogs can show when the annual report is due in their state. Pick a state and copy the code.</p>}
      >
        <ul className="grid gap-2 pt-2">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[15px] text-muted">
              <CheckCircle size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
              {p}
            </li>
          ))}
        </ul>
      </PageIntro>
      <Section>
        {options.length ? <BadgeBuilder options={options} initial={initial} /> : <p className="text-muted">Badges are coming soon.</p>}
        <p className="mt-8 text-[13px] text-subtle">
          The badge is free to use on any site. {site.name} is a private filing service, not a state agency.
        </p>
      </Section>
    </>
  );
}
