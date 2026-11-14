import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StatePicker } from "@/components/funnel/state-picker";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { Container } from "@/components/ui/surface";
import { StateTileMap } from "@/components/visual/state-tile-map";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { pickableStateByCode, pickableStateBySlug, pickableStates } from "@/lib/services/state-services";

export const metadata: Metadata = pageMetadata({
  title: "Pick Your State",
  description: "Choose your state and see everything Filewell can do for your business there, with the full price up front.",
  path: "/services",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Your state", path: "/services" },
];

/** Step one: the state. The picker submits here without JavaScript (?state=texas or ?state=TX). */
export default async function PickStatePage(props: PageProps<"/services">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.state) ? sp.state[0] : sp.state;
  if (raw) {
    const s = pickableStateBySlug(raw.toLowerCase()) ?? pickableStateByCode(raw);
    if (s) redirect(`/services/${s.slug}`);
  }
  const states = pickableStates();

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <section aria-labelledby="pick-title" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_26rem_at_90%_0%,rgb(242_178_58/0.14),transparent_60%),radial-gradient(40rem_24rem_at_0%_100%,rgb(31_90_67/0.12),transparent_60%)]"
        />
        <Container className="relative grid items-center gap-10 pb-16 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24">
          <div className="grid content-start gap-6">
            <h1
              id="pick-title"
              className="max-w-[12ch] text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-fg sm:text-[60px] lg:text-[68px]"
            >
              Start with your <span className="mark-highlight">state</span>.
            </h1>
            <p className="max-w-[36ch] text-lg leading-relaxed text-muted sm:text-xl">
              Pick it and we&apos;ll show everything we can do for your business there, with the full price.
            </p>
            <div className="max-w-xl rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card sm:p-5">
              <StatePicker states={states} />
            </div>
            <p className="text-sm text-muted">Or tap your state on the map.</p>
          </div>
          <div className="rounded-[var(--radius-surface)] border border-border bg-surface/80 p-2 shadow-card sm:p-6">
            <StateTileMap states={states} />
            <p className="mt-3 px-1 text-sm text-muted">Puerto Rico is in the list.</p>
          </div>
        </Container>
        <Container className="pb-12">
          <DisclaimerNote />
        </Container>
      </section>
    </>
  );
}
