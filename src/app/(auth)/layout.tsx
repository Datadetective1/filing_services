import { ChatCircleText, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "@/components/layout/logo";
import { Photo } from "@/components/media/photo";

/**
 * Sign-in, sign-up and password pages are never indexed, even once the rest of the site is.
 * Child pages set only a title, and metadata merges shallowly, so this robots value applies to all of them.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Sign in, sign up and password pages. The form comes first on every screen size;
 * wide screens add a photograph beside it.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-[100dvh] flex-col px-4 sm:px-8 lg:px-12 xl:px-20">
        <header className="py-4 sm:py-5">
          <Logo />
        </header>
        <main className="flex flex-1 justify-center pb-12 pt-6 sm:pt-12 lg:items-center lg:pt-4">
          <div className="w-full max-w-[25rem]">
            {children}
            <div className="mt-10 grid gap-3 border-t border-border pt-6 text-sm leading-6 text-muted">
              <p className="flex items-start gap-2.5">
                <ShieldCheck size={18} weight="fill" aria-hidden className="mt-[3px] shrink-0 text-accent" />
                <span>{site.disclaimer}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <ChatCircleText size={18} weight="fill" aria-hidden className="shrink-0 text-accent" />
                <span>
                  Stuck?{" "}
                  <Link href="/help" className="font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent">
                    Talk to a person
                  </Link>
                </span>
              </p>
            </div>
          </div>
        </main>
        <footer className="flex flex-wrap gap-x-5 gap-y-1 pb-6 text-[13px] text-subtle">
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
          <Link href="/legal/terms" className="hover:text-fg hover:underline">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-fg hover:underline">
            Privacy
          </Link>
        </footer>
      </div>

      <div className="max-lg:hidden lg:sticky lg:top-0 lg:h-[100dvh] lg:p-4 lg:pl-0">
        <div className="relative h-full">
          <Photo photo="florist" priority sizes="(min-width: 1024px) 50vw, 1px" className="h-full" focus="50% 45%" decorative />
          <div className="absolute inset-x-6 bottom-6 max-w-md rounded-[var(--radius-surface)] bg-surface/95 p-5 shadow-lift backdrop-blur-sm">
            <p className="font-display text-lg font-semibold leading-snug text-fg">Your deadlines in one place.</p>
            <p className="mt-1 text-[15px] leading-6 text-muted">
              See what&apos;s due, get reminders before it&apos;s urgent, and keep the state&apos;s confirmations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
