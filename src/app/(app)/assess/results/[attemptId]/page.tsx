import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAttemptConfig, sampleDiagnosticResponses } from "@/lib/data";
import { Report } from "@/components/report";

export const metadata: Metadata = { title: "Diagnostic report" };

export default async function ResultsPage(props: PageProps<"/assess/results/[attemptId]">) {
  const { attemptId } = await props.params;
  const config = getAttemptConfig(attemptId);
  if (!config || config.kind !== "diagnostic") notFound();
  return (
    <Suspense>
      <Report config={config} fallback={sampleDiagnosticResponses} />
    </Suspense>
  );
}
