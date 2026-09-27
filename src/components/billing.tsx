"use client";

import { useState } from "react";
import { CircleCheck, LoaderCircle, RotateCcw } from "lucide-react";
import { PLANS, type PlanCode } from "@/lib/config";
import { learner } from "@/lib/data";
import { daysFromToday, shortDate } from "@/lib/format";
import { Dialog } from "./dialog";
import { btn } from "./ui";

/**
 * Checkout confirmation — Web App Structure §8.15. Nothing is shown as paid until
 * the (simulated) webhook confirms; copy tells the learner not to pay twice.
 */
function Checkout({ open, onClose, title, amount }: { open: boolean; onClose: () => void; title: string; amount: number }) {
  const [step, setStep] = useState<"review" | "pending" | "done">("review");
  const [autoRenew, setAutoRenew] = useState(false);
  const close = () => {
    setStep("review");
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} dismissible={step !== "pending"} title={step === "done" ? "Payment confirmed" : title}>
      {step === "review" ? (
        <>
          <p className="font-display text-3xl tabular-nums text-ink">₹{amount}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card-sm border border-border-subtle p-3">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="mt-1 size-4 accent-[var(--color-primary-deep)]" />
            <span className="text-sm">
              <span className="block font-semibold text-ink">Auto-renew every 30 days</span>
              <span className="block text-muted">Off unless you turn it on. You get a notice before every charge and can cancel in one click.</span>
            </span>
          </label>
          <button type="button" className={btn("primary", "md", "mt-5 w-full")} onClick={() => {
            setStep("pending");
            window.setTimeout(() => setStep("done"), 2200);
          }}>
            Pay with Razorpay
          </button>
          <p className="mt-2 text-center text-xs text-muted">UPI, cards, net banking and wallets</p>
        </>
      ) : step === "pending" ? (
        <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
          <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary-text" />
          <p className="font-semibold text-ink">Confirming your payment</p>
          <p className="text-sm text-muted">This usually takes a few seconds. Don&apos;t pay again.</p>
        </div>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <CircleCheck aria-hidden="true" className="size-10 text-success" />
          <p className="font-semibold text-ink">You&apos;re all set.</p>
          <button type="button" className={btn("primary", "md", "mt-2")} onClick={close}>
            Done
          </button>
        </div>
      )}
    </Dialog>
  );
}

export function PackButton({ label, amount }: { label: string; amount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "md", "mt-5")}>
        {label}
      </button>
      <Checkout open={open} onClose={() => setOpen(false)} title={label} amount={amount} />
    </>
  );
}

export function PlanChoice({ code }: { code: PlanCode }) {
  const [open, setOpen] = useState(false);
  const current = PLANS[learner.plan];
  const target = PLANS[code];
  if (code === learner.plan) {
    return (
      <span className={btn("secondary", "md", "mt-5 w-full")} aria-disabled="true">
        Current plan
      </span>
    );
  }
  if (code === "free") return null;
  const upgrade = target.priceInr > current.priceInr;
  const remaining = Math.max(0, daysFromToday(learner.passEnds));
  const due = target.priceInr - Math.floor((current.priceInr * remaining) / 30);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn(target.recommended ? "primary" : "secondary", "md", "mt-5 w-full")}>
        {upgrade ? "Upgrade" : "Switch"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {upgrade ? `Pay ₹${due} today. New 30-day pass starts now.` : `Starts ${shortDate(learner.passEnds)} when your current pass ends.`}
      </p>
      <Checkout open={open} onClose={() => setOpen(false)} title={`${target.name} · 30-day pass`} amount={upgrade ? due : target.priceInr} />
    </>
  );
}

/** One-click cancel renewal with Undo — the Refund Policy promises a single click. */
export function RenewalControl() {
  const [auto, setAuto] = useState(learner.autoRenew);
  const [changed, setChanged] = useState(false);
  if (!auto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink">
          {changed ? "Renewal cancelled. " : "Doesn't renew automatically. "}
          Your plan stays active until {shortDate(learner.passEnds)}.
        </p>
        {changed ? (
          <button type="button" onClick={() => { setAuto(true); setChanged(false); }} className="inline-flex h-9 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4">
            <RotateCcw aria-hidden="true" className="size-4" /> Undo
          </button>
        ) : (
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
      <button type="button" onClick={() => { setAuto(false); setChanged(true); }} className={btn("secondary", "sm")}>
        Cancel renewal
      </button>
    </div>
  );
}

export function RefundRequest({ lastDay }: { lastDay: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) {
    return <p role="status" className="text-sm text-ink">Refund requested. We&apos;ll confirm within 2 business days; the money reaches your UPI or card in 5–7 business days.</p>;
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "sm")}>
        Request refund
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Request a refund?" description={`Eligible until ${lastDay}.`}>
        <p className="text-sm text-ink">If approved, your pass ends now and you move to the Free plan. Your plan, reports and progress stay.</p>
        <label htmlFor="reason" className="mt-4 block text-sm font-semibold text-ink">
          Reason (optional)
        </label>
        <textarea id="reason" rows={3} className="mt-1.5 w-full rounded-input border border-border-subtle bg-surface p-3 text-ink" />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn("secondary")} onClick={() => setOpen(false)}>
            Keep my plan
          </button>
          <button type="button" className={btn("primary")} onClick={() => { setSent(true); setOpen(false); }}>
            Request refund
          </button>
        </div>
      </Dialog>
    </>
  );
}
