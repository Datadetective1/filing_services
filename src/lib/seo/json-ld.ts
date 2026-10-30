import { absoluteUrl, site, siteUrl } from "@/config/site";
import type { FaqItem } from "@/lib/compliance/types";
import type { Quote } from "@/lib/domain/pricing";

/**
 * schema.org structured data. The brand is described as a private Organization that
 * offers a Service. Never GovernmentService, GovernmentOrganization or ratings.
 */

type Json = Record<string, unknown>;

export const organizationId = () => absoluteUrl("/#organization");
export const websiteId = () => absoluteUrl("/#website");

function organizationRef(): Json {
  return { "@type": "Organization", "@id": organizationId(), name: site.name, url: siteUrl() };
}

export function organizationJsonLd(): Json {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: site.name,
    // The operating company, only once it is configured (never the placeholder text).
    ...(site.legalEntityConfigured ? { legalName: site.legalEntity } : {}),
    url: siteUrl(),
    logo: { "@type": "ImageObject", url: absoluteUrl("/apple-icon"), width: 180, height: 180 },
    description: `${site.description} ${site.disclaimer}`,
    email: site.supportEmail,
    areaServed: { "@type": "Country", name: "United States" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: site.supportEmail, availableLanguage: "en" },
  };
}

export function websiteJsonLd(): Json {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    name: site.name,
    url: siteUrl(),
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
    description: `Total $${usd(quote.totalCents)}: the ${stateName} state filing fee of $${usd(quote.governmentFeeCents)} (paid to the state, passed through at cost) plus the ${site.name} service fee of $${usd(quote.serviceFeeCents)}. You can also file directly with the state.`,
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

/**
 * A business service (registered agent, formation) offered by the private Organization.
 * The offer appears only when a price is set: a missing price is left out, never guessed.
 * No ratings or reviews.
 */
export function businessServiceJsonLd(input: {
  name: string;
  serviceType: string;
  description: string;
  path: string;
  /** A state's name, or omitted for the whole United States. */
  stateName?: string;
  offer?: { name: string; priceCents: number; description: string };
}): Json {
  return {
    "@type": "Service",
    "@id": absoluteUrl(`${input.path}#service`),
    name: input.name,
    serviceType: input.serviceType,
    description: `${input.description} ${site.disclaimer}`,
    url: absoluteUrl(input.path),
    provider: organizationRef(),
    areaServed: input.stateName ? { "@type": "State", name: input.stateName } : { "@type": "Country", name: "United States" },
    ...(input.offer
      ? {
          offers: {
            "@type": "Offer",
            name: input.offer.name,
            url: absoluteUrl(input.path),
            price: usd(input.offer.priceCents),
            priceCurrency: "USD",
            description: input.offer.description,
            seller: organizationRef(),
          },
        }
      : {}),
  };
}

/** A guide page: plain Article published by the private Organization (never a government body). */
export function articleJsonLd(input: { headline: string; description: string; path: string; dateModified: string }): Json {
  return {
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntityOfPage: absoluteUrl(input.path),
    dateModified: input.dateModified,
    inLanguage: "en-US",
    author: organizationRef(),
    publisher: organizationRef(),
  };
}

/** Wrap nodes in a single @graph document. */
export function graph(...nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes };
}
