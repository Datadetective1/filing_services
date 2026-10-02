import { EnvelopeSimple, Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { site } from "@/config/site";
import { Container } from "@/components/ui/surface";
import { LEGAL_PAGES, operatorName } from "@/lib/seo/legal";
import { Logo } from "./logo";

const linkClass = "text-[15px] text-muted transition-colors hover:text-fg";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-2">
      <Container className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
        <div className="grid content-start gap-6">
          <Logo />
          <p className="max-w-md text-[15px] leading-7 text-muted">
            <strong className="font-semibold text-fg">{site.disclaimer}</strong> We are a private company that prepares
            and submits filings when you ask us to. You can always file directly with your state.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/help"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-[15px] font-semibold text-fg transition-colors hover:border-fg/40"
            >
              <Lifebuoy size={18} aria-hidden className="text-accent" />
              Talk to a person
            </Link>
            <a
              href={`mailto:${site.supportEmail}`}
              className="inline-flex min-h-11 items-center gap-2 px-1 text-[15px] font-medium text-muted hover:text-fg"
            >
              <EnvelopeSimple size={18} aria-hidden />
              {site.supportEmail}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <nav aria-label="Product" className="grid content-start gap-3">
            <p className="text-sm font-semibold text-fg">{site.name}</p>
            <Link className={linkClass} href="/find">Find my business</Link>
            <Link className={linkClass} href="/annual-report/pennsylvania">Pennsylvania annual report</Link>
            <Link className={linkClass} href="/states">Filing requirements by state</Link>
            <Link className={linkClass} href="/pricing">Pricing</Link>
            <Link className={linkClass} href="/help">Help</Link>
          </nav>
          <nav aria-label="State guides" className="grid content-start gap-3">
            <p className="text-sm font-semibold text-fg">State guides</p>
            <Link className={linkClass} href="/pennsylvania/annual-report-deadline">Annual report deadline</Link>
            <Link className={linkClass} href="/pennsylvania/annual-report-fee">Annual report fee</Link>
            <Link className={linkClass} href="/pennsylvania/how-to-file-annual-report">How to file</Link>
            <Link className={linkClass} href="/pennsylvania/annual-report-after-deadline">Filing after the deadline</Link>
            <Link className={linkClass} href="/pennsylvania/business-search">Business search</Link>
            <Link className={linkClass} href="/annual-report/washington">Washington annual report</Link>
            <Link className={linkClass} href="/annual-report/nevada">Nevada annual list</Link>
            <Link className={linkClass} href="/annual-report/utah">Utah annual renewal</Link>
          </nav>
          <nav aria-label="Legal" className="grid content-start gap-3">
            <p className="text-sm font-semibold text-fg">Legal</p>
            {LEGAL_PAGES.map((p) => (
              <Link key={p.path} className={linkClass} href={p.path}>
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border py-6 text-[13px] leading-6 text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {operatorName()}. Not a law firm; we don&apos;t give legal advice. State fees are set by
          each state and passed through at cost.
        </p>
        <Link href="/credits" className="shrink-0 hover:text-fg">
          Photo credits
        </Link>
      </Container>
    </footer>
  );
}
