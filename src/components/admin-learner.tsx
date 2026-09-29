"use client";

import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ADMIN, adjustmentError, stamp } from "@/lib/admin";
import {
  ACCOUNT_STATUS_LABEL,
  BUCKET_LABEL,
  admins,
  type AccountStatus,
  type AdminLearner,
  type LedgerRow,
} from "@/lib/admin-data";
import { addDays } from "@/lib/guardian";
import { dayMonth, signed } from "@/lib/format";
import { SHARED, useShared } from "@/lib/local-store";
import { ReasonDialog, field, labelCls, nowIso, useAuditLog } from "./admin-core";
import { Pill, num, td, th, type Tone } from "./admin-ui";
import { useToast } from "./toast";
import { btn } from "./ui";

type LearnerPatch = { status?: AccountStatus; timerMultiplier?: AdminLearner["timerMultiplier"] };

export function useLearnerPatch(id: string) {
  const [all, set] = useShared<Record<string, LearnerPatch>>(SHARED.adminLearners, {});
  const patch = all[id] ?? {};
  const update = (p: LearnerPatch) => set((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  return [patch, update] as const;
}

const STATUS_TONE: Record<AccountStatus, Tone> = { active: "success", consent_pending: "warning", invited: "outline", suspended: "danger", deletion_pending: "neutral" };

export function AccountStatusPill({ learner }: { learner: AdminLearner }) {
  const [patch] = useLearnerPatch(learner.id);
  const status = patch.status ?? learner.status;
  return <Pill tone={STATUS_TONE[status]}>{ACCOUNT_STATUS_LABEL[status]}</Pill>;
}

/** K2: opening a learner record is itself logged (DPDP accountability), once per browser session. */
export function LogView({ learnerId, name }: { learnerId: string; name: string }) {
  const log = useAuditLog();
  useEffect(() => {
    const key = `lm-admin-viewed:${learnerId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    log({ action: "learner.viewed", resourceType: "learner", resourceId: learnerId, summary: `Opened ${name}'s record` });
    // Logged once per mount of the record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);
  return null;
}

export function SuspensionControl({ learner }: { learner: AdminLearner }) {
  const [patch, update] = useLearnerPatch(learner.id);
  const log = useAuditLog();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if ((patch.status ?? learner.status) !== "suspended") return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "sm")}>
        Reinstate account
      </button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Reinstate ${learner.firstName}'s account?`}
        summary="They can sign in again at once, and paused pass time resumes. They are emailed."
        confirmLabel="Reinstate"
        onConfirm={(reason) => {
          update({ status: "active" });
          log({ action: "learner.reinstated", resourceType: "learner", resourceId: learner.id, summary: "Suspended → Active", reason });
          toast.show("Account reinstated");
        }}
      />
      {toast.node}
    </>
  );
}

/* ---------- Timer accommodation (§1.9: 1.25× or 1.5×, set by support) ---------- */

const MULTIPLIERS = [1, 1.25, 1.5] as const;

export function TimerAccommodation({ learner }: { learner: AdminLearner }) {
  const [patch, update] = useLearnerPatch(learner.id);
  const log = useAuditLog();
  const toast = useToast();
  const current = patch.timerMultiplier ?? learner.timerMultiplier;
  const [next, setNext] = useState<AdminLearner["timerMultiplier"] | null>(null);
  return (
    <div>
      <p className="text-xs font-semibold text-muted" id="timer-l">
        Extra-time accommodation
      </p>
      <div role="group" aria-labelledby="timer-l" className="mt-1.5 inline-flex gap-1 rounded-btn border border-border-subtle bg-sunken p-1">
        {MULTIPLIERS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={current === m}
            disabled={current === m}
            onClick={() => setNext(m)}
            className={`h-9 rounded-[8px] border px-3 text-sm font-semibold tabular-nums disabled:cursor-default ${
              current === m ? "border-line bg-surface text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {m}×
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">Applies to timed diagnostics and retests started after the change.</p>
      <ReasonDialog
        open={next !== null}
        onClose={() => setNext(null)}
        title="Change the timer?"
        summary={
          <>
            Timer {current}× → <strong>{next}×</strong>. A 30-minute diagnostic becomes {Math.round(30 * (next ?? 1))} minutes.
          </>
        }
        reasonHint="Include the support ticket number."
        confirmLabel="Change timer"
        onConfirm={(reason) => {
          update({ timerMultiplier: next! });
          log({ action: "learner.timer_multiplier", resourceType: "learner", resourceId: learner.id, summary: `Timer ${current}× → ${next}×`, reason });
          toast.show(`Timer set to ${next}×`);
        }}
      />
      {toast.node}
    </div>
  );
}

/* ---------- Credit ledger + adjustment (K4) ---------- */

const TYPE_LABEL: Record<LedgerRow["type"], string> = {
  subscription_grant: "Plan grant",
  promotion_grant: "Promotion",
  purchase: "Purchase",
  consumption: "Spend",
  refund: "Refund",
  expiration: "Expired",
  adjustment: "Adjustment",
  reversal: "Reversal",
};

export function CreditLedger({ learner, rows }: { learner: AdminLearner; rows: LedgerRow[] }) {
  const [adjustments, set] = useShared<Record<string, LedgerRow[]>>(SHARED.adminCredits, {});
  const log = useAuditLog();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"grant" | "deduct">("grant");
  const [amount, setAmount] = useState("");

  const mine = adjustments[learner.id] ?? [];
  const all = [...mine, ...rows].sort((a, b) => b.at.localeCompare(a.at));
  const balance = learner.credits + mine.reduce((s, r) => s + r.amount, 0);
  const n = Number(amount);
  const value = dir === "grant" ? n : -n;
  const disabled = learner.status === "invited" || learner.status === "deletion_pending";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <dl className="flex gap-8">
          <div>
            <dt className="text-xs font-semibold text-muted">Balance</dt>
            <dd className="mt-1 font-display text-3xl tabular-nums text-ink">{balance}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">Adjusted by admins</dt>
            <dd className="mt-1 font-display text-3xl tabular-nums text-ink">{signed(mine.reduce((s, r) => s + r.amount, 0))}</dd>
          </div>
        </dl>
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={btn("primary", "sm")}>
          Adjust credits
        </button>
      </div>

      {all.length ? (
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Credit ledger</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>When (IST)</th>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Bucket</th>
                <th scope="col" className={th}>Description</th>
                <th scope="col" className={`${th} ${num}`}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(r.at)}</td>
                  <td className={td}>
                    <Pill tone={r.type === "adjustment" ? "info" : "neutral"}>{TYPE_LABEL[r.type]}</Pill>
                  </td>
                  <td className={td}>{BUCKET_LABEL[r.bucket]}</td>
                  <td className={td}>
                    {r.description}
                    {r.reason ? <span className="block text-xs text-muted">{admins[r.actor ?? ""] ?? r.actor}: {r.reason}</span> : null}
                  </td>
                  <td className={`${td} ${num} font-semibold ${r.amount > 0 ? "text-success-text" : "text-ink"}`}>{signed(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">The ledger is append-only: corrections are new rows, never edits.</p>
        </div>
      ) : (
        <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">No credit activity yet.</p>
      )}

      <ReasonDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setAmount("");
          setDir("grant");
        }}
        title="Adjust credits"
        description={`${learner.firstName} ${learner.lastName} · balance ${balance}`}
        validate={() => adjustmentError(value, balance)}
        reasonHint="The learner sees “Adjustment by Learnometry support”; this reason stays in the audit log."
        confirmLabel={n > 0 ? `${dir === "grant" ? "Grant" : "Deduct"} ${n} credits` : "Adjust"}
        destructive={dir === "deduct"}
        summary={
          n > 0 ? (
            dir === "grant" ? (
              <>Balance {balance} → <strong>{balance + n}</strong>. Added as promotional credits that expire on {dayMonth(addDays(nowIso().slice(0, 10), ADMIN.adjustGrantExpiryDays))}.</>
            ) : (
              <>Balance {balance} → <strong>{balance - n}</strong>. Taken from the soonest-expiring credits first.</>
            )
          ) : null
        }
        onConfirm={(reason) => {
          const row: LedgerRow = {
            id: `adj_${Date.now().toString(36)}`,
            at: nowIso(),
            type: "adjustment",
            bucket: dir === "grant" ? "promotional" : "daily_plan",
            amount: value,
            description: "Adjustment by Learnometry support",
            actor: "usr_admin_aarav",
            reason,
          };
          set((prev) => ({ ...prev, [learner.id]: [row, ...(prev[learner.id] ?? [])] }));
          log({ action: "credits.adjusted", resourceType: "learner", resourceId: learner.id, summary: `${signed(value)} credits (${dir === "grant" ? "promotional" : "deduction"})`, reason });
          toast.show(`${signed(value)} credits applied`);
        }}
      >
        <fieldset>
          <legend className={labelCls}>Direction</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["grant", "deduct"] as const).map((d) => (
              <label key={d} className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-btn border text-sm font-semibold ${dir === d ? "border-2 border-line bg-surface text-ink" : "border-border-subtle text-muted"}`}>
                <input type="radio" name={`${id}-dir`} value={d} checked={dir === d} onChange={() => setDir(d)} className="sr-only" />
                {d === "grant" ? <Plus aria-hidden="true" className="size-4" /> : <Minus aria-hidden="true" className="size-4" />}
                {d === "grant" ? "Grant" : "Deduct"}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}-amt`} className={labelCls}>
            Credits
          </label>
          <input id={`${id}-amt`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={`${field} h-11`} />
          <p className="mt-1 text-xs text-muted">Up to {ADMIN.adjustMax} in one adjustment.</p>
        </div>
      </ReasonDialog>
      {toast.node}
    </>
  );
}
