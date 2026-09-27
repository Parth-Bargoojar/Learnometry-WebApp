import type { Metadata } from "next";
import { DiagnosticIntro } from "@/components/diagnostic-intro";

export const metadata: Metadata = { title: "Physics diagnostic" };

export default function DiagnosticIntroPage() {
  return <DiagnosticIntro />;
}
