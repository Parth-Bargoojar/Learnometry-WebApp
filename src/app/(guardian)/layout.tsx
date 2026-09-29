import type { Metadata } from "next";
import { GuardianShell } from "@/components/guardian-shell";

export const metadata: Metadata = { title: { default: "Guardian", template: "%s | Learnometry guardian" } };

/* Shell E — Guardian (Web App Structure §5.6). */
export default function GuardianLayout({ children }: LayoutProps<"/">) {
  return <GuardianShell>{children}</GuardianShell>;
}
