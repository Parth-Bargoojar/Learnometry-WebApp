"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Gauge,
  Info,
  OctagonAlert,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { ADMIN, BREAKER_COPY, pct, refundCheck, stamp, type BreakerState, type QuestionStatus } from "@/lib/admin";
import {
  ABUSE_LABEL,
  ABUSE_STATUS_LABEL,
  FLAG_KIND_LABEL,
  abuseFlags,
  adminCoupons,
  adminLearnerById,
  adminLearners,
  adminPayments,
  adminRefunds,
  admins,
  opsStats,
  questionMeta,
  webhookEvents,
  type AbuseFlag,
  type AbuseStatus,
  type AdminRefund,
  type AuditEntry,
  type FeatureFlag,
} from "@/lib/admin-data";
import { dayMonth, fullDate, inr } from "@/lib/format";
import { SHARED, useShared } from "@/lib/local-store";
import { ReasonDialog, field, labelCls, nowIso, useAudit, useAuditLog, useBreaker, useFlags } from "./admin-core";
import { Mono, Pill, StatTile, num, td, th, type Tone } from "./admin-ui";
import { useToast } from "./toast";
import { btn } from "./ui";

const BREAKER_TONE: Record<BreakerState, { tone: Tone; icon: LucideIcon }> = {
  normal: { tone: "success", icon: CircleCheck },
  warning: { tone: "warning", icon: TriangleAlert },
  restricted: { tone: "danger", icon: OctagonAlert },
};

export function BreakerPill({ state }: { state: BreakerState }) {
  const t = BREAKER_TONE[state];
  return (
    <Pill tone={t.tone} icon={t.icon}>
      {BREAKER_COPY[state].label}
    </Pill>
  );
}

const learnerName = (id: string | null) => {
  if (!id) return "System";
  const l = adminLearnerById(id);
  return l ? `${l.firstName} ${l.lastName}` : id;
};

function useRefunds() {
  const [decided, set] = useShared<Record<string, { status: AdminRefund["status"]; note: string; decidedBy: string }>>(SHARED.adminRefunds, {});
  const rows = adminRefunds.map((r) => ({ ...r, ...decided[r.id] }));
  return [rows, set] as const;
}

function useWebhooks() {
  return useShared<Record<string, string>>(SHARED.adminWebhooks, {});
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function OpsStats() {
  const b = useBreaker();
  const [reprocessed] = useWebhooks();
  const webhookFailures = webhookEvents.filter((e) => e.status === "failed" && !reprocessed[e.id]).length;
  const change = Math.round(((opsStats.activeLearners7d - opsStats.activeLearnersPrev7d) / opsStats.activeLearnersPrev7d) * 100);
  return (
    <div className="grid grid-cols-5 gap-4">
      <StatTile label="Active learners, 7 days" value={opsStats.activeLearners7d} sub={`${change >= 0 ? "+" : "−"}${Math.abs(change)}% on the previous 7 days`} href="/admin/learners" />
      <StatTile label="Diagnostics today" value={opsStats.diagnosticsToday} sub={`${opsStats.diagnosticsYesterday} yesterday`} />
      <StatTile
        label="AI cost today"
        value={inr(Math.round(b.costInr))}
        sub={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <BreakerPill state={b.state} /> {pct(b.ratio)} of revenue
          </span>
        }
        tone={b.state === "restricted" ? "danger" : b.state === "warning" ? "warning" : undefined}
        href="/admin/ai"
      />
      <StatTile label="Failed jobs today" value={opsStats.failedJobs.length} sub="After retries" tone={opsStats.failedJobs.length ? "warning" : undefined} />
      <StatTile
        label="Webhook failures"
        value={webhookFailures}
        sub={webhookFailures ? `After ${ADMIN.webhookRetries} retries` : "All processed"}
        tone={webhookFailures ? "danger" : undefined}
        href="/admin/payments?tab=webhooks"
      />
    </div>
  );
}

interface AlertItem {
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
}

const ALERT_ICON: Record<AlertItem["tone"], { icon: LucideIcon; cls: string }> = {
  danger: { icon: OctagonAlert, cls: "text-danger-text" },
  warning: { icon: TriangleAlert, cls: "text-warning-text" },
  info: { icon: Info, cls: "text-info" },
};

export function OpsAlerts() {
  const b = useBreaker();
  const [refunds] = useRefunds();
  const [reprocessed] = useWebhooks();
  const [abuse] = useShared<Record<string, AbuseStatus>>(SHARED.adminAbuse, {});
  const [qStatus] = useShared<Record<string, { status: QuestionStatus }>>(SHARED.adminQuestions, {});

  const alerts: AlertItem[] = [];
  if (b.state !== "normal") {
    alerts.push({ tone: b.state === "restricted" ? "danger" : "warning", title: `AI breaker is ${BREAKER_COPY[b.state].label}`, detail: BREAKER_COPY[b.state].effect, href: "/admin/ai", action: "Review" });
  } else if (b.ratio >= b.budget.warningRatio * 0.8) {
    alerts.push({ tone: "info", title: `AI cost is at ${pct(b.ratio)} of revenue`, detail: `Warning starts at ${pct(b.budget.warningRatio)} (${inr(Math.round(b.warningAtInr))} today).`, href: "/admin/ai", action: "View cost" });
  }
  const failedHooks = webhookEvents.filter((e) => e.status === "failed" && !reprocessed[e.id]);
  if (failedHooks.length) {
    alerts.push({ tone: "danger", title: `${failedHooks.length} payment webhook failed after ${ADMIN.webhookRetries} retries`, detail: failedHooks[0].note ?? "", href: "/admin/payments?tab=webhooks", action: "Reprocess" });
  }
  const openRefunds = refunds.filter((r) => r.status === "requested");
  if (openRefunds.length) {
    const oldest = openRefunds.reduce((a, c) => (a.requestedAt < c.requestedAt ? a : c));
    const due = new Date(new Date(oldest.requestedAt).getTime() + ADMIN.refundDecisionHours * 3_600_000).toISOString();
    alerts.push({ tone: "warning", title: `${openRefunds.length} refund request${openRefunds.length > 1 ? "s" : ""} to decide`, detail: `Oldest is due by ${stamp(due)} IST (${ADMIN.refundDecisionHours} h promise).`, href: "/admin/payments?tab=refunds", action: "Decide" });
  }
  const highAbuse = abuseFlags.filter((f) => (abuse[f.id] ?? f.status) === "open" && f.severity === "high");
  if (highAbuse.length) {
    alerts.push({ tone: "warning", title: `${highAbuse.length} high-severity abuse flag${highAbuse.length > 1 ? "s" : ""}`, detail: highAbuse.map((f) => `${ABUSE_LABEL[f.kind]} · ${learnerName(f.learnerId)}`).join(" · "), href: "/admin/security", action: "Review" });
  }
  const awaiting = questionMeta.filter((q) => ["validated", "reviewed"].includes(qStatus[q.id]?.status ?? q.status)).length;
  if (awaiting) {
    alerts.push({ tone: "info", title: `${awaiting} question${awaiting > 1 ? "s" : ""} waiting for review or publishing`, detail: "Validated items need a human review; reviewed items can be published.", href: "/admin/questions?status=validated", action: "Open queue" });
  }
  if (opsStats.failedJobs.length) {
    alerts.push({ tone: "info", title: `${opsStats.failedJobs.length} background jobs failed today`, detail: "Learners saw the fallback. Details below.", href: "#failed-jobs", action: "See jobs" });
  }
  const deleting = adminLearners.filter((l) => l.status === "deletion_pending").length;
  if (deleting) {
    alerts.push({ tone: "info", title: `${deleting} account scheduled for deletion`, detail: "Erased automatically within 7 business days unless the learner signs in within 48 h.", href: "/admin/learners?status=deletion_pending", action: "View" });
  }

  if (!alerts.length) {
    return <p className="flex items-center gap-2 text-sm text-muted"><CircleCheck aria-hidden="true" className="size-4 text-success-text" /> Nothing needs attention.</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {alerts.map((a) => {
        const I = ALERT_ICON[a.tone];
        return (
          <li key={a.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <I.icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${I.cls}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                <span className="sr-only">{a.tone === "danger" ? "Critical: " : a.tone === "warning" ? "Warning: " : "Note: "}</span>
                {a.title}
              </p>
              <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
            </div>
            <Link href={a.href} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-btn px-2 text-sm font-semibold text-primary-text underline underline-offset-4 hover:text-ink">
              {a.action} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Circuit breaker (K8)                                                */
/* ------------------------------------------------------------------ */

export function BreakerPanel() {
  const b = useBreaker();
  const [, updateFlag] = useFlags();
  const log = useAuditLog();
  const toast = useToast();
  const [choice, setChoice] = useState<"auto" | "force_normal" | "force_restricted" | null>(null);
  const scaleMax = Math.max(0.4, b.ratio * 1.1);
  const at = (r: number) => `${Math.min(100, (r / scaleMax) * 100)}%`;
  const current = b.override ?? "auto";
  const label = { auto: "Automatic", force_normal: "Force Normal", force_restricted: "Force Restricted" };

  return (
    <section aria-labelledby="breaker-h" className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="breaker-h" className="flex items-center gap-2 text-base font-semibold text-ink">
            <Gauge aria-hidden="true" className="size-5 text-muted" /> Spend circuit breaker
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{BREAKER_COPY[b.state].effect}</p>
        </div>
        <div className="flex items-center gap-2">
          <BreakerPill state={b.state} />
          {b.overridden ? <Pill tone="outline">Override until 00:00 IST</Pill> : null}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-4 gap-4 border-y border-border-subtle py-4">
        <div>
          <dt className="text-xs font-semibold text-muted">Cost today</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{inr(Math.round(b.costInr))}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Share of revenue</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{pct(b.ratio)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Avg daily net revenue, 7 days</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{inr(b.revenueAvgInr)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">Hard cap</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{inr(b.budget.hardCapInr)}</dd>
        </div>
      </dl>

      <figure className="mt-5">
        <figcaption className="sr-only">
          AI cost is {pct(b.ratio)} of revenue. Warning at {pct(b.budget.warningRatio)}, Restricted at {pct(b.budget.restrictedRatio)}.
        </figcaption>
        <div aria-hidden="true" className="relative h-3 rounded-full bg-sunken ring-1 ring-inset ring-border-subtle">
          <div className="h-full rounded-full bg-ink" style={{ width: at(b.ratio) }} />
          {[b.budget.warningRatio, b.budget.restrictedRatio].map((r) => (
            <span key={r} className="absolute -top-1 h-5 w-0.5 bg-line" style={{ left: at(r) }} />
          ))}
        </div>
        <div aria-hidden="true" className="relative mt-1.5 h-4 text-xs text-muted">
          <span className="absolute -translate-x-1/2" style={{ left: at(b.budget.warningRatio) }}>
            Warning {pct(b.budget.warningRatio)}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: at(b.budget.restrictedRatio) }}>
            Restricted {pct(b.budget.restrictedRatio)}
          </span>
        </div>
      </figure>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">Operator override</legend>
        <p className="mt-0.5 text-sm text-muted">Clears itself at the 00:00 IST reset. Thresholds are edited in the <Link href="/admin/flags" className="font-semibold text-primary-text underline underline-offset-4">ai_budget flag</Link>.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["auto", "force_normal", "force_restricted"] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={current === o}
              disabled={current === o}
              onClick={() => setChoice(o)}
              className={`h-10 rounded-btn border px-4 text-sm font-semibold disabled:cursor-default ${
                current === o ? "border-line bg-ink text-on-ink" : "border-border-subtle bg-surface text-ink hover:border-line"
              }`}
            >
              {label[o]}
            </button>
          ))}
        </div>
      </fieldset>

      <ReasonDialog
        open={choice !== null}
        onClose={() => setChoice(null)}
        title={choice === "auto" ? "Return the breaker to automatic?" : `${choice ? label[choice] : ""} until midnight?`}
        summary={
          choice === "force_restricted"
            ? "Deep diagnostics and question-generation fallback pause for every learner until 00:00 IST. Tests, scoring and plans keep working."
            : choice === "force_normal"
              ? "Every operation runs on its planned tier until 00:00 IST, even above the thresholds. The hard cap still applies at the provider."
              : "The state follows the thresholds again."
        }
        confirmLabel={choice ? label[choice] : "Confirm"}
        destructive={choice === "force_restricted"}
        onConfirm={(reason) => {
          const state = choice === "auto" ? null : choice;
          updateFlag("ai_breaker_override", { enabled: state !== null, config: { state } });
          log({ action: "breaker.override", resourceType: "breaker", resourceId: "ai", summary: `Breaker ${label[current]} → ${label[choice!]}`, reason });
          toast.show(`Breaker set to ${label[choice!]}`);
        }}
      />
      {toast.node}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Refunds (K5)                                                        */
/* ------------------------------------------------------------------ */

const REFUND_TONE: Record<AdminRefund["status"], Tone> = { requested: "warning", approved: "info", rejected: "neutral", processed: "success" };
const REFUND_LABEL: Record<AdminRefund["status"], string> = { requested: "To decide", approved: "Approved · processing", rejected: "Rejected", processed: "Refunded" };

export function RefundQueue() {
  const [rows, set] = useRefunds();
  const log = useAuditLog();
  const toast = useToast();
  const [acting, setActing] = useState<{ id: string; kind: "approve" | "reject" } | null>(null);
  const target = rows.find((r) => r.id === acting?.id);
  const pay = target ? adminPayments.find((p) => p.id === target.paymentId) : null;
  const check = target ? refundCheck(target.firstPayment, target.usedShare, target.requestedAt.slice(0, 10)) : null;

  const ordered = [...rows].sort((a, b) => (a.status === "requested" ? -1 : 1) - (b.status === "requested" ? -1 : 1) || b.requestedAt.localeCompare(a.requestedAt));

  return (
    <>
      <ul className="flex flex-col gap-3">
        {ordered.map((r) => {
          const c = refundCheck(r.firstPayment, r.usedShare, r.requestedAt.slice(0, 10));
          const p = adminPayments.find((x) => x.id === r.paymentId)!;
          const due = new Date(new Date(r.requestedAt).getTime() + ADMIN.refundDecisionHours * 3_600_000).toISOString();
          return (
            <li key={r.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    <Link href={`/admin/learners/${r.learnerId}?tab=subscription`} className="underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                      {learnerName(r.learnerId)}
                    </Link>{" "}
                    · {p.item} · {inr(p.amountInr)}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Requested {stamp(r.requestedAt)} by {r.requestedBy} · paid by {p.payer}
                    {r.status === "requested" ? ` · decide by ${stamp(due)}` : ""}
                  </p>
                </div>
                <Pill tone={REFUND_TONE[r.status]}>{REFUND_LABEL[r.status]}</Pill>
              </div>
              <p className="mt-3 text-sm text-ink">“{r.reason}”</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Pill tone={c.eligible ? "success" : "danger"} icon={c.eligible ? CircleCheck : CircleAlert}>
                  {c.eligible ? "Meets the policy" : "Outside the policy"}
                </Pill>
                <span className="text-muted">{c.notes.join(" · ")}</span>
              </div>
              {r.status === "requested" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActing({ id: r.id, kind: "approve" })} className={btn(c.eligible ? "primary" : "secondary", "sm")}>
                    {c.eligible ? "Approve refund" : "Approve as exception"}
                  </button>
                  <button type="button" onClick={() => setActing({ id: r.id, kind: "reject" })} className={btn("ghost", "sm")}>
                    Reject
                  </button>
                </div>
              ) : r.decisionNote ? (
                <p className="mt-3 text-sm text-muted">
                  {admins[r.decidedBy ?? ""] ?? "Admin"}: {r.decisionNote}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ReasonDialog
        open={!!acting}
        onClose={() => setActing(null)}
        title={acting?.kind === "approve" ? (check?.eligible ? "Approve this refund?" : "Approve outside the policy?") : "Reject this refund?"}
        summary={
          target && pay ? (
            acting?.kind === "approve" ? (
              <ul className="list-disc space-y-1 pl-4">
                <li>{inr(pay.amountInr)} goes back to {pay.payer}&apos;s original payment method within 5–7 business days.</li>
                <li>The {pay.item.split(" ·")[0]} pass ends now and its remaining plan credits expire.</li>
                <li>{learnerName(target.learnerId)} {pay.payer.includes("guardian") ? "and the guardian are" : "is"} emailed.</li>
              </ul>
            ) : (
              <p>{target.requestedBy} is emailed your reason. The pass continues as it is.</p>
            )
          ) : null
        }
        reasonHint={acting?.kind === "reject" ? "Sent to the requester as written, and saved in the audit log." : "Saved in the audit log with your name."}
        confirmLabel={acting?.kind === "approve" ? `Refund ${pay ? inr(pay.amountInr) : ""}` : "Reject refund"}
        destructive={acting?.kind === "reject"}
        onConfirm={(reason) => {
          if (!target || !pay) return;
          const status = acting!.kind === "approve" ? "approved" : "rejected";
          set((prev) => ({ ...prev, [target.id]: { status, note: reason, decidedBy: "usr_admin_aarav" } }));
          log({
            action: `refund.${status}`,
            resourceType: "refund",
            resourceId: target.id,
            summary: `${status === "approved" ? "Approved" : "Rejected"} ${inr(pay.amountInr)} refund for ${learnerName(target.learnerId)}${status === "approved" && !check?.eligible ? " (exception)" : ""}`,
            reason,
          });
          toast.show(status === "approved" ? "Refund approved. Razorpay will confirm it." : "Refund rejected. The requester has been emailed.");
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Webhooks (K12) and coupons (K13)                                    */
/* ------------------------------------------------------------------ */

const HOOK_TONE = { received: "info", processed: "success", failed: "danger", ignored: "neutral" } as const;

export function WebhookTable() {
  const [reprocessed, set] = useWebhooks();
  const log = useAuditLog();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const ev = webhookEvents.find((e) => e.id === target);
  return (
    <>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Payment webhook events</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Received</th>
              <th scope="col" className={th}>Event</th>
              <th scope="col" className={th}>Type</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} ${num}`}>Retries</th>
              <th scope="col" className={th}>Note</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {webhookEvents.map((e) => {
              const done = reprocessed[e.id];
              const status = done ? "processed" : e.status;
              return (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(e.at)}</td>
                  <td className={td}><Mono>{e.eventId}</Mono></td>
                  <td className={td}>{e.type}</td>
                  <td className={td}><Pill tone={HOOK_TONE[status]}>{status[0].toUpperCase() + status.slice(1)}</Pill></td>
                  <td className={`${td} ${num}`}>{e.retries}</td>
                  <td className={`${td} max-w-sm text-muted`}>{done ? `Reprocessed ${stamp(done)}` : e.note ?? "—"}</td>
                  <td className={`${td} text-right`}>
                    {status === "failed" ? (
                      <button type="button" onClick={() => setTarget(e.id)} className={btn("secondary", "sm")}>
                        <RotateCcw aria-hidden="true" className="size-4" /> Reprocess
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">
          Signatures are verified before storage. Failed events retry {ADMIN.webhookRetries} times ({ADMIN.webhookBackoff.join(", ")}) and are idempotent by event ID, so reprocessing never double-grants.
        </p>
      </div>
      <ReasonDialog
        open={!!ev}
        onClose={() => setTarget(null)}
        title="Reprocess this event?"
        summary={ev ? <>Runs <Mono>{ev.type}</Mono> for <Mono>{ev.eventId}</Mono> again. If the underlying problem is fixed, the payment is confirmed and credits are granted once.</> : null}
        confirmLabel="Reprocess"
        onConfirm={(reason) => {
          if (!ev) return;
          set((prev) => ({ ...prev, [ev.id]: nowIso() }));
          log({ action: "webhook.reprocessed", resourceType: "webhook", resourceId: ev.eventId, summary: `Reprocessed ${ev.type}`, reason });
          toast.show("Event reprocessed");
        }}
      />
      {toast.node}
    </>
  );
}

export function CouponTable() {
  const [ended, set] = useShared<Record<string, string>>(SHARED.adminCoupons, {});
  const log = useAuditLog();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Coupons</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Code</th>
              <th scope="col" className={th}>Offer</th>
              <th scope="col" className={th}>Applies to</th>
              <th scope="col" className={`${th} ${num}`}>Redeemed</th>
              <th scope="col" className={th}>Runs</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {adminCoupons.map((c) => {
              const active = c.active && !ended[c.code];
              return (
                <tr key={c.code}>
                  <td className={td}>
                    <Mono>{c.code}</Mono>
                    <span className="mt-0.5 block text-xs text-muted">{c.description}</span>
                  </td>
                  <td className={td}>{c.discount}{c.bonusCredits ? ` + ${c.bonusCredits} credits` : ""}</td>
                  <td className={td}>{c.appliesTo} · {c.perUser} per learner</td>
                  <td className={`${td} ${num}`}>{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className={`${td} whitespace-nowrap`}>{dayMonth(c.startsOn)} – {ended[c.code] ? `${dayMonth(ended[c.code].slice(0, 10))} (ended early)` : fullDate(c.endsOn)}</td>
                  <td className={td}><Pill tone={active ? "success" : "neutral"}>{active ? "Active" : "Ended"}</Pill></td>
                  <td className={`${td} text-right`}>
                    {active ? (
                      <button type="button" onClick={() => setTarget(c.code)} className={btn("ghost", "sm")}>
                        End now
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">New campaigns are added as a reviewed config change, not from the console (K13).</p>
      </div>
      <ReasonDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`End ${target} now?`}
        summary="Checkouts stop accepting the code at once. Existing redemptions and bonus credits are kept. Also switch off earlyaccess_campaign if the website mentions the code."
        confirmLabel="End coupon"
        destructive
        onConfirm={(reason) => {
          if (!target) return;
          set((prev) => ({ ...prev, [target]: nowIso() }));
          log({ action: "coupon.ended", resourceType: "coupon", resourceId: target, summary: `Ended ${target} early`, reason });
          toast.show(`${target} ended`);
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Abuse flags (K10)                                                   */
/* ------------------------------------------------------------------ */

const SEVERITY_TONE = { low: "neutral", medium: "warning", high: "danger" } as const;

type AbuseAction = "dismissed" | "watching" | "limited" | "suspended";

const ACTIONS: Record<AbuseAction, { label: string; title: string; summary: string; destructive?: boolean }> = {
  watching: { label: "Watch 7 days", title: "Watch this learner for 7 days?", summary: "No change for the learner. The flag reopens if the pattern continues after 7 days." },
  dismissed: { label: "Dismiss", title: "Dismiss this flag?", summary: "Marks it a false positive. The same signal won't flag this learner again for 30 days." },
  limited: { label: "Limit to Fast for 7 days", title: "Limit AI to the Fast tier for 7 days?", summary: "Explanations and diagnoses run on the Fast tier; tests, scoring and plans are unchanged. The learner sees a note and can contact support." },
  suspended: { label: "Suspend account", title: "Suspend this account?", summary: "The learner is signed out and can't sign in. They are emailed the reason and how to appeal through support; for a minor, the guardian is emailed too. Paid time is paused, not lost.", destructive: true },
};

export function AbuseQueue({ filter }: { filter: "open" | "all" }) {
  const [changed, set] = useShared<Record<string, AbuseStatus>>(SHARED.adminAbuse, {});
  const [, setLearner] = useShared<Record<string, { status?: string }>>(SHARED.adminLearners, {});
  const log = useAuditLog();
  const toast = useToast();
  const [acting, setActing] = useState<{ flag: AbuseFlag; action: AbuseAction } | null>(null);
  const rows = abuseFlags.map((f) => ({ ...f, status: changed[f.id] ?? f.status })).filter((f) => filter === "all" || f.status === "open");

  if (!rows.length) {
    return <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">No open flags. <Link href="/admin/security?status=all" className="font-semibold text-primary-text underline underline-offset-4">Show all flags</Link></p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {rows.map((f) => {
          const l = adminLearnerById(f.learnerId);
          return (
            <li key={f.id} className="rounded-card border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert aria-hidden="true" className="size-4 text-muted" />
                <span className="font-semibold text-ink">{ABUSE_LABEL[f.kind]}</span>
                <Pill tone={SEVERITY_TONE[f.severity]}>{f.severity[0].toUpperCase() + f.severity.slice(1)}</Pill>
                <span className="text-sm text-muted">
                  ·{" "}
                  <Link href={`/admin/learners/${f.learnerId}`} className="font-semibold text-ink underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                    {learnerName(f.learnerId)}
                  </Link>{" "}
                  {l ? `· ${l.plan[0].toUpperCase() + l.plan.slice(1)} · ${l.email}` : ""} · detected {stamp(f.detectedAt)}
                </span>
                <span className="ml-auto">
                  <Pill tone={f.status === "open" ? "warning" : f.status === "suspended" ? "danger" : "neutral"}>{ABUSE_STATUS_LABEL[f.status]}</Pill>
                </span>
              </div>
              <p className="mt-2 max-w-4xl text-sm text-ink">{f.evidence}</p>
              {f.status === "open" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["watching", "dismissed", "limited", "suspended"] as const).map((a) => (
                    <button key={a} type="button" onClick={() => setActing({ flag: f, action: a })} className={btn(a === "suspended" ? "destructive" : a === "limited" ? "secondary" : "ghost", "sm")}>
                      {ACTIONS[a].label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={!!acting}
        onClose={() => setActing(null)}
        title={acting ? ACTIONS[acting.action].title : ""}
        description={acting ? `${ABUSE_LABEL[acting.flag.kind]} · ${learnerName(acting.flag.learnerId)}` : undefined}
        summary={acting ? ACTIONS[acting.action].summary : null}
        reasonHint={acting?.action === "suspended" ? "The learner is emailed a plain summary; the full reason stays in the audit log." : undefined}
        confirmLabel={acting ? ACTIONS[acting.action].label : ""}
        destructive={acting ? ACTIONS[acting.action].destructive : false}
        onConfirm={(reason) => {
          if (!acting) return;
          const { flag, action } = acting;
          set((prev) => ({ ...prev, [flag.id]: action }));
          if (action === "suspended") setLearner((prev) => ({ ...prev, [flag.learnerId]: { ...prev[flag.learnerId], status: "suspended" } }));
          log({ action: `abuse.${action}`, resourceType: "abuse_flag", resourceId: flag.learnerId, summary: `${ABUSE_LABEL[flag.kind]}: ${ACTIONS[action].label}`, reason });
          toast.show(action === "suspended" ? "Account suspended. The learner has been emailed." : `Flag updated: ${ABUSE_STATUS_LABEL[action]}`);
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Feature flags (K11)                                                 */
/* ------------------------------------------------------------------ */

export function FlagList() {
  const [flags, update] = useFlags();
  const log = useAuditLog();
  const toast = useToast();
  const [toggling, setToggling] = useState<FeatureFlag | null>(null);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [draft, setDraft] = useState("");

  const parsed = (() => {
    try {
      const v = JSON.parse(draft);
      return v !== null && typeof v === "object" && !Array.isArray(v) ? { ok: true as const, value: v as Record<string, unknown> } : { ok: false as const, msg: "Config must be a JSON object, like {\"key\": 1}." };
    } catch (e) {
      return { ok: false as const, msg: `Not valid JSON: ${(e as Error).message}` };
    }
  })();

  const configError = () => {
    if (!editing) return null;
    if (!parsed.ok) return parsed.msg;
    const before = Object.keys(editing.config ?? {}).sort().join(",");
    const after = Object.keys(parsed.value).sort().join(",");
    if (before && before !== after) return `Keep the same keys (${before.replaceAll(",", ", ")}); the server validates this flag's schema.`;
    if (editing.key === "ai_budget") {
      const v = parsed.value as Record<string, number>;
      if (!(v.warningRatio > 0 && v.warningRatio < v.restrictedRatio && v.restrictedRatio <= 1)) return "Needs 0 < warningRatio < restrictedRatio ≤ 1.";
      if (!(v.hardCapInr > 0)) return "hardCapInr must be above 0.";
    }
    return null;
  };

  return (
    <>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Feature flags</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Flag</th>
              <th scope="col" className={th}>Type</th>
              <th scope="col" className={th}>Config</th>
              <th scope="col" className={th}>Last changed</th>
              <th scope="col" className={`${th} text-right`}>On</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key}>
                <td className={`${td} max-w-md`}>
                  <Mono>{f.key}</Mono>
                  <span className="mt-1 block text-xs text-muted">{f.description}</span>
                </td>
                <td className={td}>
                  <Pill tone={f.kind === "kill_switch" ? "ink" : f.kind === "ops" ? "info" : "neutral"}>{FLAG_KIND_LABEL[f.kind]}</Pill>
                </td>
                <td className={td}>
                  {f.config ? (
                    <div className="flex items-center gap-2">
                      <code className="block max-w-56 truncate font-mono text-xs text-muted">{JSON.stringify(f.config)}</code>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(JSON.stringify(f.config, null, 2));
                          setEditing(f);
                        }}
                        className="h-9 shrink-0 rounded-btn px-2 text-sm font-semibold text-primary-text underline underline-offset-4 hover:text-ink"
                      >
                        Edit<span className="sr-only"> {f.key} config</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>
                  {admins[f.updatedBy] ?? f.updatedBy}
                  <span className="block text-xs tabular-nums">{stamp(f.updatedAt)}</span>
                </td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={f.enabled}
                    aria-label={f.key}
                    onClick={() => setToggling(f)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-faint transition-colors ${f.enabled ? "bg-primary" : "bg-sunken"}`}
                  >
                    <span className={`inline-block size-5 rounded-full border-2 border-faint bg-surface transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">Changes reach every server within {ADMIN.flagPropagationSeconds} seconds.</p>
      </div>

      <ReasonDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        title={toggling ? `Turn ${toggling.key} ${toggling.enabled ? "off" : "on"}?` : ""}
        summary={toggling ? <>{toggling.description} <strong>{toggling.enabled ? "On → Off" : "Off → On"}</strong> for every learner.</> : null}
        confirmLabel={toggling?.enabled ? "Turn off" : "Turn on"}
        destructive={toggling?.kind === "kill_switch" && !toggling.enabled}
        onConfirm={(reason) => {
          if (!toggling) return;
          update(toggling.key, { enabled: !toggling.enabled, config: toggling.config });
          log({ action: "flag.toggled", resourceType: "flag", resourceId: toggling.key, summary: `${toggling.key} ${toggling.enabled ? "on → off" : "off → on"}`, reason });
          toast.show(`${toggling.key} is ${toggling.enabled ? "off" : "on"}`);
        }}
      />

      <ReasonDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.key} config` : ""}
        confirmLabel="Save config"
        validate={configError}
        onConfirm={(reason) => {
          if (!editing || !parsed.ok) return;
          update(editing.key, { enabled: editing.enabled, config: parsed.value });
          log({ action: "flag.config_changed", resourceType: "flag", resourceId: editing.key, summary: `${JSON.stringify(editing.config)} → ${JSON.stringify(parsed.value)}`, reason });
          toast.show(`${editing.key} config saved`);
        }}
      >
        <div>
          <label htmlFor="flag-config" className={labelCls}>
            Config (JSON)
          </label>
          <textarea id="flag-config" rows={7} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${field} py-2 font-mono`} />
          <p className={`mt-1 text-xs ${parsed.ok ? "text-muted" : "text-danger-text"}`}>{parsed.ok ? "Valid JSON" : parsed.msg}</p>
        </div>
      </ReasonDialog>
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log (K2)                                                      */
/* ------------------------------------------------------------------ */

export function AuditTable({ resourceId, type }: { resourceId?: string; type?: AuditEntry["resourceType"] }) {
  const all = useAudit();
  const rows = all.filter((e) => (!resourceId || e.resourceId === resourceId) && (!type || e.resourceType === type));
  if (!rows.length) return <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">No audit entries{resourceId ? " for this learner" : ""} yet.</p>;
  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Audit log</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>When (IST)</th>
            <th scope="col" className={th}>Who</th>
            <th scope="col" className={th}>Action</th>
            <th scope="col" className={th}>Change</th>
            <th scope="col" className={th}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(e.at)}</td>
              <td className={`${td} whitespace-nowrap`}>{admins[e.actor] ?? e.actor}</td>
              <td className={td}><Mono>{e.action}</Mono></td>
              <td className={`${td} max-w-xs`}>
                {e.summary}
                {e.resourceId !== "-" && !resourceId ? <span className="block text-xs text-muted">{e.resourceType} · {e.resourceId}</span> : null}
              </td>
              <td className={`${td} max-w-sm text-muted`}>{e.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">Append-only. Kept 1 year (§1.9).</p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
