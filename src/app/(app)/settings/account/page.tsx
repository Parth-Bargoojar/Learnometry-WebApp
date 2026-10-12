import type { Metadata } from "next";
import { AccountSettings } from "@/components/settings";
import { requireLearner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const viewer = await requireLearner();
  return <AccountSettings email={viewer.email} />;
}
