import { ArrowRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section } from "@/components/marketing/section";
import { buttonClasses } from "@/components/ui/button";
import { absoluteUrl, site } from "@/config/site";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { GLOSSARY, GLOSSARY_CHECKED, type GlossaryTerm } from "@/lib/seo/glossary";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const PATH = "/glossary";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Glossary", path: PATH },
];

export const metadata: Metadata = pageMetadata({
  title: "Business Filing Glossary: Annual Report, Registered Agent, Good Standing",
  description:
    "Plain answers to the filing words small business owners run into: annual report, registered agent, good standing, administrative dissolution, reinstatement and more.",
  path: PATH,
  absoluteTitle: true,
});

const GATED = ["/registered-agent", "/business-formation"];

function visibleLink(t: GlossaryTerm, services: boolean): GlossaryTerm["link"] | null {
  if (!t.link) return null;
  if (!services && GATED.some((g) => t.link!.href.startsWith(g))) return null;
  return t.link;
}

function termSetJsonLd() {
  return {
    "@type": "DefinedTermSet",
    "@id": absoluteUrl(`${PATH}#terms`),
    name: `${site.name} business filing glossary`,
    url: absoluteUrl(PATH),
    hasDefinedTerm: GLOSSARY.map((t) => ({
      "@type": "DefinedTerm",
      "@id": absoluteUrl(`${PATH}#${t.slug}`),
      name: t.term,
      ...(t.aka?.length ? { alternateName: t.aka } : {}),
      description: t.definition,
      url: absoluteUrl(`${PATH}#${t.slug}`),
      inDefinedTermSet: absoluteUrl(`${PATH}#terms`),
    })),
  };
}

export default function GlossaryPage() {
  const services = businessServicesPagesEnabled();
  return (
    <>
      <JsonLd data={graph(termSetJsonLd(), breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Filing words, <span className="mark-highlight">in plain English</span>
          </>
        }
        lede={<p>What the state means by annual report, registered agent, good standing and the rest, and why each one matters to your business.</p>}
      >
        <nav aria-label="Terms" className="flex flex-wrap gap-2 pt-2">
          {GLOSSARY.map((t) => (
            <a
              key={t.slug}
              href={`#${t.slug}`}
              className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3.5 text-[14px] font-medium text-muted shadow-card transition-[transform,color] duration-200 hover:-translate-y-0.5 hover:text-fg"
            >
              {t.term}
            </a>
          ))}
        </nav>
      </PageIntro>

      <Section>
        <dl className="grid gap-5 md:grid-cols-2 [perspective:1400px]">
          {GLOSSARY.map((t, i) => {
            const link = visibleLink(t, services);
            return (
              <div
                key={t.slug}
                id={t.slug}
                className="group relative grid scroll-mt-24 content-start gap-3 overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card transition-transform duration-300 [transform-style:preserve-3d] hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateZ(8px)]"
              >
                <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-accent/10 blur-xl" />
                <span aria-hidden className="tnum font-mono text-[11px] uppercase tracking-wider text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <dt className="flex items-center gap-2 font-display text-xl font-semibold text-fg">
                  <BookOpenText size={20} weight="duotone" aria-hidden className="text-accent" />
                  {t.term}
                </dt>
                <dd className="grid gap-3">
                  <p className="text-[16px] leading-7 text-fg">{t.definition}</p>
                  <p className="text-[15px] leading-6 text-muted">{t.matters}</p>
                  {t.aka?.length ? <p className="text-[13px] text-subtle">Also called: {t.aka.join(", ")}</p> : null}
                  {link ? (
                    <Link href={link.href} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-accent">
                      {link.label}
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-8 text-[13px] text-subtle">
          General information, checked {GLOSSARY_CHECKED}. State rules differ; each state page has the details for that state. {site.name} is a private
          filing service, not a law firm.
        </p>
      </Section>

      <Section band>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[42px]">See what your business owes this year</h2>
          <Link href="/find" prefetch={false} className={buttonClasses("primary", "md")}>
            Find my business
          </Link>
        </div>
      </Section>
    </>
  );
}
