import type { Metadata } from "next";
import { AiSettings } from "@/components/settings";

export const metadata: Metadata = { title: "Explanation engine" };

export default function AiSettingsPage() {
  return <AiSettings />;
}
