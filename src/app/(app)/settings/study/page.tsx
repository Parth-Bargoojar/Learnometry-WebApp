import type { Metadata } from "next";
import { StudySettings } from "@/components/settings";

export const metadata: Metadata = { title: "Study setup" };

export default function StudySettingsPage() {
  return <StudySettings />;
}
