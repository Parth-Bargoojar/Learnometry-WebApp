import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PLANS, type PlanCode } from "@/lib/config";
import { learner } from "@/lib/data";
import { passItem, prorate } from "@/lib/billing";
import { PurchaseButton, SwitchButton } from "@/components/billing";
import { needsApproval } from "@/lib/guardian";

export const metadata: Metadata = { title: "Plans" };

/** Plans — same three-card layout as the public pricing page (continuity, §7.8 PlanCard). */
export default function PlansPage() {
  const paid: PlanCode[] = ["starter", "plus", "pro"];
  const current = PLANS[learner.plan];
  const guardianName = learner.guardian?.guardianFirstName;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 rounded-card border border-border-subtle bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-ink">
          <span className="font-semibold">Free</span> · ₹0 · your first diagnostic and plan, then 30 credits a month
        </p>
        <p className="text-sm text-muted">Every plan includes the root-cause report.</p>
      </div>

      {needsApproval && guardianName ? (
        <p className="rounded-card-sm border border-info/40 bg-info/5 px-4 py-3 text-sm text-ink">
          Until you turn 18, {guardianName} approves and pays for passes. Choosing a plan sends {guardianName} a request; nothing is charged to you.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        {paid.map((code) => {
          const p = PLANS[code];
          const isCurrent = code === learner.plan;
          const upgrade = p.priceInr > current.priceInr;
          const { due } = prorate(learner.plan, code, learner.passEnds);
          return (
            <li
              key={code}
              className={`flex flex-col overflow-hidden rounded-card-lg border border-line bg-surface ${p.recommended ? "shadow-brutal-lg lg:-translate-y-2" : "shadow-brutal"}`}
            >
              {p.recommended ? (
                <p className="border-b-2 border-line bg-primary py-2 text-center text-xs font-bold uppercase tracking-wide text-on-primary">Recommended for most students</p>
              ) : null}
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl text-ink">{p.name}</h2>
                  {isCurrent ? <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink">Your plan</span> : null}
                </div>
                <p className="mt-3">
                  <span className="font-display text-4xl tabular-nums text-ink">₹{p.priceInr}</span>
                  <span className="text-sm text-muted"> / 30 days</span>
                </p>
                <p className="mt-2 text-sm text-muted">{p.summary}</p>
                <ul className="mt-4 flex flex-col gap-2.5 border-t border-border-subtle pt-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm text-ink">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <span className="mt-5 flex h-11 w-full items-center justify-center rounded-btn border-2 border-border-subtle text-[15px] font-semibold text-muted">
                      Current plan
                    </span>
                  ) : upgrade ? (
                    <>
                      <PurchaseButton item={passItem(code, learner.plan, learner.passEnds)} label="Upgrade" variant={p.recommended ? "primary" : "secondary"} className="mt-5 w-full" />
                      <p className="mt-2 text-center text-xs text-muted">₹{due} today after your unused days. New 30-day pass starts now.</p>
                    </>
                  ) : (
                    <SwitchButton planName={p.name} startsOn={learner.passEnds} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">Passes don&apos;t renew unless auto-renew is turned on at checkout. Prices in INR.</p>
    </div>
  );
}
