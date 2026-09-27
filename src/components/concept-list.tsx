"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { confidenceFor, severityFor, showsMasteryNumber, type Severity } from "@/lib/config";
import { chapters, concepts, stateFor } from "@/lib/data";
import { ago } from "@/lib/format";
import { ProgressBar, SeverityBadge, severityLabel } from "./ui";

const FILTERS: (Severity | "all" | "unassessed")[] = ["all", "critical", "weak", "needs_work", "stable", "strong", "insufficient", "unassessed"];

/** All concepts by chapter — Web App Structure §8.13. Filter in `?status=`. */
export function ConceptList() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("status") as (typeof FILTERS)[number]) || "all";

  const rows = concepts.map((c) => {
    const s = stateFor(c.id);
    const conf = confidenceFor(s?.scoredItems ?? 0);
    const sev = s ? severityFor(s.mastery, conf) : null;
    return { c, s, conf, sev };
  });
  const match = (r: (typeof rows)[number]) => (filter === "all" ? true : filter === "unassessed" ? !r.s : r.sev === filter);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, rows.filter((r) => (f === "all" ? true : f === "unassessed" ? !r.s : r.sev === f)).length]));

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Filter by status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.filter((f) => f === "all" || counts[f] > 0).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => router.replace(f === "all" ? "?" : `?status=${f}`, { scroll: false })}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              filter === f ? "border-2 border-line bg-surface text-ink shadow-brutal-sm" : "border-border-subtle text-muted hover:text-ink"
            }`}
          >
            {f === "all" ? "All" : f === "unassessed" ? "Not assessed" : severityLabel(f)} ({counts[f]})
          </button>
        ))}
      </div>

      {chapters.map((ch) => {
        const list = rows.filter((r) => r.c.chapterId === ch.id && match(r));
        if (!list.length) return null;
        return (
          <section key={ch.id} aria-labelledby={`h-${ch.id}`}>
            <h2 id={`h-${ch.id}`} className="mb-2 text-base font-semibold text-ink">
              {ch.name}
            </h2>
            <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
              {list.map(({ c, s, conf, sev }) => {
                const delta = s && s.baselineMastery !== null ? s.mastery - s.baselineMastery : 0;
                return (
                  <li key={c.id}>
                    <Link href={`/progress/concepts/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-sunken sm:grid-cols-[1fr_11rem_7rem_auto]">
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{c.name}</span>
                        <span className="block text-xs text-muted">Last practised: {ago(s?.lastPracticed ?? null)}</span>
                      </span>
                      <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        {s && showsMasteryNumber(conf) ? (
                          <span className="flex items-center gap-2">
                            <ProgressBar value={s.mastery} label={`${c.name} mastery`} size="sm" tone="ink" />
                            <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink">{s.mastery}%</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted">{s ? "Needs more answers" : "Not assessed yet"}</span>
                        )}
                      </span>
                      <span className="order-2 sm:order-none">{sev ? <SeverityBadge value={sev} size="sm" /> : null}</span>
                      <span className="hidden items-center gap-1 text-xs font-semibold tabular-nums sm:flex">
                        {delta > 0 ? (
                          <span className="inline-flex items-center text-success-text">
                            <ArrowUpRight aria-hidden="true" className="size-4" />+{delta}
                          </span>
                        ) : delta < 0 ? (
                          <span className="inline-flex items-center text-danger-text">
                            <ArrowDownRight aria-hidden="true" className="size-4" />
                            {delta}
                          </span>
                        ) : null}
                        <ChevronRight aria-hidden="true" className="size-4 text-muted" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
