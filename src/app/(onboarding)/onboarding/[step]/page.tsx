import { notFound } from "next/navigation";
import { Onboarding } from "@/components/onboarding";

const STEPS = ["about-you", "guardian", "waiting", "exam", "subjects", "exam-date", "study-time", "ready"];

export default async function OnboardingStep(props: PageProps<"/onboarding/[step]">) {
  const { step } = await props.params;
  if (!STEPS.includes(step)) notFound();
  return <Onboarding step={step} />;
}
