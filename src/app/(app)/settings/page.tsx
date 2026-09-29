import type { Metadata } from "next";
import { ProfileSettings, SettingsList } from "@/components/settings";

export const metadata: Metadata = { title: "Settings" };

/** Below 1024px: the list screen. From 1024px the sub-nav is visible, so the panel shows Profile. */
export default function SettingsIndexPage() {
  return (
    <>
      <div className="lg:hidden">
        <SettingsList />
      </div>
      <div className="hidden lg:block">
        <ProfileSettings />
      </div>
    </>
  );
}
