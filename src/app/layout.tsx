import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { PwaBoot } from "@/components/pwa-boot";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Learnometry", template: "%s | Learnometry" },
  description: "Your Learnometry diagnostic, study plan and progress.",
  applicationName: "Learnometry",
  /* Everything behind login is private; nothing here belongs in a search index. */
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  /* iOS "Add to Home Screen": launch full screen under the app's own name. */
  appleWebApp: { capable: true, title: "Learnometry", statusBarStyle: "default" },
  formatDetection: { telephone: false, address: false, email: false },
};

/* Zoom stays enabled: capping it is an accessibility failure (DS §26). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Lets the bottom bar's safe-area padding work on notched phones when installed. */
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* data-theme is written before paint by the script below, hence the warning suppression. */
    <html lang="en-IN" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-ink" suppressHydrationWarning>
        <Script src="/theme.js" strategy="beforeInteractive" />
        <PwaBoot />
        {children}
      </body>
    </html>
  );
}
