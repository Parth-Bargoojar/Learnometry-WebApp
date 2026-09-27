import { notFound } from "next/navigation";
import { getAttemptConfig } from "@/lib/data";
import { Player } from "@/components/player";

export default async function AttemptPage(props: PageProps<"/attempt/[attemptId]">) {
  const { attemptId } = await props.params;
  const config = getAttemptConfig(attemptId);
  if (!config) notFound();
  return <Player config={config} />;
}
