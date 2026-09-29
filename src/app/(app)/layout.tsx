import Link from "next/link";
import { site } from "@/config/site";
import { AppHeader } from "@/components/layout/app-header";
import { Container } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/session";

/** Signed-in customer area. requireUser() here is for the pages; every action re-checks. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      <main className="flex-1 pb-16">{children}</main>
      <footer className="border-t border-border">
        <Container className="flex flex-col items-center gap-1 py-4 text-center text-[13px] text-subtle sm:flex-row sm:justify-between sm:text-left">
          <p>{site.disclaimer}</p>
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center font-medium text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            Help and questions
          </Link>
        </Container>
      </footer>
    </div>
  );
}
