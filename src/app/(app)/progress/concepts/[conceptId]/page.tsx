import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { COST, confidenceFor, severityFor, showsMasteryNumber } from "@/lib/config";
import { chapterById, conceptById, concepts, hasQuestions, stateFor } from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/diagnosis";
import { ago } from "@/lib/format";
import type { ErrorCategory } from "@/lib/types";
import { ConfidenceMeter, SeverityBadge } from "@/components/ui";
import { EmptyState } from "@/components/feedback";
import { SpendLink } from "@/components/credit-gate";

export const metadata: Metadata = { title: "Concept" };

/** Concept detail — DS §39 student-state visualisation. */
export default async function ConceptPage(props: PageProps<"/progress/concepts/[conceptId]">) {
  const { conceptId } = await props.params;
  const c = concepts.find((x) => x.id === conceptId);
  if (!c) notFound();
  const s = stateFor(c.id);
  const conf = confidenceFor(s?.scoredItems ?? 0);
  const sev = s ? severityFor(s.mastery, conf) : null;
  const prereqs = c.prerequisites.map(conceptById);
  const dependents = concepts.filter((x) => x.prerequisites.includes(c.id));

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {sev ? <SeverityBadge value={sev} /> : null}
        <span className="text-sm text-muted">
          {chapterById(c.chapterId).name} › {c.topic}
        </span>
      </div>

      {!s ? (
        <EmptyState
          title="Not assessed yet"
          body="Your next full diagnostic or a practice set will give this concept its first evidence."
          action={
            hasQuestions(c.id) ? (
              <SpendLink href={`/attempt/prac-${c.id}-5`} cost={COST.practiceSet5} what="A practice set">
                Practice this concept
              </SpendLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-5 rounded-card-lg border border-line bg-surface p-5 sm:grid-cols-3 sm:p-6">
            <div>
              <dt className="text-xs font-semibold text-muted">Mastery</dt>
              <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">{showsMasteryNumber(conf) ? `${s.mastery}%` : "—"}</dd>
              {!showsMasteryNumber(conf) ? <dd className="mt-1 text-xs text-muted">Needs more answers</dd> : null}
              <dd className="mt-2">
                <ConfidenceMeter value={conf} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Recent accuracy</dt>
              <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">
                {s.recentCorrect}
                <span className="text-base text-muted"> of {s.recentTotal}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Last practised</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">{ago(s.lastPracticed)}</dd>
            </div>
          </dl>

          <section className="rounded-card border border-border-subtle bg-surface p-5" aria-labelledby="graph-h">
            <h2 id="graph-h" className="font-semibold text-ink">
              How it connects
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Builds on</p>
                {prereqs.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {prereqs.map((p) => {
                      const ps = stateFor(p.id);
                      const psev = ps ? severityFor(ps.mastery, confidenceFor(ps.scoredItems)) : null;
                      const weak = psev === "weak" || psev === "critical" || psev === "needs_work";
                      return (
                        <li key={p.id}>
                          <Link href={`/progress/concepts/${p.id}`} className="flex min-h-6 touch:min-h-11 flex-wrap items-center gap-2 text-[15px] text-ink hover:underline hover:underline-offset-4">
                            {p.name}
                            {psev ? <SeverityBadge value={psev} size="sm" /> : null}
                            {weak ? <span className="text-xs font-semibold text-warning-text">Fix this first</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No prerequisites in this unit.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Needed for</p>
                {dependents.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {dependents.map((d) => (
                      <li key={d.id}>
                        <Link href={`/progress/concepts/${d.id}`} className="inline-flex min-h-6 touch:min-h-11 items-center text-[15px] text-ink hover:underline hover:underline-offset-4">
                          {d.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">Nothing else in this unit depends on it.</p>
                )}
              </div>
            </div>
          </section>

          {Object.keys(s.errors).length ? (
            <section className="rounded-card border border-border-subtle bg-surface p-5" aria-labelledby="err-h">
              <h2 id="err-h" className="font-semibold text-ink">
                Common mistakes
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(Object.entries(s.errors) as [ErrorCategory, number][]).map(([k, n]) => (
                  <li key={k} className="rounded-full border border-border-subtle bg-sunken px-3 py-1 text-sm text-ink">
                    {CATEGORY_LABEL[k]} · {n}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {hasQuestions(c.id) ? (
              <SpendLink href={`/attempt/prac-${c.id}-5`} cost={COST.practiceSet5} what="A practice set">
                Practice this concept
              </SpendLink>
            ) : null}
            <Link href="/progress/concepts" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4">
              All concepts <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
