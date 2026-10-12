import type { CreditState, PlanCode } from "@/lib/config";

/*
  What the signed-in person looks like to the app. `Viewer` is built on the server from the
  session and the database (lib/auth/session.ts). `ShellViewer` is the small serialisable slice
  client components get through `ViewerProvider` (BE-D12) — never the rest.
*/

export type ConsentState = "not_required" | "pending" | "verified" | "declined" | "withdrawn" | "expired";

export interface CreditBucketView {
  key: "daily_plan" | "free_monthly" | "promotional" | "purchased";
  label: string;
  amount: number;
  note: string;
}

export interface Viewer {
  userId: string;
  email: string;
  role: "learner" | "guardian" | "admin";
  status: "active" | "consent_pending" | "suspended" | "deletion_pending";
  displayName: string | null;
  firstName: string;
  lastName: string;
  initials: string;
  dateOfBirth: string | null;
  age: number | null;
  isMinor: boolean;
  consent: ConsentState;
  /** Purchases by a minor with verified consent become approval requests (D5). */
  needsApproval: boolean;
  deactivatedAt: Date | null;
  /** Authentication assurance level of this session (`aal2` = second factor used). */
  aal: string | null;
  /** Unix seconds of the last TOTP check in this session. */
  totpVerifiedAt: number | null;
  learner: LearnerView | null;
  plan: PlanCode;
  balance: number;
  creditState: CreditState;
  buckets: CreditBucketView[];
  unreadCount: number;
}

export interface LearnerView {
  id: string;
  examCode: "jee_main" | "neet" | "cbse_11" | null;
  examName: string | null;
  subject: string | null;
  unit: string | null;
  targetDate: string | null;
  dailyMinutes: number;
  classLevel: "class_11" | "class_12" | "dropper" | "other" | null;
  engine: "fast" | "standard";
  theme: "system" | "light" | "dark";
  onboardingCompleted: boolean;
  onboardingStep: string | null;
  activatedAt: Date | null;
}

/** The slice of the viewer that client components (shell, credit gate, settings) may hold. */
export interface ShellViewer {
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
  examName: string | null;
  plan: PlanCode;
  balance: number;
  creditState: CreditState;
  buckets: CreditBucketView[];
  periodCredits: number;
  unreadCount: number;
  isMinor: boolean;
  needsApproval: boolean;
  theme: "system" | "light" | "dark";
}
