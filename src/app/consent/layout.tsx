import Image from "next/image";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Guardian consent" };

/* Minimal public shell for /consent/[token] (Web App Structure §4.3, §8.18): mobile-first, no app chrome. */
export default function ConsentLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center px-4 sm:px-8">
        <a href={siteUrl("/")} aria-label="Learnometry home">
          <Image src="/primary-logo.png" alt="Learnometry" width={611} height={133} sizes="170px" className="h-8 w-auto dark:hidden" priority />
          <Image src="/primary-logo-dark.png" alt="Learnometry" width={611} height={133} sizes="170px" className="hidden h-8 w-auto dark:block" />
        </a>
      </header>
      <main id="main" className="flex flex-1 justify-center px-4 pb-12 pt-2 sm:pt-8">
        <div className="w-full max-w-[520px] sm:rounded-card-lg sm:border-2 sm:border-line sm:bg-surface sm:p-8 sm:shadow-brutal-lg">{children}</div>
      </main>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-1 px-4 pb-6 text-xs text-muted">
        <a href={siteUrl("/guardian-consent")} className="inline-flex min-h-8 items-center hover:text-ink">Guardian consent</a>
        <a href={siteUrl("/privacy")} className="inline-flex min-h-8 items-center hover:text-ink">Privacy</a>
        <a href={siteUrl("/terms")} className="inline-flex min-h-8 items-center hover:text-ink">Terms</a>
        <a href={siteUrl("/contact")} className="inline-flex min-h-8 items-center hover:text-ink">Contact</a>
      </footer>
    </div>
  );
}
