import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { loadCreditHistory } from "@/domains/credits/queries";
import { COST, PLANS, enoughFor } from "@/lib/config";
import { requireLearner } from "@/lib/auth/session";
import { dayMonth } from "@/lib/format";
import { ButtonLink, Card, CardHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Credits" };

const BUYS: [string, number][] = [
  ["Full diagnostic", COST.fullDiagnostic],
  ["Chapter diagnostic", COST.chapterDiagnostic],
  ["Study plan", COST.studyPlan],
  ["Practice set (5 questions)", COST.practiceSet5],
  ["Retest", COST.retest],
  ["Explanation or step-by-step breakdown", COST.explanation],
  ["Hint", COST.hint],
];

/** Credits — Web App Structure §8.14. Credits, never tokens. Balance, breakdown and history are ledger rows. */
export default async function CreditsPage(props: PageProps<"/credits">) {
  const viewer = await requireLearner();
  const { before } = await props.searchParams;
  const cursor = typeof before === "string" ? before : undefined;
  const history = await loadCreditHistory(viewer.userId, viewer.learner.id, cursor);
  const plan = PLANS[viewer.plan];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card level="primary" className="p-5 sm:p-6 lg:col-span-5" aria-labelledby="bal-h">
        <h2 id="bal-h" className="text-sm font-semibold text-muted">
          Balance
        </h2>
        <p className="mt-2 font-display text-5xl leading-none tabular-nums text-ink">{viewer.balance}</p>
        <p className="mt-2 text-sm text-muted">
          {plan.name} plan · {plan.period === "daily" ? `${plan.periodCredits} a day` : `${plan.periodCredits} a month`}
        </p>
        <p className="mt-4 text-[15px] font-semibold text-ink">{enoughFor(viewer.balance)}</p>
        <details className="group mt-4 border-t border-border-subtle">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Breakdown
            <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-border-subtle">
            {viewer.buckets.map((b) => (
              <li key={b.label} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-ink">{b.label}</p>
                  <p className="text-xs text-muted">{b.note}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-ink">{b.amount}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">We use credits that expire soonest first.</p>
        </details>
        <ButtonLink href="/credits/buy" variant="secondary" className="mt-4">
          Get credits
        </ButtonLink>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="buy-h">
        <CardHeader id="buy-h" title="What credits buy" meta="Reading reports, solutions, your plan and progress is always free." />
        <ul className="mt-4 divide-y divide-border-subtle">
          {BUYS.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between py-2.5 text-[15px]">
              <span className="text-ink">{k}</span>
              <span className="font-semibold tabular-nums text-ink">⚡ {v}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="hist-h">
        <CardHeader id="hist-h" title="History" />
        <div role="region" aria-label="Credit history" tabIndex={0} className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[15px]">
            <caption className="sr-only">Credit transactions, newest first</caption>
            <thead>
              <tr className="border-b border-border-subtle text-xs text-muted">
                <th scope="col" className="py-2 font-semibold">Date</th>
                <th scope="col" className="py-2 font-semibold">What</th>
                <th scope="col" className="py-2 text-right font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((t) => (
                <tr key={t.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-3 tabular-nums text-muted">{dayMonth(t.date)}</td>
                  <td className="py-3 text-ink">{t.description}</td>
                  <td className={`py-3 text-right font-semibold tabular-nums ${t.amount > 0 ? "text-success-text" : "text-ink"}`}>
                    {t.amount > 0 ? `+${t.amount}` : `−${Math.abs(t.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.rows.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing yet. Credits you receive and use will show here.</p> : null}
        {history.next ? (
          <ButtonLink href={`/credits?before=${encodeURIComponent(history.next)}`} variant="secondary" size="sm" className="mt-3">
            Show earlier
          </ButtonLink>
        ) : null}
      </Card>
    </div>
  );
}
