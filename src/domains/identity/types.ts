import type { LearnerStep } from "./rules";

/* Plain types shared by the onboarding service and its client screens (no server-only imports). */

export type OnboardingNext = LearnerStep | "ready" | "minor-hold";

export interface OnboardingResult {
  next: OnboardingNext;
  /** Welcome credits granted by this call (only the final step, only once). */
  welcomeCredits: number;
}

/** What the onboarding screens prefill and where they resume. */
export interface OnboardingAnswers {
  step: OnboardingNext;
  completed: boolean;
  held: boolean;
  dob: { day: string; month: string; year: string } | null;
  classLabel: string | null;
  exam: string | null;
  examMonth: string | null;
  examYear: string | null;
  notSure: boolean;
  minutes: number | null;
}
