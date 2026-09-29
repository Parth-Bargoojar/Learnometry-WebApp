import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PLANS } from "@/lib/config";
import { cycleUsage, learner, passStarted, payments } from "@/lib/data";
import { GSTIN, PASS_STATUS_LABEL, passItem, passStatus, refundWindow, type PassStatus } from "@/lib/billing";
import { dayMonth, shortDate } from "@/lib/format";
import { ButtonLink, Card, CardHeader } from "@/components/ui";
import { GuardianRequests, PurchaseButton, RefundRequest, RenewalControl } from "@/components/billing";
import { needsApproval } from "@/lib/guardian";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Billing" };

const STATUS_CLS: Record<PassStatus, string> = {
  active: "border-success/35 bg-success/10 text-success-text",
  ends_soon: "border-warning/50 bg-warning/15 text-warning-text",
  renewal_failed: "border-danger/35 bg-danger/10 text-danger-text",
  ended: "border-border-subtle bg-sunken text-muted",
};

/** Billing — Web App Structure §8.15, decisions D5 and D6. */
export default function BillingPage() {
  const plan = PLANS[learner.plan];
  const status = passStatus(learner.passEnds);
  const refund = refundWindow(payments[0].date, cycleUsage.used / cycleUsage.issued);
  const canRenewNow = !learner.autoRenew && (status === "ends_soon" || status === "ended");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card level="primary" className="p-5 sm:p-6 lg:col-span-7" aria-labelledby="plan-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-h" className="font-display text-2xl text-ink">
            {plan.name}
          </h2>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_CLS[status]}`}>{PASS_STATUS_LABEL[status]}</span>
        </div>
        <p className="mt-1 text-[15px] text-muted">
          ₹{plan.priceInr} · 30-day pass · {dayMonth(passStarted)} – {dayMonth(learner.passEnds)}
        </p>
        <p className="mt-4 text-[15px] text-ink">{plan.periodCredits} credits a day, refilled at 00:00 IST.</p>
        <div className="mt-5 border-t border-border-subtle pt-4">
          <RenewalControl />
        </div>
        <div className="mt-5 flex flex-wrap items-start gap-3">
          {canRenewNow ? <PurchaseButton item={passItem(learner.plan, "free", learner.passEnds)} label="Renew now" variant="primary" /> : null}
          <ButtonLink href="/billing/plans" variant={canRenewNow ? "secondary" : "primary"}>
            Change plan
          </ButtonLink>
        </div>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6 lg:col-span-5" aria-labelledby="refund-h">
        <CardHeader id="refund-h" title="Refunds" />
        {refund.eligible ? (
          <>
            <p className="mt-3 text-sm text-ink">
              Full refund available until {shortDate(refund.until)}.
            </p>
            <div className="mt-4">
              <RefundRequest lastDay={shortDate(refund.until)} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink">
            {refund.inTime
              ? "This pass can't be refunded because more than 20% of its credits have been used."
              : `The 7-day refund window for this pass closed on ${shortDate(refund.until)}.`}{" "}
            If something didn&apos;t work on our side, email us and we&apos;ll refund it regardless.
          </p>
        )}
        <a href={siteUrl("/refunds")} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          Refund policy
        </a>
      </Card>

      {needsApproval ? (
        <Card level="supporting" className="p-5 sm:p-6 lg:col-span-12" aria-labelledby="appr-h">
          <CardHeader id="appr-h" title="Guardian approvals" />
          <GuardianRequests />
        </Card>
      ) : null}

      <Card level="supporting" className="min-w-0 p-5 sm:p-6 lg:col-span-12" aria-labelledby="pay-h">
        <CardHeader id="pay-h" title="Payments" />
        {/* < 640px: stacked list (§7.8); tables only where they fit. */}
        <ul className="mt-3 divide-y divide-border-subtle sm:hidden">
          {payments.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[15px] text-ink">{p.item}</p>
                <p className="shrink-0 font-semibold tabular-nums text-ink">₹{p.amount}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {dayMonth(p.date)} · <span className="font-semibold text-success-text">{p.status}</span>
                {p.paidBy ? ` · paid by ${p.paidBy}` : null}
              </p>
              <button type="button" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4">
                <Download aria-hidden="true" className="size-4" />
                Download {GSTIN ? "tax invoice" : "receipt"}
              </button>
            </li>
          ))}
        </ul>
        <div role="region" aria-label="Payment history" tabIndex={0} className="relative mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <caption className="sr-only">Payment history</caption>
            <thead>
              <tr className="border-b border-border-subtle text-xs text-muted">
                <th scope="col" className="py-2 font-semibold">Date</th>
                <th scope="col" className="py-2 font-semibold">Item</th>
                <th scope="col" className="py-2 text-right font-semibold">Amount</th>
                <th scope="col" className="py-2 text-right font-semibold">{GSTIN ? "Tax invoice" : "Receipt"}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="py-3 tabular-nums text-muted">{dayMonth(p.date)}</td>
                  <td className="py-3 text-ink">
                    {p.item}
                    <span className="block text-xs text-muted">
                      <span className="font-semibold text-success-text">{p.status}</span>
                      {p.paidBy ? ` · paid by ${p.paidBy}` : null}
                    </span>
                  </td>
                  <td className="py-3 text-right font-semibold tabular-nums text-ink">₹{p.amount}</td>
                  <td className="py-3 text-right">
                    <button type="button" className="inline-flex min-h-9 touch:min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4">
                      <Download aria-hidden="true" className="size-4" />
                      Download<span className="sr-only"> {GSTIN ? "tax invoice" : "receipt"} for {p.item}</span>
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
