import type { Metadata } from "next";
import { ProfileSettings } from "@/components/settings";
import { loadProfile } from "../data";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  return <ProfileSettings initial={await loadProfile()} />;
}
