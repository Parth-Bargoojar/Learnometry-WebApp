import type { Metadata } from "next";
import { AiSettings } from "@/components/settings";
import { requireLearner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Explanation engine" };

export default async function AiSettingsPage() {
  const viewer = await requireLearner();
  return <AiSettings planCode={viewer.plan} initialEngine={viewer.learner.engine} />;
}
