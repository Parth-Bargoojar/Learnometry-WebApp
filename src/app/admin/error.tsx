"use client";

import { btn } from "@/components/ui";

/* Admin errors say plainly that nothing was changed; every mutation is one transaction (K2). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-card border border-danger/35 bg-danger/5 p-5">
      <h1 className="text-lg font-semibold text-ink">This page failed to load</h1>
      <p className="text-sm text-muted">No change was saved. Try again; if it keeps failing, check the error in the logs.</p>
      {error.digest ? <p className="font-mono text-xs text-muted">Error ID: {error.digest}</p> : null}
      <button type="button" onClick={reset} className={btn("primary", "md")}>
        Try again
      </button>
    </div>
  );
}
