import type { Metadata } from "next";
import { CREDIT_PACKS, PLANS } from "@/lib/config";
import { learner } from "@/lib/data";
import { packItem } from "@/lib/billing";
import { PurchaseButton } from "@/components/billing";
import { needsApproval } from "@/lib/guardian";
import { TextLink } from "@/components/ui";

export const metadata: Metadata = { title: "Get credits" };

/** Credit packs — any plan, 90-day validity (CONTEXT §0.1, Web App Structure §8.14). */
export default function BuyCreditsPage() {
  const plan = PLANS[learner.plan];
  const refill = plan.period === "daily" ? `Your plan credits refill to ${plan.periodCredits} at 00:00 IST.` : "Your free credits refill on the 1st of the month.";
  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[15px] text-ink">{refill}</p>
      <p className="mt-1 text-[15px] text-muted">
        Need more before then? Packs last 90 days and are used after your daily and promotional credits, so they don&apos;t get wasted.
        {needsApproval && learner.guardian ? ` ${learner.guardian.guardianFirstName} approves and pays for packs.` : null}
      </p>
      <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((p) => {
          const best = "bestValue" in p && p.bestValue;
          return (
            <li key={p.id} className={`flex flex-col bg-surface p-5 ${best ? "rounded-card-lg border-2 border-line shadow-brutal" : "rounded-card border border-border-subtle"}`}>
              {best ? (
                <span className="self-start rounded-full border border-line bg-primary/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">Best value</span>
              ) : null}
              <p className="mt-3 font-display text-4xl leading-none tabular-nums text-ink">{p.credits}</p>
              <p className="mt-1 text-sm text-muted">credits · 90 days</p>
              <p className="mt-4 text-2xl font-semibold tabular-nums text-ink">₹{p.priceInr}</p>
              <p className="text-xs text-muted">₹{(p.priceInr / p.credits).toFixed(2)} per credit</p>
              <div className="mt-auto pt-5">
                <PurchaseButton item={packItem(p.id)} label={`Buy ${p.credits} credits`} variant={best ? "primary" : "secondary"} className="w-full" />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted">
        A pass is cheaper per credit if you study most days. <TextLink href="/billing/plans">Compare plans</TextLink>
      </p>
    </div>
  );
}
