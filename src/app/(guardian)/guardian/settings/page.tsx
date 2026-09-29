import type { Metadata } from "next";
import { GuardianSettings } from "@/components/guardian";

export const metadata: Metadata = { title: "Consent & settings" };

/** Guardian settings — consent records, withdrawal, account (Web App Structure §8.18). */
export default function GuardianSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 tabIndex={-1} className="font-display text-3xl text-ink outline-none">
        Consent &amp; settings
      </h1>
      <GuardianSettings />
    </div>
  );
}
