import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAttemptConfig } from "@/lib/data";
import { PracticeResults } from "@/components/outcomes";

export const metadata: Metadata = { title: "Practice results" };

export default async function PracticeResultsPage(props: PageProps<"/practice/results/[attemptId]">) {
  const { attemptId } = await props.params;
  const config = getAttemptConfig(attemptId);
  if (!config || config.kind !== "practice") notFound();
  return <PracticeResults config={config} />;
}
