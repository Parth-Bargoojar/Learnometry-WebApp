"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleCheck, RotateCcw, ShieldCheck, UserCheck } from "lucide-react";
import { PLANS, type PlanCode } from "@/lib/config";
import { TODAY, consentRecords, guardianAccount, guardianLearners, learner } from "@/lib/data";
import { packItem, passItem, type CheckoutItem } from "@/lib/billing";
import { CONSENT, addBusinessDays, maskContact } from "@/lib/guardian";
import { SHARED, useShared } from "@/lib/local-store";
import { usePurchaseRequests } from "@/lib/requests";
import { dayMonth, fullDate } from "@/lib/format";
import type { PurchaseRequest } from "@/lib/types";
import { CheckoutDialog, PaymentStatus, RequestStatus } from "./billing";
import { useCountdown } from "./auth-recovery";
import { Dialog } from "./dialog";
import { Card, CardHeader, btn } from "./ui";

/*
  Guardian portal interactions — Web App Structure §8.18, decision D5.
  Guardians approve and pay for every purchase by a minor, and can withdraw consent
  as easily as they gave it (one confirmation, no typed text, no reason required).
*/

const learnerName = (id: string) => guardianLearners.find((l) => l.id === id)?.firstName ?? "Your child";

function itemFor(r: PurchaseRequest): CheckoutItem {
  return r.itemType === "credit_pack" ? packItem(r.itemCode) : passItem(r.itemCode as PlanCode, learner.plan, learner.passEnds);
}

/* ---------- Overview: requests waiting ---------- */

export function PendingApprovalsBanner() {
  const { list } = usePurchaseRequests();
  const waiting = list.filter((r) => r.status === "requested");
  if (!waiting.length) return null;
  const r = waiting[0];
  return (
    <section aria-labelledby="pending-h" className="rounded-card-lg border-2 border-line bg-surface p-5 shadow-brutal-lg sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-card-sm border-2 border-line bg-warning/20">
            <UserCheck aria-hidden="true" className="size-5 text-ink" />
          </span>
          <div>
            <h2 id="pending-h" className="text-lg font-semibold text-ink">
              {waiting.length === 1 ? `${learnerName(r.learnerId)} is asking for ${r.label}` : `${waiting.length} requests are waiting for you`}
            </h2>
            <p className="mt-0.5 text-[15px] text-muted">
              {waiting.length === 1 ? `₹${r.amountInr} · asked ${dayMonth(r.requestedOn)} · expires ${dayMonth(r.expiresOn)}` : "Each one expires 7 days after it was sent."}
            </p>
          </div>
        </div>
        <Link href="/guardian/approvals" className={btn("primary", "md", "shrink-0")}>
          Review {waiting.length === 1 ? "request" : "requests"} <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </section>
  );
}

export function ApprovalsCount() {
  const { list } = usePurchaseRequests();
  const n = list.filter((r) => r.status === "requested").length;
  return <>{n ? `${n} waiting for you` : "Nothing waiting"}</>;
}

export function ResendInvite({ to }: { to: string }) {
  const { left, start } = useCountdown(CONSENT.resendSeconds);
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={left > 0}
        onClick={() => {
          setSent(true);
          start();
        }}
        className={btn("secondary", "sm")}
      >
        {left > 0 ? `Resend in ${left}s` : "Resend invite"}
      </button>
      <p role="status" className="text-sm text-muted">
        {sent ? `Sent again to ${maskContact(to)}. It works for 7 more days.` : null}
      </p>
    </div>
  );
}

/* ---------- Approvals page ---------- */

export function GuardianApprovals() {
  const { list, setStatus, reopen } = usePurchaseRequests();
  const [paying, setPaying] = useState<PurchaseRequest | null>(null);
  const [declined, setDeclined] = useState<string | null>(null);
  const waiting = list.filter((r) => r.status === "requested");
  const history = list.filter((r) => r.status !== "requested");

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="waiting-h">
        <h2 id="waiting-h" className="text-lg font-semibold text-ink">
          Waiting for you
        </h2>
        {declined ? (
          <p role="status" className="mt-3 flex flex-wrap items-center gap-x-3 rounded-card-sm border border-border-subtle bg-sunken px-4 py-3 text-[15px] text-ink">
            Declined. We&apos;ve told {learnerName(list.find((r) => r.id === declined)?.learnerId ?? "")}.
            <button
              type="button"
              onClick={() => {
                reopen(declined);
                setDeclined(null);
              }}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Undo
            </button>
          </p>
        ) : null}
        {waiting.length ? (
          <ul className="mt-3 flex flex-col gap-4">
            {waiting.map((r) => {
              const name = learnerName(r.learnerId);
              const pass = r.itemType === "plan_pass";
              const plan = pass ? PLANS[r.itemCode as PlanCode] : null;
              return (
                <li key={r.id}>
                  <Card level="structural" as="article" className="p-5 sm:p-6" aria-labelledby={`${r.id}-h`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 id={`${r.id}-h`} className="text-lg font-semibold text-ink">
                          {name} wants {pass ? `the ${r.label}` : r.label}
                        </h3>
                        <p className="mt-0.5 text-[15px] text-muted">
                          Asked {dayMonth(r.requestedOn)} · expires {dayMonth(r.expiresOn)}
                        </p>
                      </div>
                      <p className="font-display text-3xl tabular-nums text-ink">₹{r.amountInr}</p>
                    </div>
                    <p className="mt-3 text-[15px] text-ink">
                      {plan
                        ? `${plan.periodCredits} credits a day for 30 days. ${name} uses credits for tests, practice sets and explanations; reading reports and the study plan is free.`
                        : `Credits for practice sets, retests and explanations. They last 90 days and are used after ${name}'s daily credits.`}
                    </p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => setPaying(r)} className={btn("primary")}>
                        Approve and pay ₹{r.amountInr}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatus(r.id, "declined");
                          setDeclined(r.id);
                        }}
                        className={btn("secondary")}
                      >
                        Decline
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-card border border-border-subtle bg-surface p-5 text-[15px] text-muted">
            Nothing is waiting. When {learner.firstName} asks for a pass or credits, it appears here and we email you.
          </p>
        )}
      </section>

      {history.length ? (
        <section aria-labelledby="history-h">
          <h2 id="history-h" className="text-lg font-semibold text-ink">
            Earlier requests
          </h2>
          <ul className="mt-3 divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">
                    {learnerName(r.learnerId)} · {r.label}
                  </span>
                  <span className="block text-sm text-muted">
                    ₹{r.amountInr} · asked {dayMonth(r.requestedOn)}
                    {r.decidedOn ? ` · ${dayMonth(r.decidedOn)}` : ""}
                  </span>
                </span>
                <RequestStatus value={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-muted">
        Until {learner.firstName} turns 18, every purchase needs your approval and your payment. Requests expire after 7 days if you don&apos;t answer.
      </p>

      {paying ? (
        <CheckoutDialog
          open
          onClose={() => setPaying(null)}
          item={itemFor(paying)}
          confirmPath="/guardian/confirm"
          payerNote={`You're paying for ${learnerName(paying.learnerId)}.`}
          extraParams={{ request: paying.id }}
        />
      ) : null}
    </div>
  );
}

/* ---------- Payment return for guardians ---------- */

export function GuardianPaymentConfirm({ requestId, sim }: { requestId: string; sim: "ok" | "failed" | "slow" }) {
  const { list, setStatus } = usePurchaseRequests();
  const r = list.find((x) => x.id === requestId);
  if (!r) {
    return (
      <Card level="supporting" className="p-6">
        <h2 className="text-lg font-semibold text-ink">No payment to confirm</h2>
        <p className="mt-1 text-[15px] text-muted">This page opens after checkout. Requests are on the Approvals page.</p>
        <Link href="/guardian/approvals" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          Go to approvals
        </Link>
      </Card>
    );
  }
  const name = learnerName(r.learnerId);
  const pass = r.itemType === "plan_pass";
  const plan = pass ? PLANS[r.itemCode as PlanCode] : null;
  return (
    <Card level="structural" className="p-6 sm:p-8">
      <PaymentStatus
        key={sim}
        sim={sim}
        steps={["Payment received by Razorpay", "Confirming with our server", pass ? `Starting ${name}'s pass` : `Adding ${name}'s credits`]}
        confirmed={{
          title: "Paid. Thank you.",
          body: plan ? `${name} is on ${plan.name} now: ${plan.periodCredits} credits a day for 30 days. We've told ${name}.` : `${r.label} added to ${name}'s account. We've told ${name}.`,
        }}
        done={{ href: "/guardian", label: "Back to overview" }}
        retryHref="/guardian/approvals"
        onConfirmed={() => setStatus(r.id, "paid")}
      />
    </Card>
  );
}

/* ---------- Settings: consent record, withdrawal, account ---------- */

type ConsentOverrides = Record<string, { status: "withdrawn"; on: string }>;
const NO_OVERRIDES: ConsentOverrides = {};

export function GuardianSettings() {
  const [overrides, setOverrides] = useShared<ConsentOverrides>(SHARED.guardianConsent, NO_OVERRIDES);
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmingName = confirming ? learnerName(confirming) : "";

  return (
    <div className="flex flex-col gap-5">
      {consentRecords.map((c) => {
        const name = learnerName(c.learnerId);
        const withdrawn = overrides[c.learnerId];
        return (
          <Card key={c.learnerId} level="supporting" className="p-5 sm:p-6" aria-labelledby={`${c.learnerId}-h`}>
            <CardHeader id={`${c.learnerId}-h`} title={`Consent for ${name}`} />
            {withdrawn ? (
              <div role="status" className="mt-4 rounded-card-sm border border-border-subtle bg-sunken p-4 text-[15px] text-ink">
                <p className="font-semibold">Consent withdrawn on {fullDate(withdrawn.on)}.</p>
                <p className="mt-1 text-muted">
                  We stopped using {name}&apos;s data and closed the account. Everything is deleted by{" "}
                  {fullDate(addBusinessDays(withdrawn.on, CONSENT.deletionBusinessDays))}, except payment records that tax law requires us to keep.
                </p>
              </div>
            ) : (
              <>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted">Status</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-success-text">
                      <ShieldCheck aria-hidden="true" className="size-4" /> Given
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">Date</dt>
                    <dd className="mt-0.5 text-ink">{fullDate(c.givenOn)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">How you confirmed</dt>
                    <dd className="mt-0.5 text-ink">{c.method}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">Policy version</dt>
                    <dd className="mt-0.5 text-ink">{c.policyVersion}</dd>
                  </div>
                </dl>
                <div className="mt-6 rounded-card-sm border border-danger/35 p-4">
                  <p className="font-semibold text-ink">Withdraw consent</p>
                  <p className="mt-1 text-sm text-muted">
                    {name}&apos;s account stops working at once, and {name}&apos;s profile, tests and plan are deleted within {CONSENT.deletionBusinessDays} business days.
                  </p>
                  <button type="button" onClick={() => setConfirming(c.learnerId)} className={btn("destructive", "md", "mt-4")}>
                    Withdraw consent
                  </button>
                </div>
              </>
            )}
          </Card>
        );
      })}

      <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="acct-h">
        <CardHeader id="acct-h" title="Your guardian account" />
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Name</dt>
            <dd className="mt-0.5 text-ink">{guardianAccount.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd className="mt-0.5 break-all text-ink">{guardianAccount.email}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">
          We email you about purchase requests, consent reminders and retest results. Payment receipts are always sent.
        </p>
        <Link href="/login" className={btn("secondary", "md", "mt-4")}>
          Sign out
        </Link>
      </Card>

      <Dialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={`Withdraw consent for ${confirmingName}?`}
        description={`${confirmingName}'s account closes now. The data is deleted within ${CONSENT.deletionBusinessDays} business days.`}
      >
        <p className="text-sm text-muted">No reason needed. Payment records are kept only as tax law requires.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setConfirming(null)} className={btn("secondary")}>
            Keep consent
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirming) setOverrides((o) => ({ ...o, [confirming]: { status: "withdrawn", on: TODAY } }));
              setConfirming(null);
            }}
            className={btn("destructive")}
          >
            Withdraw consent
          </button>
        </div>
      </Dialog>
    </div>
  );
}

export function WithdrawnNotice({ learnerId }: { learnerId: string }) {
  const [overrides] = useShared<ConsentOverrides>(SHARED.guardianConsent, NO_OVERRIDES);
  const w = overrides[learnerId];
  if (!w) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-card-sm border border-border-subtle bg-sunken px-4 py-3 text-[15px] text-ink">
      <CircleCheck aria-hidden="true" className="size-4 text-muted" />
      You withdrew consent on {fullDate(w.on)}. This account is closed and its data is being deleted.
    </p>
  );
}
