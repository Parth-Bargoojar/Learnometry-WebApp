/**
 * Product configuration — the launch values from Learnometry_WEB_APP_STRUCTURE_v1.md §1.9
 * and CONTEXT.md §0.1. The values and rules now live in `src/domains/*` (BE-0.4); this
 * module keeps the import path the UI already uses.
 */
export * from "@/domains/credits/costs";
export * from "@/domains/credits/rules";
export {
  confidenceFor,
  priorityFor,
  retestOutcome,
  severityFor,
  showsMasteryNumber,
} from "@/domains/learning/rules";
export type { Confidence, Priority, Severity } from "@/domains/learning/rules";
