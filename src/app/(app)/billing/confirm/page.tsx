import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_PACKS, PLANS, type PlanCode } from "@/lib/config";
import { PaymentStatus } from "@/components/billing";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Confirming payment" };

/**
 * Razorpay return page (Web App Structure §8.15). Never shows success until the
 * signed webhook has landed; in production `PaymentStatus` polls the order.
 */
export default async function ConfirmPage(props: PageProps<"/billing/confirm">) {
  const q = await props.searchParams;
  const item = String(q.item ?? "");
  const sim = q.sim === "failed" || q.sim === "slow" ? q.sim : "ok";
  const plan = PLANS[item as PlanCode];
  const pack = CREDIT_PACKS.find((p) => p.id === item);

  if (!plan && !pack) {
    return (
      <Card level="supporting" className="mx-auto max-w-[560px] p-6">
        <h2 className="text-lg font-semibold text-ink">No payment to confirm</h2>
        <p className="mt-1 text-[15px] text-muted">This page opens after checkout. Your plan and credits are on the Billing page.</p>
        <Link href="/billing" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          Go to billing
        </Link>
      </Card>
    );
  }

  const renew = q.renew === "1";
  const steps = ["Payment received by Razorpay", "Confirming with our server", plan ? "Starting your pass" : "Adding your credits"];
  const confirmed = plan
    ? {
        title: `You're on ${plan.name}`,
        body: `${plan.periodCredits} credits a day, refilled at 00:00 IST.${renew ? " Auto-renew is on; we'll email you 3 days before each charge." : " It doesn't renew unless you turn on auto-renew."}`,
      }
    : { title: `${pack!.credits} credits added`, body: "They last 90 days and are used after your daily and promotional credits." };

  return (
    <div className="mx-auto max-w-[560px]">
      <Card level="structural" className="p-6 sm:p-8">
        <PaymentStatus key={sim} steps={steps} confirmed={confirmed} done={{ href: "/dashboard", label: "Go to home" }} retryHref={plan ? "/billing/plans" : "/credits/buy"} sim={sim} />
      </Card>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-4 text-xs text-muted">
          Preview: <Link href={`/billing/confirm?item=${item}&sim=failed`} className="underline underline-offset-4">failed payment</Link> ·{" "}
          <Link href={`/billing/confirm?item=${item}&sim=slow`} className="underline underline-offset-4">slow webhook</Link>
        </p>
      ) : null}
    </div>
  );
}
