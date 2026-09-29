import type { Metadata } from "next";
import { AdminHeader, TabLinks } from "@/components/admin-ui";
import { AbuseQueue } from "@/components/admin-ops";

export const metadata: Metadata = { title: "Security" };

/**
 * Abuse/security console — §8.19 (K10). Signals flag; people decide. Nothing is
 * suspended automatically: the system only rate-limits and blocks injected input.
 */
export default async function AdminSecurityPage(props: PageProps<"/admin/security">) {
  const { status } = await props.searchParams;
  const filter = status === "all" ? "all" : "open";
  return (
    <div>
      <AdminHeader title="Security" meta="Abuse flags from credit use, rate limits, input filters, coupons and duplicate-account checks." />
      <TabLinks
        label="Flag status"
        active={filter}
        tabs={[
          { key: "open", label: "Open", href: "/admin/security" },
          { key: "all", label: "All flags", href: "/admin/security?status=all" },
        ]}
      />
      <AbuseQueue filter={filter} />
    </div>
  );
}
