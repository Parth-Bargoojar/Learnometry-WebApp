import { notFound, redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding";
import { loadWelcomeCredits } from "@/domains/credits/queries";
import { getOnboarding } from "@/domains/identity/service";
import { LEARNER_STEPS, MINOR_ONLY_STEPS, onboardingRedirect } from "@/domains/identity/rules";
import { homeFor, requireViewer } from "@/lib/auth/session";

const KNOWN = new Set<string>([...LEARNER_STEPS, ...MINOR_ONLY_STEPS, "ready", "minor-hold"]);

/**
 * One onboarding step. The server decides whether this step may be shown: a learner can go
 * back but not skip ahead, finished learners go to the dashboard, and a minor on hold sees
 * only the hold screen (BE-D50). Guardians set up their child in BE-11.
 */
export default async function OnboardingStep(props: PageProps<"/onboarding/[step]">) {
  const { step } = await props.params;
  if (!KNOWN.has(step)) notFound();

  const viewer = await requireViewer(`/onboarding/${step}`);
  if (viewer.role !== "learner") redirect(homeFor(viewer));

  const answers = await getOnboarding(viewer.userId);
  const resume = answers.step === "minor-hold" ? "about-you" : answers.step;
  const to = onboardingRedirect(step, { held: answers.held, completed: answers.completed, resume });
  if (to) redirect(to);

  const welcome = step === "ready" && viewer.learner ? await loadWelcomeCredits(viewer.userId, viewer.learner.id) : 0;
  return <Onboarding step={step} initial={answers} welcomeCredits={welcome} />;
}
