import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAttemptConfig, sampleDiagnosticResponses } from "@/lib/data";
import { AnswerReview } from "@/components/answer-review";

export const metadata: Metadata = { title: "Answer review" };

export default async function ReviewPage(props: PageProps<"/assess/results/[attemptId]/review">) {
  const { attemptId } = await props.params;
  const config = getAttemptConfig(attemptId);
  if (!config) notFound();
  return (
    <Suspense>
      <AnswerReview config={config} fallback={sampleDiagnosticResponses} />
    </Suspense>
  );
}
