import type { Metadata } from "next";
import { StudySettings } from "@/components/settings";
import { loadStudy } from "../data";

export const metadata: Metadata = { title: "Study setup" };

export default async function StudySettingsPage() {
  return <StudySettings initial={await loadStudy()} />;
}
