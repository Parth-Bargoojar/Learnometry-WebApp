import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications";

export const metadata: Metadata = { title: "Notifications" };

/** Notifications — Web App Structure §8.17 (the bell shows the latest 5). */
export default function NotificationsPage() {
  return <NotificationList />;
}
