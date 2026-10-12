import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";
import { requireLearner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Assessment" };

/* Focus shell (Web App Structure §5.5): no navigation, no notifications, no mascot. Signed-in, onboarded learners only. */
export default async function FocusLayout({ children }: LayoutProps<"/">) {
  await requireLearner();
  return <ThemeProvider>{children}</ThemeProvider>;
}
