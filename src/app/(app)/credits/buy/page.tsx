import type { Metadata } from "next";
import { CREDIT_PACKS } from "@/lib/config";
import { PackButton } from "@/components/billing";

export const metadata: Metadata = { title: "Get credits" };

/** Credit packs — any plan, 90-day validity (CONTEXT §0.1). */
export default function BuyCreditsPage() {
  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[15px] text-muted">Packs last 90 days and are used after your daily and promotional credits, so they don&apos;t get wasted.</p>
      <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((p) => (
          <li
            key={p.id}
            className={`flex flex-col bg-surface p-5 ${"bestValue" in p && p.bestValue ? "rounded-card-lg border-2 border-line shadow-brutal" : "rounded-card border border-border-subtle"}`}
          >
            {"bestValue" in p && p.bestValue ? (
              <span className="self-start rounded-full border border-line bg-primary/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">Best value</span>
            ) : null}
            <p className="mt-3 font-display text-4xl leading-none tabular-nums text-ink">{p.credits}</p>
            <p className="mt-1 text-sm text-muted">credits · 90 days</p>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-ink">₹{p.priceInr}</p>
            <p className="text-xs text-muted">₹{(p.priceInr / p.credits).toFixed(2)} per credit</p>
            <PackButton label={`Buy ${p.credits} credits`} amount={p.priceInr} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">A pass is cheaper per credit if you study most days. Payments by UPI, card, net banking or wallet through Razorpay.</p>
    </div>
  );
}
