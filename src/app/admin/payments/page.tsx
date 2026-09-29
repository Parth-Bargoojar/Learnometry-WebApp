import type { Metadata } from "next";
import Link from "next/link";
import { stamp } from "@/lib/admin";
import { PLANS } from "@/lib/config";
import { adminLearnerById, adminPayments, adminSubscriptions } from "@/lib/admin-data";
import { fullDate, inr } from "@/lib/format";
import { AdminHeader, Mono, Pill, TabLinks, TablePanel, num, td, th } from "@/components/admin-ui";
import { CouponTable, RefundQueue, WebhookTable } from "@/components/admin-ops";

export const metadata: Metadata = { title: "Payments" };

const TABS = [
  { key: "payments", label: "Payments" },
  { key: "subscriptions", label: "Passes" },
  { key: "refunds", label: "Refunds" },
  { key: "webhooks", label: "Webhooks" },
  { key: "coupons", label: "Coupons" },
] as const;

const PAY_TONE = { captured: "success", failed: "danger", refunded: "neutral" } as const;
const PAY_LABEL = { captured: "Paid", failed: "Failed", refunded: "Refunded" } as const;
const SUB_TONE = { active: "success", renewal_failed: "danger", cancelled: "neutral", expired: "neutral", refunded: "neutral" } as const;

const name = (id: string) => {
  const l = adminLearnerById(id);
  return l ? `${l.firstName} ${l.lastName}` : id;
};

/** Credit/payment console — §8.19 plus the refund queue (PRD §4.24, K5). Tabs in the URL. */
export default async function AdminPaymentsPage(props: PageProps<"/admin/payments">) {
  const { tab: raw } = await props.searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "payments";

  return (
    <div>
      <AdminHeader title="Payments" meta="Razorpay is the source of truth; these tables mirror its webhooks." />
      <TabLinks
        label="Payments"
        active={tab}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "payments" ? "/admin/payments" : `/admin/payments?tab=${t.key}` }))}
      />

      {tab === "payments" ? (
        <TablePanel caption="Payments" footer="Amounts are after coupons. Minors' passes are paid by the guardian (D5).">
          <thead>
            <tr>
              <th scope="col" className={th}>When (IST)</th>
              <th scope="col" className={th}>Learner</th>
              <th scope="col" className={th}>Item</th>
              <th scope="col" className={th}>Payer</th>
              <th scope="col" className={th}>Razorpay ID</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} ${num}`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {adminPayments.map((p) => (
              <tr key={p.id}>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(p.at)}</td>
                <td className={td}>
                  <Link href={`/admin/learners/${p.learnerId}?tab=subscription`} className="underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                    {name(p.learnerId)}
                  </Link>
                </td>
                <td className={td}>
                  {p.item}
                  {p.coupon ? <span className="block text-xs text-muted">{p.coupon}</span> : null}
                </td>
                <td className={td}>{p.payer}</td>
                <td className={td}>
                  <Mono>{p.providerId}</Mono>
                </td>
                <td className={td}>
                  <Pill tone={PAY_TONE[p.status]}>{PAY_LABEL[p.status]}</Pill>
                </td>
                <td className={`${td} ${num}`}>{inr(p.amountInr)}</td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      ) : null}

      {tab === "subscriptions" ? (
        <TablePanel caption="Passes" footer="A pass is a one-time Razorpay order; auto-renew is an opt-in e-mandate held by the payer (B3).">
          <thead>
            <tr>
              <th scope="col" className={th}>Learner</th>
              <th scope="col" className={th}>Plan</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>Current pass ends</th>
              <th scope="col" className={th}>Auto-renew</th>
              <th scope="col" className={th}>Payer</th>
              <th scope="col" className={th}>Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {adminSubscriptions.map((s) => (
              <tr key={s.learnerId}>
                <td className={td}>
                  <Link href={`/admin/learners/${s.learnerId}?tab=subscription`} className="underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                    {name(s.learnerId)}
                  </Link>
                </td>
                <td className={td}>{PLANS[s.plan].name}</td>
                <td className={td}>
                  <Pill tone={SUB_TONE[s.status]}>
                    <span className="capitalize">{s.status.replace("_", " ")}</span>
                  </Pill>
                </td>
                <td className={`${td} tabular-nums`}>{fullDate(s.periodEnd)}</td>
                <td className={td}>{s.autoRenew ? "On" : "Off"}</td>
                <td className={td}>{s.payer}</td>
                <td className={`${td} text-muted`}>{s.scheduled ? `Switch to ${PLANS[s.scheduled].name}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      ) : null}

      {tab === "refunds" ? (
        <>
          <p className="mb-4 max-w-3xl text-sm text-muted">
            Policy: within 7 days of the first payment and under 20% of the allowance used. Decide within 48 hours; approved refunds reach the payer in 5–7 business days. Out-of-policy approvals are
            exceptions (for example a service failure) and need a reason.
          </p>
          <RefundQueue />
        </>
      ) : null}

      {tab === "webhooks" ? <WebhookTable /> : null}
      {tab === "coupons" ? <CouponTable /> : null}
    </div>
  );
}
