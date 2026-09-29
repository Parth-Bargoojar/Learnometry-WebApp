import type { Metadata } from "next";
import { TODAY } from "@/lib/data";
import { OfflineView } from "@/components/offline-view";

export const metadata: Metadata = { title: "Offline" };

/* Cached by the service worker at install; see public/sw.js. */
export default function OfflinePage() {
  return <OfflineView today={TODAY} />;
}
