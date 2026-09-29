import type { Metadata } from "next";
import Link from "next/link";
import { GuardianPaymentConfirm } from "@/components/guardian";

export const metadata: Metadata = { title: "Confirming payment" };

/** Razorpay return for guardian-paid purchases (§8.15 confirmation rules, §8.18). */
export default async function GuardianConfirmPage(props: PageProps<"/guardian/confirm">) {
  const q = await props.searchParams;
  const request = String(q.request ?? "");
  const sim = q.sim === "failed" || q.sim === "slow" ? q.sim : "ok";
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5">
      <h1 tabIndex={-1} className="font-display text-3xl text-ink outline-none">
        Payment
      </h1>
      <GuardianPaymentConfirm requestId={request} sim={sim} />
      {process.env.NODE_ENV !== "production" ? (
        <p className="text-xs text-muted">
          Preview: <Link href={`/guardian/confirm?request=${request}&sim=failed`} className="underline underline-offset-4">failed payment</Link> ·{" "}
          <Link href={`/guardian/confirm?request=${request}&sim=slow`} className="underline underline-offset-4">slow webhook</Link>
        </p>
      ) : null}
    </div>
  );
}
