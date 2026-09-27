import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";

export const metadata: Metadata = { title: "Assessment" };

/* Focus shell (Web App Structure §5.5): no navigation, no notifications, no mascot. */
export default function FocusLayout({ children }: LayoutProps<"/">) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
