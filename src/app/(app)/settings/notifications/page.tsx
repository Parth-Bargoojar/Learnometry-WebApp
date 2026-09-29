import type { Metadata } from "next";
import { NotificationSettings } from "@/components/settings";

export const metadata: Metadata = { title: "Notification settings" };

export default function NotificationSettingsPage() {
  return <NotificationSettings />;
}
