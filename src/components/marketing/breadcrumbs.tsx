import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail. Pair with breadcrumbJsonLd() using the same items. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px]">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="inline-flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="font-medium text-fg">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link
                    href={item.path}
                    className="inline-flex min-h-8 items-center rounded-[var(--radius-control)] underline-offset-4 transition-colors hover:text-fg hover:underline"
                  >
                    {item.name}
                  </Link>
                  <CaretRight size={12} weight="bold" aria-hidden className="text-border-strong" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
