import Link from "next/link";
import { site } from "@/config/site";
import { Container } from "@/components/ui/surface";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            <strong className="font-medium text-fg">{site.disclaimer}</strong> We are a private company that
            prepares and submits filings on your behalf. You can always file directly with your state.
          </p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2 text-sm">
          <p className="font-medium text-fg">Product</p>
          <Link className="text-muted hover:text-fg" href="/annual-report">Annual reports</Link>
          <Link className="text-muted hover:text-fg" href="/annual-report/pennsylvania">Pennsylvania annual report</Link>
          <Link className="text-muted hover:text-fg" href="/states">Browse by state</Link>
          <Link className="text-muted hover:text-fg" href="/pricing">Pricing</Link>
        </nav>
        <nav aria-label="Legal" className="grid content-start gap-2 text-sm">
          <p className="font-medium text-fg">Legal</p>
          <Link className="text-muted hover:text-fg" href="/legal/terms">Terms of service</Link>
          <Link className="text-muted hover:text-fg" href="/legal/privacy">Privacy policy</Link>
          <Link className="text-muted hover:text-fg" href="/legal/refunds">Refund policy</Link>
          <Link className="text-muted hover:text-fg" href="/legal/filing-authorization">Filing authorization</Link>
          <Link className="text-muted hover:text-fg" href="/legal/disclaimer">Disclaimer</Link>
        </nav>
      </Container>
      <Container className="border-t border-border py-5 text-xs text-subtle">
        © {new Date().getFullYear()} {site.name}. Not a law firm and does not provide legal advice. Filing fees are set by each state and passed through at cost.
      </Container>
    </footer>
  );
}
