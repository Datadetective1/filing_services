import { absoluteUrl, site } from "@/config/site";
import type { FaqItem } from "@/lib/compliance/types";
import type { Quote } from "@/lib/domain/pricing";

/**
 * schema.org structured data. Filewell is described as a private Organization that
 * offers a Service. Never GovernmentService, GovernmentOrganization or ratings.
 */

type Json = Record<string, unknown>;

export const organizationId = () => absoluteUrl("/#organization");
export const websiteId = () => absoluteUrl("/#website");

function organizationRef(): Json {
  return { "@type": "Organization", "@id": organizationId(), name: site.name, url: absoluteUrl("/") };
}

export function organizationJsonLd(): Json {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: site.name,
    url: absoluteUrl("/"),
    description: `${site.description} ${site.disclaimer}`,
  };
}

export function websiteJsonLd(): Json {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
    inLanguage: "en-US",
    publisher: { "@id": organizationId() },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: FaqItem[]): Json {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const usd = (cents: number) => (cents / 100).toFixed(2);

export interface ServiceOfferInput {
  name: string;
  path: string;
  quote: Pick<Quote, "governmentFeeCents" | "serviceFeeCents" | "totalCents">;
}

function offerJsonLd(offer: ServiceOfferInput, stateName: string): Json {
  const { quote } = offer;
  return {
    "@type": "Offer",
    name: offer.name,
    url: absoluteUrl(offer.path),
    price: usd(quote.totalCents),
    priceCurrency: "USD",
    description: `Total $${usd(quote.totalCents)}: the ${stateName} state filing fee of $${usd(quote.governmentFeeCents)} (paid to the state, passed through at cost) plus the ${site.name} service fee of $${usd(quote.serviceFeeCents)}. You can also file directly with the state for the state fee alone.`,
    priceSpecification: {
      "@type": "CompoundPriceSpecification",
      price: usd(quote.totalCents),
      priceCurrency: "USD",
      priceComponent: [
        {
          "@type": "UnitPriceSpecification",
          name: `${stateName} state filing fee (paid to the state)`,
          price: usd(quote.governmentFeeCents),
          priceCurrency: "USD",
        },
        {
          "@type": "UnitPriceSpecification",
          name: `${site.name} service fee`,
          price: usd(quote.serviceFeeCents),
          priceCurrency: "USD",
        },
      ],
    },
    seller: organizationRef(),
  };
}

export function serviceJsonLd(input: {
  name: string;
  description: string;
  path: string;
  stateName: string;
  offers: ServiceOfferInput[];
}): Json {
  return {
    "@type": "Service",
    name: input.name,
    serviceType: "Annual report filing assistance",
    description: `${input.description} ${site.disclaimer}`,
    url: absoluteUrl(input.path),
    provider: organizationRef(),
    areaServed: { "@type": "State", name: input.stateName },
    ...(input.offers.length
      ? { offers: input.offers.length === 1 ? offerJsonLd(input.offers[0], input.stateName) : input.offers.map((o) => offerJsonLd(o, input.stateName)) }
      : {}),
  };
}

/** Wrap nodes in a single @graph document. */
export function graph(...nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes };
}
