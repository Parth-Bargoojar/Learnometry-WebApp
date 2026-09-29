import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Lock, Target } from "lucide-react";
import { COST, severityFor, confidenceFor } from "@/lib/config";
import { TODAY, credits, conceptById, getAttemptConfig, planMeta, planTasks, reports, stateFor } from "@/lib/data";
import { daysBetween, relativeDay, shortDate } from "@/lib/format";
import { Cost, SeverityBadge, btn } from "@/components/ui";
import { SpendLink } from "@/components/credit-gate";

export const metadata: Metadata = { title: "Retest" };

/** Retest introduction — Web App Structure §8.12. */
export default async function RetestPage(props: PageProps<"/assess/retests/[retestId]">) {
  const { retestId } = await props.params;
  const config = getAttemptConfig(retestId);
  if (!config || config.kind !== "retest") notFound();
  const week = planTasks.filter((t) => t.type !== "retest");
  const left = week.filter((t) => t.status !== "completed").length;
  const unlocked = left === 0;
  // "Start anyway" opens 48 h after the baseline diagnostic (Web App Structure §1.9).
  const baseline = reports.find((r) => r.kind === "diagnostic")!.date;
  const canForce = daysBetween(baseline, TODAY) >= 2;
  const earliest = new Date(new Date(`${baseline}T00:00:00Z`).getTime() + 2 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <p className="text-lg text-ink">New questions on the same concepts, at the same difficulty. This measures whether the fix worked.</p>

      <dl className="grid grid-cols-3 overflow-hidden rounded-card border-2 border-line bg-surface">
        {[
          ["20 min", "timed"],
          [`${config.questionIds.length} Qs`, "3 per concept"],
          [`⚡ ${COST.retest}`, "incl. analysis"],
        ].map(([v, l]) => (
          <div key={l} className="border-r border-border-subtle p-4 last:border-r-0">
            <dt className="sr-only">{l}</dt>
            <dd className="font-display text-2xl leading-none tabular-nums text-ink">{v}</dd>
            <dd className="mt-1.5 text-xs text-muted">{l}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-card border border-border-subtle bg-surface p-5" aria-labelledby="targets">
        <h2 id="targets" className="font-semibold text-ink">
          Concepts on this retest
        </h2>
        <ul className="mt-3 divide-y divide-border-subtle">
          {planMeta.focus.map((id) => {
            const s = stateFor(id)!;
            return (
              <li key={id} className="flex items-center gap-3 py-3">
                <Target aria-hidden="true" className="size-4 text-muted" />
                <span className="flex-1 text-[15px] text-ink">{conceptById(id).name}</span>
                <SeverityBadge value={severityFor(s.mastery, confidenceFor(s.scoredItems))} size="sm" />
              </li>
            );
          })}
        </ul>
      </section>

      {unlocked ? (
        <p className="flex items-center gap-2 text-sm text-success-text">
          <CircleCheck aria-hidden="true" className="size-4" /> All this week&apos;s tasks are done. You&apos;re ready.
        </p>
      ) : (
        <div className="flex items-start gap-3 rounded-card border-2 border-dashed border-faint bg-surface p-4">
          <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-sm text-ink">
            Unlocks when you finish {left} more tasks, or on {shortDate(planMeta.retestOn)} ({relativeDay(planMeta.retestOn)}). You can start it earlier if you
            feel ready.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {unlocked || canForce ? (
          <SpendLink href={`/attempt/${config.id}`} cost={COST.retest} what="A retest" variant={unlocked ? "primary" : "secondary"} size="lg">
            {unlocked ? "Start retest" : "Start retest anyway"}
          </SpendLink>
        ) : (
          <span className={btn("secondary", "lg")} aria-disabled="true">
            Start retest <Cost credits={COST.retest} />
          </span>
        )}
        <p className="text-sm text-muted">
          {unlocked || canForce
            ? `You have ${credits.balance} credits.`
            : `Early start opens ${relativeDay(earliest)}, 48 hours after your diagnostic, so the retest measures learning rather than memory.`}
        </p>
      </div>
      <p className="text-sm text-muted">
        Want to see a finished example?{" "}
        <Link href={`/assess/retests/${config.id}/result`} className="font-semibold text-primary-text underline underline-offset-4">
          View a sample result
        </Link>
      </p>
    </div>
  );
}
