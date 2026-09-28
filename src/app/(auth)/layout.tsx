import { site } from "@/config/site";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="px-4 py-5 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-subtle">{site.disclaimer}</footer>
    </div>
  );
}
