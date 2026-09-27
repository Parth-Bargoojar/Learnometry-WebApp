import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAttemptConfig, sampleRetestResponses } from "@/lib/data";
import { RetestResult } from "@/components/outcomes";

export const metadata: Metadata = { title: "Retest result" };

export default async function RetestResultPage(props: PageProps<"/assess/retests/[retestId]/result">) {
  const { retestId } = await props.params;
  const config = getAttemptConfig(retestId);
  if (!config || config.kind !== "retest") notFound();
  return <RetestResult config={config} fallback={sampleRetestResponses} />;
}
