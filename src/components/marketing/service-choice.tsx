import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

/** One service as a card: what it is, what it costs, and where to start. Used on the homepage and pricing. */
export function ServiceChoice({
  title,
  price,
  body,
  href,
  cta,
  featured = false,
}: {
  title: string;
  price: string;
  body: string;
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`group grid h-full content-start gap-1.5 rounded-[var(--radius-surface)] border bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-accent/40 sm:p-5 ${featured ? "border-accent ring-1 ring-accent/30" : "border-border"}`}
      >
        {featured ? <span className="text-xs font-bold uppercase tracking-wider text-accent">Best value</span> : null}
        <span className="text-[17px] font-semibold text-fg">{title}</span>
        <span className="text-[15px] font-medium text-fg">{price}</span>
        <span className="text-sm leading-6 text-muted">{body}</span>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          {cta}
          <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}
