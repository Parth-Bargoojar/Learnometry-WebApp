import { notFound } from "next/navigation";
import { Onboarding } from "@/components/onboarding";

const STEPS = ["about-you", "guardian", "waiting", "child", "consent", "exam", "exam-date", "study-time", "ready", "invite-sent"];

export default async function OnboardingStep(props: PageProps<"/onboarding/[step]">) {
  const { step } = await props.params;
  if (!STEPS.includes(step)) notFound();
  return <Onboarding step={step} />;
}
