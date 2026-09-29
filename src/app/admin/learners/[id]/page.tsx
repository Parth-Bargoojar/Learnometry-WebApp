import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { stamp } from "@/lib/admin";
import { PLANS } from "@/lib/config";
import {
  adminLearnerById,
  adminPayments,
  adminRefunds,
  adminSubscriptions,
  attemptsFor,
  diagnosesFor,
  ledgerFor,
} from "@/lib/admin-data";
import { ageOn, isMinor, maskContact } from "@/lib/guardian";
import { dayMonth, duration, fullDate, inr } from "@/lib/format";
import { AdminHeader, Mono, Panel, Pill, TabLinks, TablePanel, num, td, th } from "@/components/admin-ui";
import { AccountStatusPill, CreditLedger, LogView, SuspensionControl, TimerAccommodation } from "@/components/admin-learner";
import { AuditTable } from "@/components/admin-ops";

export async function generateMetadata(props: PageProps<"/admin/learners/[id]">): Promise<Metadata> {
  const l = adminLearnerById((await props.params).id);
  return { title: l ? `${l.firstName} ${l.lastName}` : "Learner" };
}

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "subscription", label: "Subscription" },
  { key: "credits", label: "Credit ledger" },
  { key: "attempts", label: "Attempts" },
  { key: "diagnoses", label: "Diagnoses" },
  { key: "audit", label: "Audit log" },
] as const;

/** Learner detail — §8.19. Tabs in the URL; opening the record is audit-logged (K2). */
export default async function AdminLearnerPage(props: PageProps<"/admin/learners/[id]">) {
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const l = adminLearnerById(id);
  if (!l) notFound();
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "profile";
  const minor = isMinor(l.dateOfBirth);

  return (
    <div>
      <LogView learnerId={l.id} name={`${l.firstName} ${l.lastName}`} />
      <Link href="/admin/learners" className="mb-2 inline-flex h-9 items-center text-sm font-semibold text-muted hover:text-ink">
        ← Learners
      </Link>
      <AdminHeader
        title={`${l.firstName} ${l.lastName}`}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{l.email}</span>
            <Mono>{l.id}</Mono>
            <AccountStatusPill learner={l} />
            {minor ? <Pill tone="info">Minor · age {ageOn(l.dateOfBirth)}</Pill> : null}
          </span>
        }
        action={<SuspensionControl learner={l} />}
      />
      <TabLinks
        label="Learner record"
        active={tab}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/learners/${l.id}${t.key === "profile" ? "" : `?tab=${t.key}`}` }))}
      />

      {tab === "profile" ? (
        <div className="grid grid-cols-12 gap-6">
          <Panel title="Account" className="col-span-12 xl:col-span-7">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Row label="Exam track">{l.exam}</Row>
              <Row label="Class">{l.className}</Row>
              <Row label="Age">
                {ageOn(l.dateOfBirth)}
                {minor ? " (minor)" : ""}
              </Row>
              <Row label="Joined">{fullDate(l.joined)}</Row>
              <Row label="Last active">{l.lastActive ? `${stamp(l.lastActive)} IST` : "Never signed in"}</Row>
              <Row label="Plan">{PLANS[l.plan].name}</Row>
            </dl>
            <div className="mt-6 border-t border-border-subtle pt-5">
              <TimerAccommodation learner={l} />
            </div>
          </Panel>
          <Panel title="Guardian" className="col-span-12 xl:col-span-5">
            {l.guardian ? (
              <dl className="grid grid-cols-1 gap-y-4 text-sm">
                <Row label="Name">{l.guardian.name}</Row>
                <Row label="Contact">{maskContact(l.guardian.contact)}</Row>
                <Row label="Consent">
                  <Pill tone={l.guardian.consent === "verified" ? "success" : "warning"}>{l.guardian.consent === "verified" ? "Verified" : "Waiting"}</Pill>
                </Row>
              </dl>
            ) : (
              <p className="text-sm text-muted">{minor ? "No guardian linked. A minor can't use the app until consent is verified." : "Adult learner; no guardian linked."}</p>
            )}
            <p className="mt-4 text-xs text-muted">The console masks contacts and never shows a date of birth, only the age (K3).</p>
          </Panel>
        </div>
      ) : null}

      {tab === "subscription" ? <SubscriptionTab id={l.id} /> : null}
      {tab === "credits" ? <CreditLedger learner={l} rows={ledgerFor(l.id)} /> : null}
      {tab === "attempts" ? <AttemptsTab id={l.id} /> : null}
      {tab === "diagnoses" ? <DiagnosesTab id={l.id} /> : null}
      {tab === "audit" ? <AuditTable resourceId={l.id} /> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

const PAY_LABEL = { captured: "Paid", failed: "Failed", refunded: "Refunded" } as const;
const PAY_TONE = { captured: "success", failed: "danger", refunded: "neutral" } as const;

function SubscriptionTab({ id }: { id: string }) {
  const sub = adminSubscriptions.find((s) => s.learnerId === id);
  const pays = adminPayments.filter((p) => p.learnerId === id);
  const refunds = adminRefunds.filter((r) => r.learnerId === id);
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Pass">
        {sub ? (
          <dl className="grid grid-cols-5 gap-4 text-sm">
            <Row label="Plan">{PLANS[sub.plan].name}</Row>
            <Row label="Status">
              <span className="capitalize">{sub.status.replace("_", " ")}</span>
            </Row>
            <Row label="Current pass ends">{fullDate(sub.periodEnd)}</Row>
            <Row label="Auto-renew">{sub.autoRenew ? "On" : "Off"}</Row>
            <Row label="Paid by">{sub.payer}</Row>
            {sub.scheduled ? <Row label="Scheduled">Switches to {PLANS[sub.scheduled].name} when the pass ends</Row> : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">Free plan. No pass bought yet.</p>
        )}
      </Panel>
      {pays.length ? (
        <TablePanel caption="Payments">
          <thead>
            <tr>
              <th scope="col" className={th}>When (IST)</th>
              <th scope="col" className={th}>Item</th>
              <th scope="col" className={th}>Payer</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} ${num}`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {pays.map((p) => (
              <tr key={p.id}>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(p.at)}</td>
                <td className={td}>
                  {p.item}
                  {p.coupon ? <span className="block text-xs text-muted">{p.coupon}</span> : null}
                </td>
                <td className={td}>{p.payer}</td>
                <td className={td}>
                  <Pill tone={PAY_TONE[p.status]}>{PAY_LABEL[p.status]}</Pill>
                </td>
                <td className={`${td} ${num}`}>{inr(p.amountInr)}</td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      ) : null}
      {refunds.length ? (
        <p className="text-sm text-muted">
          Refund requests: {refunds.map((r) => `${dayMonth(r.requestedAt.slice(0, 10))} (${r.status})`).join(", ")}.{" "}
          <Link href="/admin/payments?tab=refunds" className="font-semibold text-primary-text underline underline-offset-4">
            Open the refund queue
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function AttemptsTab({ id }: { id: string }) {
  const rows = attemptsFor(id);
  if (!rows.length) return <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">No attempts yet.</p>;
  return (
    <TablePanel caption="Attempts">
      <thead>
        <tr>
          <th scope="col" className={th}>Date</th>
          <th scope="col" className={th}>Type</th>
          <th scope="col" className={th}>Title</th>
          <th scope="col" className={th}>Attempt</th>
          <th scope="col" className={`${th} ${num}`}>Result</th>
          <th scope="col" className={`${th} ${num}`}>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className={`${td} tabular-nums`}>{dayMonth(a.date)}</td>
            <td className={`${td} capitalize`}>{a.kind}</td>
            <td className={td}>{a.title}</td>
            <td className={td}>
              <Mono>{a.id}</Mono>
            </td>
            <td className={`${td} ${num}`}>{a.result}</td>
            <td className={`${td} ${num}`}>{a.pct}%</td>
          </tr>
        ))}
      </tbody>
    </TablePanel>
  );
}

const DX_LABEL = { succeeded: "Succeeded", fallback: "Fallback", failed: "Failed" } as const;
const DX_TONE = { succeeded: "success", fallback: "warning", failed: "danger" } as const;

function DiagnosesTab({ id }: { id: string }) {
  const rows = diagnosesFor(id);
  if (!rows.length) return <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">No diagnoses yet.</p>;
  return (
    <TablePanel caption="Diagnoses" footer="Model names are aliases until the benchmark gate (G6) fixes vendors. Learners never see them.">
      <thead>
        <tr>
          <th scope="col" className={th}>When (IST)</th>
          <th scope="col" className={th}>Type</th>
          <th scope="col" className={th}>Attempt</th>
          <th scope="col" className={th}>Tier · model</th>
          <th scope="col" className={th}>Prompt</th>
          <th scope="col" className={th}>Schema</th>
          <th scope="col" className={`${th} ${num}`}>Concepts</th>
          <th scope="col" className={`${th} ${num}`}>Latency</th>
          <th scope="col" className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id}>
            <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(d.at)}</td>
            <td className={`${td} capitalize`}>{d.kind}</td>
            <td className={td}>
              <Mono>{d.attemptId}</Mono>
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {d.tier} · <Mono>{d.model}</Mono>
            </td>
            <td className={td}>
              <Mono>{d.promptVersion}</Mono>
            </td>
            <td className={td}>
              <Mono>{d.schemaVersion}</Mono>
            </td>
            <td className={`${td} ${num}`}>{d.concepts}</td>
            <td className={`${td} ${num}`}>{duration(d.latencyMs / 1000)}</td>
            <td className={td}>
              <Pill tone={DX_TONE[d.status]}>{DX_LABEL[d.status]}</Pill>
            </td>
          </tr>
        ))}
      </tbody>
    </TablePanel>
  );
}
