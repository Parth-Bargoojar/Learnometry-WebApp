"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, CircleCheck, Circle, Clock, LoaderCircle, RotateCcw, UserCheck } from "lucide-react";
import { learner, payments, redeemedCoupons } from "@/lib/data";
import { applyCoupon, CONFIRM_SLOW_AFTER_MS, renewalReminderOn, totalDue, type CheckoutItem, type CouponResult } from "@/lib/billing";
import { adultOn, isMinor } from "@/lib/guardian";
import { usePurchaseRequests } from "@/lib/requests";
import { dayMonth, fullDate, shortDate } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import type { PurchaseRequest } from "@/lib/types";
import { Dialog } from "./dialog";
import { btn } from "./ui";

/*
  Money UI — Web App Structure §8.14, §8.15, §8.18 and decisions D5, D6.
  Nothing here is optimistic: a payment, a pass or credits appear only after the
  server confirms (§9.3). Razorpay Checkout replaces the simulated redirect.
*/

const guardian = learner.guardian;
/** A minor with a verified guardian: every purchase becomes an approval request (D5). */
export const needsApproval = isMinor(learner.dateOfBirth) && guardian?.consentStatus === "verified";

/* ---------- Checkout (review step before Razorpay opens) ---------- */

export function CheckoutDialog({
  open,
  onClose,
  item,
  confirmPath,
  payerNote,
  extraParams = {},
}: {
  open: boolean;
  onClose: () => void;
  item: CheckoutItem;
  /** Where Razorpay returns to (§8.15): `/billing/confirm` or `/guardian/confirm`. */
  confirmPath: string;
  payerNote?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [autoRenew, setAutoRenew] = useState(false);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [opening, setOpening] = useState(false);
  const pass = item.kind === "plan_pass";
  const due = totalDue(item, coupon);

  const pay = () => {
    setOpening(true);
    const q = new URLSearchParams({ item: item.code, amount: String(due), ...extraParams });
    if (pass && autoRenew) q.set("renew", "1");
    if (coupon?.ok) q.set("coupon", coupon.code);
    // Production: open Razorpay Checkout with the server order, then land here on success.
    window.setTimeout(() => router.push(`${confirmPath}?${q}`), 500);
  };

  return (
    <Dialog open={open} onClose={onClose} title={item.title} description={payerNote}>
      <dl className="divide-y divide-border-subtle rounded-card-sm border border-border-subtle text-[15px]">
        <div className="flex justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted">Price</dt>
          <dd className="tabular-nums text-ink">₹{item.priceInr}</dd>
        </div>
        {item.prorationInr ? (
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">Unused days on your current pass</dt>
            <dd className="tabular-nums text-ink">−₹{item.prorationInr}</dd>
          </div>
        ) : null}
        {coupon?.ok ? (
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{coupon.code}</dt>
            <dd className="tabular-nums text-ink">−₹{coupon.discountInr}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="font-semibold text-ink">Total today</dt>
          <dd className="font-display text-3xl tabular-nums text-ink">₹{due}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">{item.note}</p>

      {pass ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card-sm border border-border-subtle p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-primary-deep)]" />
          <span className="text-sm">
            <span className="block font-semibold text-ink">Auto-renew every 30 days</span>
            <span className="block text-muted">
              Off unless you turn it on. Your bank sends a notice before each charge, we email 3 days before, and you can cancel in one click.
            </span>
          </span>
        </label>
      ) : null}

      {pass ? (
        <details className="group mt-3" open={!!coupon}>
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-primary-text underline underline-offset-4 [&::-webkit-details-marker]:hidden">
            Have a code?
          </summary>
          <form
            className="mt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCoupon(applyCoupon(code, item, { redeemed: redeemedCoupons, hadPaidPass: payments.length > 0 }));
            }}
          >
            <label htmlFor="coupon" className="sr-only">
              Coupon code
            </label>
            <input
              id="coupon"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (coupon && !coupon.ok) setCoupon(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={coupon ? !coupon.ok : undefined}
              aria-describedby={coupon ? "coupon-msg" : undefined}
              className="h-11 min-w-0 flex-1 rounded-input border border-border-subtle bg-surface px-3 uppercase text-ink placeholder:normal-case aria-[invalid=true]:border-danger"
              placeholder="e.g. EARLYACCESS"
            />
            <button type="submit" className={btn("secondary", "md")}>
              Apply
            </button>
          </form>
          {coupon ? (
            <p id="coupon-msg" role="status" className={`mt-2 flex items-start gap-1.5 text-sm ${coupon.ok ? "text-success-text" : "text-danger-text"}`}>
              {coupon.ok ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
              {coupon.message}
            </p>
          ) : null}
        </details>
      ) : null}

      <button type="button" onClick={pay} disabled={opening} className={btn("primary", "md", "mt-5 w-full")}>
        {opening ? "Opening Razorpay…" : `Pay ₹${due} with Razorpay`}
      </button>
      <p className="mt-2 text-center text-xs text-muted">UPI, cards, net banking and wallets</p>
    </Dialog>
  );
}

/* ---------- The one purchase button: checkout for adults, approval request for minors ---------- */

export function PurchaseButton({
  item,
  label,
  variant = "secondary",
  className = "",
}: {
  item: CheckoutItem;
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { request, openFor, setStatus } = usePurchaseRequests();
  const amount = totalDue(item);

  if (!needsApproval || !guardian) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={btn(variant, "md", className)}>
          {label}
        </button>
        <CheckoutDialog open={open} onClose={() => setOpen(false)} item={item} confirmPath="/billing/confirm" />
      </>
    );
  }

  const pending = openFor(item.code);
  if (pending) {
    return (
      <div role="status" className={`rounded-card-sm border border-warning/50 bg-warning/10 p-3 text-left ${className}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock aria-hidden="true" className="size-4 text-warning-text" />
          Waiting for {guardian.guardianFirstName}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Sent {dayMonth(pending.requestedOn)} · lasts until {dayMonth(pending.expiresOn)}
        </p>
        <button type="button" onClick={() => setStatus(pending.id, "cancelled")} className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-primary-text underline underline-offset-4">
          Cancel request
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn(variant, "md", className)}>
        <UserCheck aria-hidden="true" className="size-4" />
        Ask guardian to approve
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Ask ${guardian.guardianFirstName} to approve?`} description={`${item.title} · ₹${amount}`}>
        <p className="text-[15px] text-ink">
          We&apos;ll email {guardian.guardianFirstName}. {guardian.guardianFirstName} approves and pays from their guardian account, and can add a code or turn on auto-renew there.
        </p>
        <p className="mt-2 text-sm text-muted">The request lasts 7 days. You&apos;ll see its status on your Billing page.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setOpen(false)} className={btn("secondary")}>
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              request(item, amount);
              setOpen(false);
            }}
            className={btn("primary")}
          >
            Send request
          </button>
        </div>
      </Dialog>
    </>
  );
}

/* ---------- Request status (shared with the guardian portal) ---------- */

const REQUEST_STATUS: Record<PurchaseRequest["status"], { label: string; cls: string }> = {
  requested: { label: "Waiting", cls: "border-warning/50 bg-warning/15 text-warning-text" },
  approved: { label: "Approved", cls: "border-success/35 bg-success/10 text-success-text" },
  paid: { label: "Paid", cls: "border-success/35 bg-success/10 text-success-text" },
  declined: { label: "Declined", cls: "border-danger/35 bg-danger/10 text-danger-text" },
  expired: { label: "Expired", cls: "border-dashed border-faint bg-surface text-muted" },
  cancelled: { label: "Cancelled", cls: "border-border-subtle bg-sunken text-muted" },
};

export function RequestStatus({ value }: { value: PurchaseRequest["status"] }) {
  const s = REQUEST_STATUS[value];
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
}

/** Billing card for minors: every request and what happened to it. */
export function GuardianRequests() {
  const { list, setStatus } = usePurchaseRequests();
  if (!guardian) return null;
  const mine = list.filter((r) => r.learnerId === learner.id);
  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {guardian.guardianFirstName} approves and pays for purchases until you turn 18 on {fullDate(adultOn(learner.dateOfBirth))}.
      </p>
      {mine.length ? (
        <ul className="mt-3 divide-y divide-border-subtle">
          {mine.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">
                  {r.label} · ₹{r.amountInr}
                </span>
                <span className="block text-xs text-muted">
                  {r.status === "requested"
                    ? `Sent ${dayMonth(r.requestedOn)} · lasts until ${dayMonth(r.expiresOn)}`
                    : r.status === "expired"
                      ? `Not answered by ${dayMonth(r.expiresOn)}`
                      : `Sent ${dayMonth(r.requestedOn)}${r.decidedOn ? ` · ${REQUEST_STATUS[r.status].label.toLowerCase()} ${dayMonth(r.decidedOn)}` : ""}`}
                </span>
              </span>
              <RequestStatus value={r.status} />
              {r.status === "requested" ? (
                <button type="button" onClick={() => setStatus(r.id, "cancelled")} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
                  Cancel
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No requests yet. Buying a pass or credits sends one to {guardian.guardianFirstName}.</p>
      )}
    </>
  );
}

/* ---------- Renewal: one click to cancel, with Undo (D6) ---------- */

export function RenewalControl() {
  const [auto, setAuto] = useState(learner.autoRenew);
  const [changed, setChanged] = useState(false);
  const reminder = shortDate(renewalReminderOn(learner.passEnds));

  if (!auto) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm text-ink">
          {changed ? "Renewal cancelled. " : "Doesn't renew automatically. "}
          Your plan stays active until {shortDate(learner.passEnds)}.
          {changed ? null : needsApproval && guardian ? ` We'll remind you and ${guardian.guardianFirstName} on ${reminder}.` : ` We'll remind you on ${reminder}.`}
        </p>
        {changed ? (
          <button
            type="button"
            onClick={() => {
              setAuto(true);
              setChanged(false);
            }}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4"
          >
            <RotateCcw aria-hidden="true" className="size-4" /> Undo
          </button>
        ) : needsApproval ? null : (
          <button type="button" onClick={() => setAuto(true)} className={btn("secondary", "sm")}>
            Turn on auto-renew
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink">Renews automatically on {shortDate(learner.passEnds)}.</p>
      <button
        type="button"
        onClick={() => {
          setAuto(false);
          setChanged(true);
        }}
        className={btn("secondary", "sm")}
      >
        Cancel renewal
      </button>
    </div>
  );
}

export function RefundRequest({ lastDay }: { lastDay: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const payer = needsApproval && guardian ? `the UPI or card ${guardian.guardianFirstName} paid with` : "your UPI or card";
  if (sent) {
    return (
      <p role="status" className="text-sm text-ink">
        Refund requested. We&apos;ll confirm within 2 business days{needsApproval && guardian ? ` and let ${guardian.guardianFirstName} know` : ""}. The money reaches {payer} in 5–7 business days.
      </p>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "sm")}>
        Request refund
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Request a refund?" description={`Eligible until ${lastDay}.`}>
        <p className="text-sm text-ink">If approved, your pass ends now and you move to the Free plan. Your plan, reports and progress stay. The money goes back to {payer}.</p>
        <label htmlFor="reason" className="mt-4 block text-sm font-semibold text-ink">
          Reason (optional)
        </label>
        <textarea id="reason" rows={3} className="mt-1.5 w-full rounded-input border border-border-subtle bg-surface p-3 text-ink" />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus className={btn("secondary")} onClick={() => setOpen(false)}>
            Keep my plan
          </button>
          <button
            type="button"
            className={btn("primary")}
            onClick={() => {
              setSent(true);
              setOpen(false);
            }}
          >
            Request refund
          </button>
        </div>
      </Dialog>
    </>
  );
}

/* ---------- Payment confirmation (§8.15): pending until the webhook lands ---------- */

type Phase = "pending" | "slow" | "confirmed" | "failed";

export function PaymentStatus({
  steps,
  confirmed,
  done,
  retryHref,
  sim = "ok",
  onConfirmed,
}: {
  steps: string[];
  confirmed: { title: string; body: string };
  done: { href: string; label: string };
  retryHref: string;
  /** Preview only: which webhook outcome to simulate. Production polls the order. */
  sim?: "ok" | "failed" | "slow";
  /** Runs once, after the server has confirmed (never optimistically, §9.3). */
  onConfirmed?: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("pending");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase !== "pending") return;
    if (sim === "failed" && current === 1) {
      const t = setTimeout(() => setPhase("failed"), 900);
      return () => clearTimeout(t);
    }
    if (sim === "slow" && current === 1) return; // the server hasn't heard from Razorpay yet
    if (current >= steps.length) {
      const t = setTimeout(() => setPhase("confirmed"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCurrent((c) => c + 1), 900);
    return () => clearTimeout(t);
  }, [current, phase, sim, steps.length]);

  useEffect(() => {
    if (phase !== "pending") return;
    // The real threshold is 2 minutes; the preview shortens it so the state can be seen.
    const t = setTimeout(() => setPhase("slow"), sim === "slow" ? 4000 : CONFIRM_SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase, sim]);

  const confirmedRef = useRef(onConfirmed);
  useEffect(() => {
    confirmedRef.current = onConfirmed;
  });

  useEffect(() => {
    if (phase === "confirmed") confirmedRef.current?.();
    if (phase === "confirmed" || phase === "failed") heading.current?.focus();
  }, [phase]);

  if (phase === "confirmed") {
    return (
      <div className="flex flex-col items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-full border-2 border-line bg-success text-white">
          <Check aria-hidden="true" className="size-6" strokeWidth={3} />
        </span>
        <h2 ref={heading} tabIndex={-1} className="font-display text-2xl text-ink outline-none">
          {confirmed.title}
        </h2>
        <p className="text-[15px] text-muted">{confirmed.body}</p>
        <Link href={done.href} className={btn("primary", "md", "mt-2")}>
          {done.label}
        </Link>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-card-sm bg-danger/10">
          <CircleAlert aria-hidden="true" className="size-6 text-danger-text" />
        </span>
        <h2 ref={heading} tabIndex={-1} className="font-display text-2xl text-ink outline-none">
          Your payment didn&apos;t go through
        </h2>
        <p className="text-[15px] text-muted">You weren&apos;t charged. Nothing on your account changed.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={retryHref} className={btn("primary")}>
            Try again
          </Link>
          <a href={siteUrl("/contact")} className={btn("ghost")}>
            Contact support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true">
      <h2 className="text-lg font-semibold text-ink">Confirming your payment</h2>
      <ol className="mt-4 flex flex-col gap-3" aria-live="polite">
        {steps.map((s, i) => {
          const isDone = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex items-center gap-3">
              {isDone ? (
                <CircleCheck aria-hidden="true" className="size-6 text-success" />
              ) : active ? (
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary-text" />
              ) : (
                <Circle aria-hidden="true" className="size-6 text-border-subtle" />
              )}
              <span className={`text-[15px] ${active ? "font-semibold text-ink" : isDone ? "text-ink" : "text-faint"}`}>
                {s}
                <span className="sr-only">{isDone ? " — done" : active ? " — in progress" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 rounded-card-sm border border-border-subtle bg-sunken px-4 py-3 text-sm text-ink" role="status">
        {phase === "slow"
          ? "Your payment is taking longer to confirm. You can leave this page; we'll email you and your account will update automatically."
          : "This usually takes a few seconds. Don't pay again."}
      </p>
    </div>
  );
}

/* ---------- Downgrade: scheduled for the end of the pass, nothing charged now (D6) ---------- */

export function SwitchButton({ planName, startsOn }: { planName: string; startsOn: string }) {
  const [scheduled, setScheduled] = useState(false);
  if (scheduled) {
    return (
      <div role="status" className="mt-5 text-sm text-ink">
        Switching to {planName} on {shortDate(startsOn)}.{" "}
        <button type="button" onClick={() => setScheduled(false)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-text underline underline-offset-4">
          <RotateCcw aria-hidden="true" className="size-4" /> Undo
        </button>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setScheduled(true)} className={btn("secondary", "md", "mt-5 w-full")}>
        Switch
      </button>
      <p className="mt-2 text-center text-xs text-muted">Starts on {shortDate(startsOn)} when your current pass ends. Nothing is charged today.</p>
    </>
  );
}
