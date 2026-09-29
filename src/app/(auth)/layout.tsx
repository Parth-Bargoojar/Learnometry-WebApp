import Image from "next/image";
import { siteUrl } from "@/lib/site";

/* Auth shell (Web App Structure §5.2): minimal chrome, card on the hero dot-grid. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="relative flex min-h-screen flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-dot-grid [mask-image:linear-gradient(to_bottom,black,transparent_80%)] sm:block" />
        <header className="relative flex h-16 items-center justify-between px-4 sm:px-8">
          <a href={siteUrl("/")} aria-label="Learnometry home" className="inline-flex min-h-11 min-w-11 items-center">
            <Image src="/primary-logo.png" alt="Learnometry" width={611} height={133} sizes="170px" className="h-8 w-auto dark:hidden" priority />
            <Image src="/primary-logo-dark.png" alt="Learnometry" width={611} height={133} sizes="170px" className="hidden h-8 w-auto dark:block" />
          </a>
          <a href={siteUrl("/")} className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-muted hover:text-ink">
            Back to site
          </a>
        </header>
        <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
          <div className="w-full max-w-[440px] bg-transparent sm:rounded-card-lg sm:border-2 sm:border-line sm:bg-surface sm:p-8 sm:shadow-brutal-lg">{children}</div>
        </main>
        <footer className="relative flex flex-wrap justify-center gap-x-5 gap-y-1 px-4 pb-6 text-xs text-muted">
          <a href={siteUrl("/terms")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-ink">Terms</a>
          <a href={siteUrl("/privacy")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-ink">Privacy</a>
          <a href={siteUrl("/guardian-consent")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-ink">Guardian consent</a>
          <a href={siteUrl("/faq")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-ink">Help</a>
        </footer>
      </div>
    </>
  );
}
