"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ADMIN, DEFAULT_BUDGET, breakerState, reasonError, type BreakerOverride, type BudgetConfig } from "@/lib/admin";
import { TODAY } from "@/lib/data";
import { adminUser, aiCostTodayInr, auditSeed, featureFlags, revenueAvgInr, type AuditEntry, type FeatureFlag } from "@/lib/admin-data";
import { SHARED, useShared } from "@/lib/local-store";
import { Dialog } from "./dialog";
import { btn } from "./ui";

/*
  Admin mutations (K2). Every change that affects a learner, content, money or
  configuration goes through <ReasonDialog>, which requires a written reason and
  appends an audit entry. `useShared` stands in for the admin API; the production
  write is one transaction: change + `audit_logs` row.
*/

/** Sample clock: today's date from the sample story, the real time of day. */
export function nowIso() {
  const d = new Date(Date.now() + 5.5 * 3_600_000);
  return `${TODAY}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00+05:30`;
}

export function useAudit(): AuditEntry[] {
  const [added] = useShared<AuditEntry[]>(SHARED.adminAudit, []);
  return useMemo(() => [...added, ...auditSeed].sort((a, b) => b.at.localeCompare(a.at)), [added]);
}

export function useAuditLog() {
  const [, set] = useShared<AuditEntry[]>(SHARED.adminAudit, []);
  return (e: Omit<AuditEntry, "id" | "at" | "actor">) =>
    set((prev) => [{ ...e, id: `au_${Date.now().toString(36)}`, at: nowIso(), actor: adminUser.id }, ...prev]);
}

/* ---------- Feature flags and the breaker (K8, K11) ---------- */

export type FlagPatch = Pick<FeatureFlag, "enabled" | "config" | "updatedBy" | "updatedAt">;

export function useFlags(): [FeatureFlag[], (key: string, patch: Omit<FlagPatch, "updatedBy" | "updatedAt">) => void] {
  const [patches, set] = useShared<Record<string, FlagPatch>>(SHARED.adminFlags, {});
  const flags = useMemo(() => featureFlags.map((f) => ({ ...f, ...patches[f.key] })), [patches]);
  const update = (key: string, patch: Omit<FlagPatch, "updatedBy" | "updatedAt">) =>
    set((prev) => ({ ...prev, [key]: { ...patch, updatedBy: adminUser.id, updatedAt: nowIso() } }));
  return [flags, update];
}

export function useBreaker() {
  const [flags] = useFlags();
  const budget = { ...DEFAULT_BUDGET, ...(flags.find((f) => f.key === "ai_budget")?.config as Partial<BudgetConfig> | null) };
  const ov = flags.find((f) => f.key === "ai_breaker_override");
  const override = (ov?.enabled ? (ov.config?.state as BreakerOverride) : null) ?? null;
  return { ...breakerState(aiCostTodayInr, revenueAvgInr, budget, override), budget, override, costInr: aiCostTodayInr, revenueAvgInr };
}

export const field = "mt-1.5 w-full rounded-input border border-border-subtle bg-surface px-3 text-sm text-ink focus:border-line aria-[invalid=true]:border-danger";
export const labelCls = "text-sm font-semibold text-ink";

/**
 * Confirm-with-reason dialog. `summary` states the change (before → after) so the
 * operator reads exactly what will happen; `validate` checks any extra fields.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  summary,
  children,
  confirmLabel,
  destructive = false,
  validate,
  onConfirm,
  reasonHint = "Saved in the audit log with your name.",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  summary?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  validate?: () => string | null;
  onConfirm: (reason: string) => void;
  reasonHint?: string;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field: "reason" | "other"; msg: string } | null>(null);

  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={title} description={description}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const other = validate?.();
          if (other) return setError({ field: "other", msg: other });
          const r = reasonError(reason);
          if (r) return setError({ field: "reason", msg: r });
          onConfirm(reason.trim());
          close();
        }}
        className="flex flex-col gap-4"
      >
        {summary ? <div className="rounded-card-sm border border-border-subtle bg-sunken px-4 py-3 text-sm text-ink">{summary}</div> : null}
        {children}
        {error?.field === "other" ? (
          <p role="alert" className="text-sm text-danger-text">
            {error.msg}
          </p>
        ) : null}
        <div>
          <label htmlFor={`${id}-reason`} className={labelCls}>
            Reason
          </label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={error?.field === "reason"}
            aria-describedby={`${id}-hint${error?.field === "reason" ? ` ${id}-err` : ""}`}
            className={`${field} py-2`}
          />
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {reasonHint} At least {ADMIN.reasonMin} characters.
          </p>
          {error?.field === "reason" ? (
            <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger-text">
              {error.msg}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} className={btn("ghost", "md")}>
            Cancel
          </button>
          <button type="submit" className={btn(destructive ? "destructive" : "primary", "md")}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
