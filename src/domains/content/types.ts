import type { QuestionStatus, ValidationResult, ValidatorType } from "@/domains/admin/rules";

/* Shapes the admin console receives (BE-3.4). Pure types, safe for components to import. */

export interface ValidationView {
  result: ValidationResult;
  note?: string;
}

export interface AdminQuestion {
  id: string;
  slug: string;
  exam: string;
  examCode: string;
  chapterId: string;
  chapterName: string;
  conceptId: string;
  conceptName: string;
  difficulty: "easy" | "medium" | "hard";
  use: "Diagnostic" | "Practice" | "Retest";
  status: QuestionStatus;
  statusNote?: string;
  stem: string;
  questionType: string;
  options: { key: string; text: string; misconception?: string }[] | null;
  answer: Record<string, unknown>;
  solution: string[];
  hint: string | null;
  expectedSeconds: number;
  versionNumber: number;
  source: "original" | "licensed";
  learningObjective: string;
  validations: Record<ValidatorType, ValidationView>;
  served: number;
  correctRate: number | null;
}

export interface AdminQuestionDetail extends AdminQuestion {
  versions: { n: number; at: string; reason: string }[];
}
