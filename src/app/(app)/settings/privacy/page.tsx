import type { Metadata } from "next";
import { PrivacySettings } from "@/components/settings";

export const metadata: Metadata = { title: "Privacy & data" };

export default function PrivacySettingsPage() {
  return <PrivacySettings />;
}
