"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, Clock, Package, Sparkles, UserCheck } from "lucide-react";
import { CREDIT_PACKS, PLANS } from "@/lib/config";
import { credits, learner } from "@/lib/data";
import { isMinor } from "@/lib/guardian";
import { Dialog } from "./dialog";
import { Cost, btn } from "./ui";

/*
  Credit gating — Web App Structure §9.1, the same everywhere:
  the action shows its cost; if the balance is short, the button becomes
  "Get credits" with one line saying what's needed. The client check is display
  only; if the server rejects (another tab spent the credits), the same sheet opens.
*/

type Size = "sm" | "md" | "lg";

export function SpendLink({
  href,
  cost,
  children,
  what = "This",
  variant = "primary",
  size = "md",
  className = "",
  balance = credits.balance,
}: {
  href: string;
  cost: number;
  children: ReactNode;
  /** Sentence subject for the shortfall line: "Starting a diagnostic needs 70 credits." */
  what?: string;
  variant?: "primary" | "secondary";
  size?: Size;
  className?: string;
  balance?: number;
}) {
  if (balance >= cost) {
    return (
      <Link href={href} className={btn(variant, size, className)}>
        {children} <Cost credits={cost} />
      </Link>
    );
  }
  return <GetCreditsButton cost={cost} balance={balance} what={what} variant={variant} size={size} className={className} />;
}

export function GetCreditsButton({
  cost,
  balance,
  what = "This",
  variant = "primary",
  size = "md",
  className = "",
}: {
  cost?: number;
  balance: number;
  what?: string;
  variant?: "primary" | "secondary";
  size?: Size;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const line = cost ? `${what} needs ${cost} credits. You have ${balance}.` : `You have ${balance} credits.`;
  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={btn(variant, size, className)}>
        Get credits <ArrowRight aria-hidden="true" className="size-5" />
      </button>
      <span className="text-sm text-muted">{line}</span>
      <GetCreditsSheet open={open} onClose={() => setOpen(false)} description={line} />
    </span>
  );
}

export function GetCreditsSheet({ open, onClose, description }: { open: boolean; onClose: () => void; description?: string }) {
  const plan = PLANS[learner.plan];
  const minor = isMinor(learner.dateOfBirth) && learner.guardian;
  const refill = plan.period === "daily" ? `Your plan credits refill to ${plan.periodCredits} at 00:00 IST, for free.` : "Your 30 free credits refill on the 1st of the month.";
  const row = "flex min-h-16 items-center gap-3 rounded-card-sm border border-border-subtle p-3 hover:border-line";
  return (
    <Dialog open={open} onClose={onClose} title="Get credits" description={description} variant="sheet">
      <ul className="flex flex-col gap-2">
        <li className="flex items-start gap-3 rounded-card-sm bg-sunken p-3">
          <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
          <span className="text-[15px] text-ink">
            {refill}
            <span className="block text-sm text-muted">Reading reports, your plan and revision tasks stay free in the meantime.</span>
          </span>
        </li>
        <li>
          <Link href="/credits/buy" onClick={onClose} className={row}>
            <Package aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Buy a credit pack</span>
              <span className="block text-sm text-muted">From ₹{CREDIT_PACKS[0].priceInr} for {CREDIT_PACKS[0].credits} credits · lasts 90 days</span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 text-muted" />
          </Link>
        </li>
        <li>
          <Link href="/billing/plans" onClick={onClose} className={row}>
            <Sparkles aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{plan.code === "pro" ? "Compare plans" : "Get more credits every day"}</span>
              <span className="block text-sm text-muted">Passes from ₹{PLANS.starter.priceInr} for 30 days</span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 text-muted" />
          </Link>
        </li>
      </ul>
      {minor && learner.guardian ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <UserCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {learner.guardian.guardianFirstName} approves and pays for packs and passes. Choosing one sends a request.
        </p>
      ) : null}
    </Dialog>
  );
}
