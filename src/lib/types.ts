import type { Confidence, PlanCode, Priority, Severity } from "./config";

export type ErrorCategory =
  | "conceptual"
  | "prerequisite"
  | "calculation"
  | "misread"
  | "strategy"
  | "careless"
  | "time_pressure";

export interface Chapter {
  id: string;
  name: string;
  ncert: string;
}

export interface Concept {
  id: string;
  name: string;
  chapterId: string;
  topic: string;
  examWeight: number; // 0–1, JEE Main track
  prerequisites: string[];
  estimatedMinutes: number;
}

export interface ConceptState {
  conceptId: string;
  mastery: number; // 0–100
  scoredItems: number;
  recentCorrect: number;
  recentTotal: number;
  avgSeconds: number;
  expectedSeconds: number;
  priorityScore: number; // 0–1
  lastPracticed: string | null; // ISO date
  baselineMastery: number | null;
  errors: Partial<Record<ErrorCategory, number>>;
}

export interface Option {
  key: "A" | "B" | "C" | "D";
  text: string;
}

export interface Question {
  id: string;
  conceptId: string;
  type: "mcq" | "numerical";
  stem: string; // `$…$` inline and `$$…$$` display math
  options?: Option[];
  answer: string; // option key, or the numeric value as text
  tolerance?: number;
  expectedSeconds: number;
  difficulty: "easy" | "medium" | "hard";
  solution: string;
  hint?: string;
  /** Interpretation used by the mock diagnosis stage 3 when this item is missed. */
  missCause?: ErrorCategory;
}

export interface Response {
  questionId: string;
  answer: string | null;
  seconds: number;
  marked?: boolean;
  confidence?: number;
}

export type AttemptKind = "diagnostic" | "practice" | "retest";

export interface AttemptConfig {
  id: string;
  kind: AttemptKind;
  title: string;
  subtitle: string;
  durationSeconds: number | null; // null = untimed (practice)
  questionIds: string[];
  marking: { correct: number; incorrect: number };
  targetConceptId?: string;
  goal?: string;
}

export interface WeaknessFinding {
  conceptId: string;
  severity: Severity;
  confidence: Confidence;
  priority: Priority;
  mastery: number;
  correct: number;
  total: number;
  marks: ("correct" | "incorrect" | "unanswered")[];
  avgSeconds: number;
  expectedSeconds: number;
  cause: ErrorCategory | null;
  causeText: string;
  next: string;
  minutes: number;
}

export type TaskType = "learn" | "revise" | "practice" | "review" | "retest";
export type TaskStatus = "pending" | "completed" | "skipped";

export interface PlanTask {
  id: string;
  conceptId: string;
  date: string; // ISO date
  type: TaskType;
  priority: Priority;
  minutes: number;
  action: string;
  then?: string;
  reviewOn?: string;
  status: TaskStatus;
  practiceQuestions?: number;
}

export interface Learner {
  firstName: string;
  lastName: string;
  email: string;
  exam: string;
  subject: string;
  unit: string;
  examDate: string;
  dailyMinutes: number;
  plan: PlanCode;
  engine: "fast" | "standard";
  passEnds: string;
  autoRenew: boolean;
}

export interface CreditTxn {
  id: string;
  date: string;
  description: string;
  amount: number;
  bucket: "Plan" | "Welcome" | "Promotional" | "Purchased" | "Free monthly";
}

export interface ReportSummary {
  attemptId: string;
  date: string;
  kind: AttemptKind;
  title: string;
  score: number;
  max: number;
  status: "ready" | "processing" | "failed";
}
