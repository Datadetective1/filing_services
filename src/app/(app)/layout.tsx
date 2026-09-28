import { site } from "@/config/site";
import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/session";

/** Signed-in customer area. requireUser() here is for the pages; every action re-checks. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      <main className="flex-1 pb-16">{children}</main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-subtle">{site.disclaimer}</footer>
    </div>
  );
}
