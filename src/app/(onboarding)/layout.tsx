import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";

export const metadata: Metadata = { title: "Set up" };

/* Onboarding shell (Web App Structure §5.3): stepper, no app navigation. */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
