import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Lock, Target } from "lucide-react";
import { COST } from "@/lib/config";
import { TODAY, conceptById, getAttemptConfig, planMeta, planTasks, reports } from "@/lib/data";
import { daysBetween, relativeDay, shortDate } from "@/lib/format";
import { Cost, btn } from "@/components/ui";
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

      <p className="text-[15px] font-semibold text-ink">20 min · {config.questionIds.length} questions · 3 per concept</p>

      <section className="rounded-card border border-border-subtle bg-surface p-5" aria-labelledby="targets">
        <h2 id="targets" className="font-semibold text-ink">
          Concepts on this retest
        </h2>
        <ul className="mt-3 divide-y divide-border-subtle">
          {planMeta.focus.map((id) => (
            <li key={id} className="flex items-center gap-3 py-3">
              <Target aria-hidden="true" className="size-4 text-muted" />
              <span className="flex-1 text-[15px] text-ink">{conceptById(id).name}</span>
            </li>
          ))}
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
            Unlocks when you finish {left} more tasks, or on {shortDate(planMeta.retestOn)}.
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
        {unlocked || canForce ? null : (
          <p className="text-sm text-muted">
            Early start opens {relativeDay(earliest)}, 48 hours after your diagnostic, so the retest measures learning rather than memory.
          </p>
        )}
      </div>
    </div>
  );
}
