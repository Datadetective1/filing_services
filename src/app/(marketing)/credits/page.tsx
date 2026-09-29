import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { PHOTOS } from "@/lib/media/photos";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Photo credits",
  description: "The photographers whose work appears on this site.",
  path: "/credits",
});

export default function CreditsPage() {
  const photos = Object.values(PHOTOS);
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Photo credits", path: "/credits" },
        ]}
      />
      <h1 className="mt-5 text-[34px] font-semibold leading-tight text-fg sm:text-[44px]">Photo credits</h1>
      <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-muted">
        Photographs on this site are used under the{" "}
        <a className={textLinkClasses} href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">
          Unsplash License
        </a>
        . They show small business owners at work, not our customers. Thank you to the photographers.
      </p>
      <ul className="mt-10 divide-y divide-border border-y border-border">
        {photos.map((p) => (
          <li key={p.credit.url} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
            <p className="text-[15px] text-fg">{p.alt}</p>
            <a className={`${textLinkClasses} text-[15px]`} href={p.credit.url} target="_blank" rel="noopener noreferrer">
              {p.credit.name}
            </a>
          </li>
        ))}
      </ul>
    </Container>
  );
}
