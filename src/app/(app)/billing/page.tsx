import type { Metadata } from "next";
import { PLANS } from "@/lib/config";
import { TODAY, learner, payments } from "@/lib/data";
import { daysBetween, dayMonth, shortDate } from "@/lib/format";
import { ButtonLink, Card, CardHeader } from "@/components/ui";
import { RefundRequest, RenewalControl } from "@/components/billing";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Billing" };

/** Billing — Web App Structure §8.15, decision D6. */
export default function BillingPage() {
  const plan = PLANS[learner.plan];
  const first = payments[0].date;
  const start = "2026-09-19";
  const refundUntil = new Date(new Date(`${first}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const inWindow = daysBetween(TODAY, refundUntil) >= 0;
  const endsSoon = daysBetween(TODAY, learner.passEnds) <= 3;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card level="primary" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="plan-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-h" className="font-display text-2xl text-ink">
            {plan.name}
          </h2>
          <span className="rounded-full border border-success/35 bg-success/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-success-text">
            {endsSoon ? "Ends soon" : "Active"}
          </span>
        </div>
        <p className="mt-1 text-[15px] text-muted">
          ₹{plan.priceInr} · 30-day pass · {dayMonth(start)} – {dayMonth(learner.passEnds)}
        </p>
        <p className="mt-4 text-[15px] text-ink">{plan.periodCredits} credits a day, refilled at 00:00 IST.</p>
        <div className="mt-5 border-t border-border-subtle pt-4">
          <RenewalControl />
        </div>
        <ButtonLink href="/billing/plans" className="mt-5">
          Change plan
        </ButtonLink>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-5" aria-labelledby="refund-h">
        <CardHeader id="refund-h" title="Refunds" />
        {inWindow ? (
          <>
            <p className="mt-3 text-sm text-ink">
              You can request a full refund until {shortDate(refundUntil)} because you&apos;ve used under 20% of this cycle&apos;s credits.
            </p>
            <div className="mt-4">
              <RefundRequest lastDay={shortDate(refundUntil)} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink">
            The 7-day refund window for this pass closed on {shortDate(refundUntil)}. If something didn&apos;t work on our side, email us and we&apos;ll refund it regardless.
          </p>
        )}
        <a href={siteUrl("/refunds")} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          Refund policy
        </a>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="pay-h">
        <CardHeader id="pay-h" title="Payments" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <caption className="sr-only">Payment history</caption>
            <thead>
              <tr className="border-b border-border-subtle text-xs text-muted">
                <th scope="col" className="py-2 font-semibold">Date</th>
                <th scope="col" className="py-2 font-semibold">Item</th>
                <th scope="col" className="py-2 text-right font-semibold">Amount</th>
                <th scope="col" className="py-2 text-right font-semibold">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 tabular-nums text-muted">{dayMonth(p.date)}</td>
                  <td className="py-3 text-ink">
                    {p.item} <span className="ml-1 text-xs font-semibold text-success-text">{p.status}</span>
                  </td>
                  <td className="py-3 text-right font-semibold tabular-nums text-ink">₹{p.amount}</td>
                  <td className="py-3 text-right">
                    <button type="button" className="text-sm font-semibold text-primary-text underline underline-offset-4">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
