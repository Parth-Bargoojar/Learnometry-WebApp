import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown, ClipboardCheck, RefreshCw, Target, type LucideIcon } from "lucide-react";
import { attemptHistory, type AttemptHistoryItem } from "@/lib/data";
import { dayMonth } from "@/lib/format";
import { EmptyState } from "@/components/feedback";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "History" };

type Kind = AttemptHistoryItem["kind"];
const FILTERS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "diagnostic", label: "Diagnostics" },
  { key: "retest", label: "Retests" },
  { key: "practice", label: "Practice" },
];
const KIND: Record<Kind, { label: string; icon: LucideIcon; cls: string }> = {
  diagnostic: { label: "Diagnostic", icon: ClipboardCheck, cls: "border-line bg-surface text-ink" },
  retest: { label: "Retest", icon: RefreshCw, cls: "border-primary-deep/40 bg-primary/10 text-ink" },
  practice: { label: "Practice", icon: Target, cls: "border-border-subtle bg-sunken text-muted" },
};

/** Attempt history — Web App Structure §8.13: chronological, filter by type, each row links to its result. */
export default async function ProgressHistoryPage(props: PageProps<"/progress/history">) {
  const { type } = await props.searchParams;
  const active = (FILTERS.find((f) => f.key === type)?.key ?? "all") as Kind | "all";
  const rows = active === "all" ? attemptHistory : attemptHistory.filter((a) => a.kind === active);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <nav aria-label="Filter by type">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = f.key === active;
            const count = f.key === "all" ? attemptHistory.length : attemptHistory.filter((a) => a.kind === f.key).length;
            return (
              <li key={f.key}>
                <Link
                  href={f.key === "all" ? "/progress/history" : `/progress/history?type=${f.key}`}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                  className={`inline-flex h-10 touch:h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${
                    on ? "border border-primary bg-primary/10 text-ink" : "border-border-subtle bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span className="tabular-nums text-muted">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length ? (
        <ol className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
          {rows.map((a) => {
            const k = KIND[a.kind];
            return (
              <li key={a.id} className="p-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <time dateTime={a.date} className="w-14 shrink-0 text-sm tabular-nums text-muted">
                    {dayMonth(a.date)}
                  </time>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${k.cls}`}>
                    <k.icon aria-hidden="true" className="size-3.5" />
                    {k.label}
                  </span>
                  <span className="min-w-0 flex-1 basis-48 font-medium text-ink">{a.title}</span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-ink">{a.result}</span>
                    <span className="block text-xs tabular-nums text-muted">{a.pct}%</span>
                  </span>
                </div>
                {a.href ? (
                  <Link href={a.href} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4 sm:ml-[4.25rem]">
                    View {a.kind === "diagnostic" ? "report" : "result"} <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : (
                  <details className="group mt-1 sm:ml-[4.25rem]">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary-text [&::-webkit-details-marker]:hidden">
                      Summary <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-1 text-sm text-ink">{a.summary}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title={`No ${FILTERS.find((f) => f.key === active)?.label.toLowerCase()} yet`}
          body="Everything you finish appears here with its score."
          action={<ButtonLink href="/progress/history" variant="secondary">Show all</ButtonLink>}
        />
      )}
      <p className="text-sm text-muted">Scores count toward progress only from diagnostics and retests. Practice shows how a set went, not your mastery.</p>
    </div>
  );
}
