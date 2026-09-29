import { SettingsNav } from "@/components/settings";

/* Settings (Web App Structure §8.16): sub-nav 240px + form panel 560px on desktop; list → detail below 1024px. */
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <SettingsNav />
      <div className="min-w-0 max-w-[560px]">{children}</div>
    </div>
  );
}
