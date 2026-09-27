"use client";

import { Mascot } from "@/components/feedback";
import { btn } from "@/components/ui";
import { siteUrl } from "@/lib/site";

/* DS §24: specific, calm, says what was not lost, offers the next step. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-[460px] flex-col items-center gap-3 py-12 text-center">
      <Mascot />
      <h2 className="mt-2 text-xl font-semibold text-ink">Something went wrong</h2>
      <p className="text-[15px] text-muted">Your answers and your plan are safe. Check your connection and try again.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={btn("primary")}>
          Try again
        </button>
        <a href={siteUrl("/contact")} className={btn("secondary")}>
          Contact support
        </a>
      </div>
    </div>
  );
}
