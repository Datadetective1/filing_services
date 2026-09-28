import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail. Pair with breadcrumbJsonLd() using the same items. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="inline-flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="text-fg">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.path} className="rounded-[var(--radius-control)] py-1 hover:text-fg hover:underline hover:underline-offset-4">
                    {item.name}
                  </Link>
                  <CaretRight size={12} aria-hidden className="text-subtle" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
