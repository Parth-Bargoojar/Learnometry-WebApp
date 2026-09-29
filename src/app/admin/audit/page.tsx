import type { Metadata } from "next";
import type { AuditEntry } from "@/lib/admin-data";
import { AdminHeader, TabLinks } from "@/components/admin-ui";
import { AuditTable } from "@/components/admin-ops";

export const metadata: Metadata = { title: "Audit log" };

const TYPES: { key: AuditEntry["resourceType"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "learner", label: "Learners" },
  { key: "question", label: "Questions" },
  { key: "curriculum", label: "Curriculum" },
  { key: "refund", label: "Refunds" },
  { key: "abuse_flag", label: "Abuse" },
  { key: "flag", label: "Flags" },
  { key: "breaker", label: "Breaker" },
];

/** Global audit log (K2): every admin action, append-only, filterable by resource. */
export default async function AdminAuditPage(props: PageProps<"/admin/audit">) {
  const { type } = await props.searchParams;
  const active = TYPES.find((t) => t.key === type)?.key ?? "all";
  return (
    <div>
      <AdminHeader title="Audit log" meta="Who changed what, when and why. Kept for 1 year." />
      <TabLinks label="Resource type" active={active} tabs={TYPES.map((t) => ({ key: t.key, label: t.label, href: t.key === "all" ? "/admin/audit" : `/admin/audit?type=${t.key}` }))} />
      <AuditTable type={active === "all" ? undefined : active} />
    </div>
  );
}
