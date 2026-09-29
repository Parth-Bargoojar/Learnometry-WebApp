import type { Metadata } from "next";
import { GuardianApprovals } from "@/components/guardian";

export const metadata: Metadata = { title: "Approvals" };

/** Purchase approvals — Web App Structure §8.18, D5: the guardian approves and pays. */
export default function GuardianApprovalsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 tabIndex={-1} className="font-display text-3xl text-ink outline-none">
        Approvals
      </h1>
      <GuardianApprovals />
    </div>
  );
}
