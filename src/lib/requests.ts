"use client";

/**
 * Purchase approvals (D5, CONTEXT §6.1 `purchase_approvals`): a minor requests, the
 * guardian approves and pays or declines, requests expire after 7 days. The learner's
 * Billing page and the guardian's Approvals page read the same list.
 */
import { useCallback, useMemo } from "react";
import { TODAY, learner, purchaseRequests } from "./data";
import { APPROVAL_DAYS, addDays } from "./guardian";
import { SHARED, useShared } from "./local-store";
import type { PurchaseRequest } from "./types";
import type { CheckoutItem } from "./billing";

type Overrides = { created: PurchaseRequest[]; status: Record<string, Pick<PurchaseRequest, "status" | "decidedOn">> };
const EMPTY: Overrides = { created: [], status: {} };

export const OPEN: PurchaseRequest["status"][] = ["requested", "approved"];

export function usePurchaseRequests() {
  const [o, setO] = useShared<Overrides>(SHARED.requests, EMPTY);

  const list = useMemo(() => {
    const all = [...o.created, ...purchaseRequests].map((r) => ({ ...r, ...(o.status[r.id] ?? {}) }));
    // Past expiry and never decided → expired (the server job does this at 00:00 IST).
    return all.map((r) => (r.status === "requested" && r.expiresOn < TODAY ? { ...r, status: "expired" as const } : r));
  }, [o]);

  const request = useCallback(
    (item: CheckoutItem, amountInr: number) => {
      const r: PurchaseRequest = {
        id: `pr_${item.code}_${Date.now().toString(36)}`,
        learnerId: learner.id,
        itemType: item.kind,
        itemCode: item.code,
        label: item.title,
        amountInr,
        status: "requested",
        requestedOn: TODAY,
        expiresOn: addDays(TODAY, APPROVAL_DAYS),
      };
      setO((prev) => ({ ...prev, created: [r, ...prev.created] }));
      return r;
    },
    [setO],
  );

  const setStatus = useCallback(
    (id: string, status: PurchaseRequest["status"]) =>
      setO((prev) => ({ ...prev, status: { ...prev.status, [id]: { status, decidedOn: TODAY } } })),
    [setO],
  );

  /** Undo a decision within the same session (restores "requested"). */
  const reopen = useCallback(
    (id: string) =>
      setO((prev) => {
        const status = { ...prev.status };
        delete status[id];
        return { ...prev, status };
      }),
    [setO],
  );

  const openFor = useCallback((code: string) => list.find((r) => r.itemCode === code && r.status === "requested") ?? null, [list]);

  return { list, request, setStatus, reopen, openFor };
}
