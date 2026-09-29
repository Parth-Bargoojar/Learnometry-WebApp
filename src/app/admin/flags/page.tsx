import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { FlagList } from "@/components/admin-ops";

export const metadata: Metadata = { title: "Feature flags" };

/** Feature flags — §8.19 (K11): toggle, config JSON with validation, last changed by. */
export default function AdminFlagsPage() {
  return (
    <div>
      <AdminHeader title="Feature flags" meta="Every change needs a reason and is audit-logged. Kill switches turn off an expensive or risky path without a deploy." />
      <FlagList />
    </div>
  );
}
