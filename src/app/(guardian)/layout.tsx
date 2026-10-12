import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuardianShell } from "@/components/guardian-shell";
import { homeFor, requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Guardian", template: "%s | Learnometry guardian" } };

/* Shell E — Guardian (Web App Structure §5.6). Guardians only; the portal reads real data from BE-11. */
export default async function GuardianLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer("/guardian");
  if (viewer.role !== "guardian") redirect(homeFor(viewer));
  return <GuardianShell>{children}</GuardianShell>;
}
