import { ConsentFlow } from "@/components/consent-flow";

export default async function ConsentPage(props: PageProps<"/consent/[token]">) {
  const { token } = await props.params;
  return <ConsentFlow token={token} />;
}
