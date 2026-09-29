/**
 * Study-plan scheduling — ALGORITHMS.md §11. Pure: ranked concepts and the learner's daily
 * minutes go in, a dated task list comes out. The scheduler decides WHAT and WHEN; the LLM
 * may only word the tasks afterwards and cannot add, drop, move or resize them.
 */
import {
  CYCLE_DAYS,
  DEFAULT_PRACTICE_MINUTES,
  MAX_FOCUS_CONCEPTS,
  MIN_DAYS_FOR_RETEST,
  OUTLINE_WEEKS,
  PREREQUISITE_WEAK_BELOW,
  PRACTICE_SET_SIZE,
  RETEST_ITEMS_PER_CONCEPT,
  RETEST_SECONDS_PER_ITEM,
} from "@/domains/learning/constants";
import { severityFor, type Confidence, type Severity } from "@/domains/learning/rules";
import { addDays } from "@/domains/guardian/rules";
import { daysBetween } from "@/lib/iso-date";

export type TaskType = "learn" | "revise" | "practice" | "review" | "retest";

export interface RankedConcept {
  id: string;
  severity: Severity;
  estimatedMinutes: number;
  prerequisites: string[];
}

/** Mastery of any concept the plan may need to look up as a prerequisite. */
export interface KnownState {
  mastery: number;
  confidence: Confidence;
}

export interface ScheduleInput {
  /** Concepts by priority, highest first (ALG §7). */
  ranked: RankedConcept[];
  states: Record<string, KnownState>;
  /** Concept definitions for prerequisites that may not be in `ranked`. */
  conceptsById: Record<string, RankedConcept>;
  dailyMinutes: number;
  /** IST date, `YYYY-MM-DD`. */
  today: string;
  examDate?: string | null;
  /** Average expected seconds of practice items; drives practice minutes. */
  avgExpectedSeconds?: number;
}

export interface PlannedTask {
  conceptId: string;
  type: TaskType;
  minutes: number;
  /** Practice questions in the task. */
  questions?: number;
  /** IST date. */
  date: string;
  /** 1-based day of the cycle. */
  day: number;
  /** For a split task: which part of how many. */
  part?: { index: number; of: number };
}

export interface Schedule {
  cycleDays: number;
  focus: string[];
  tasks: PlannedTask[];
  /** Tasks that did not fit this cycle. */
  spill: Omit<PlannedTask, "date" | "day">[];
  /** Weeks 2–4: the next concepts by rank (outline only). */
  outline: string[][];
  retest: { date: string; concepts: string[]; minutes: number } | null;
}

const NEEDS_WORK: Severity[] = ["critical", "weak", "needs_work", "insufficient"];

export function cycleLength(today: string, examDate?: string | null): number {
  if (!examDate) return CYCLE_DAYS;
  const left = daysBetween(today, examDate);
  return Math.max(1, Math.min(CYCLE_DAYS, left));
}

/** Practice minutes = ceil(questions × avg seconds / 60 / 5) × 5; 10 for 5 questions by default. */
export function practiceMinutes(questions: number, avgExpectedSeconds?: number): number {
  if (!avgExpectedSeconds) return Math.round((questions / PRACTICE_SET_SIZE) * DEFAULT_PRACTICE_MINUTES);
  return Math.ceil((questions * avgExpectedSeconds) / 60 / 5) * 5;
}

/** Retest length for `n` concepts: 3 items each at 3 minutes (ALG §10). */
export const retestMinutes = (concepts: number) => (concepts * RETEST_ITEMS_PER_CONCEPT * RETEST_SECONDS_PER_ITEM) / 60;

/**
 * The focus concepts: up to 3 that need work, with a weak direct prerequisite inserted
 * before its dependent. A dependent that no longer fits drops to next week (ALG §11 step 2).
 */
export function pickFocus(input: Pick<ScheduleInput, "ranked" | "states" | "conceptsById">): string[] {
  const focus: string[] = [];
  const weakPrereqs = (c: RankedConcept) =>
    c.prerequisites.filter((p) => {
      const s = input.states[p];
      return s && s.confidence !== "insufficient" && s.mastery < PREREQUISITE_WEAK_BELOW && !focus.includes(p) && input.conceptsById[p];
    });
  for (const c of input.ranked) {
    if (focus.length >= MAX_FOCUS_CONCEPTS) break;
    if (!NEEDS_WORK.includes(c.severity) || focus.includes(c.id)) continue;
    const prereqs = weakPrereqs(c);
    const room = MAX_FOCUS_CONCEPTS - focus.length;
    if (prereqs.length + 1 <= room) focus.push(...prereqs, c.id);
    else if (prereqs.length > 0 && prereqs.length <= room) focus.push(...prereqs);
  }
  return focus;
}

interface Template {
  type: TaskType;
  minutes: (c: RankedConcept, avg?: number) => number;
  questions?: number;
  offset: number;
}

/** Task templates by severity, offsets in days from the concept's start (ALG §11 step 3). */
function templateFor(severity: Severity): Template[] {
  const practice = (offset: number): Template => ({ type: "practice", questions: PRACTICE_SET_SIZE, minutes: (_c, avg) => practiceMinutes(PRACTICE_SET_SIZE, avg), offset });
  switch (severity) {
    case "critical":
    case "weak":
      return [{ type: "learn", minutes: (c) => c.estimatedMinutes, offset: 0 }, practice(1), { type: "revise", minutes: () => 10, offset: 3 }, practice(4)];
    case "needs_work":
      return [{ type: "revise", minutes: () => 15, offset: 0 }, practice(1), practice(3)];
    default:
      return [practice(0), { type: "review", minutes: () => 10, offset: 1 }];
  }
}

/** Build the weekly cycle (ALG §11). Never exceeds `dailyMinutes` on any day. */
export function buildSchedule(input: ScheduleInput): Schedule {
  const L = cycleLength(input.today, input.examDate);
  const withRetest = L >= MIN_DAYS_FOR_RETEST;
  const workDays = withRetest ? L - 1 : L;
  const focus = pickFocus(input);
  const used = new Array<number>(workDays + 1).fill(0); // 1-based
  const tasks: PlannedTask[] = [];
  const spill: Schedule["spill"] = [];
  const firstDay = new Map<string, number>();
  const dateOf = (day: number) => addDays(input.today, day - 1);

  for (const id of focus) {
    const ranked = input.ranked.find((c) => c.id === id);
    const concept = ranked ?? input.conceptsById[id];
    const state = input.states[id];
    const severity = ranked?.severity ?? (state ? severityFor(state.mastery, state.confidence) : "weak");
    // A dependent starts no earlier than its prerequisite's first task.
    const prereqStart = Math.max(1, ...concept.prerequisites.map((p) => firstDay.get(p) ?? 1));
    let previousDay = prereqStart;

    for (const t of templateFor(severity)) {
      const total = t.minutes(concept, input.avgExpectedSeconds);
      const partCount = Math.max(1, Math.ceil(total / input.dailyMinutes));
      const earliest = Math.max(prereqStart + t.offset, previousDay);
      let remaining = total;

      for (let part = 1; part <= partCount; part++) {
        const minutes = Math.min(remaining, input.dailyMinutes);
        let day = -1;
        for (let d = earliest; d <= workDays; d++) {
          if (used[d] + minutes <= input.dailyMinutes) {
            day = d;
            break;
          }
        }
        const base = { conceptId: id, type: t.type, minutes, ...(t.questions ? { questions: t.questions } : {}), ...(partCount > 1 ? { part: { index: part, of: partCount } } : {}) };
        if (day === -1) {
          spill.push(base);
        } else {
          used[day] += minutes;
          tasks.push({ ...base, day, date: dateOf(day) });
          previousDay = Math.max(previousDay, day);
          if (!firstDay.has(id)) firstDay.set(id, day);
        }
        remaining -= minutes;
      }
    }
  }

  tasks.sort((a, b) => a.day - b.day);

  let retest: Schedule["retest"] = null;
  if (withRetest && focus.length > 0) {
    const maxConcepts = Math.max(1, Math.floor(input.dailyMinutes / retestMinutes(1)));
    const concepts = focus.slice(0, maxConcepts);
    const minutes = retestMinutes(concepts.length);
    retest = { date: dateOf(L), concepts, minutes };
    tasks.push({ conceptId: concepts[0], type: "retest", minutes, date: dateOf(L), day: L });
  }

  const weeks = Math.min(OUTLINE_WEEKS, input.examDate ? Math.max(1, Math.ceil(daysBetween(input.today, input.examDate) / CYCLE_DAYS)) : OUTLINE_WEEKS);
  const rest = input.ranked.filter((c) => !focus.includes(c.id) && NEEDS_WORK.includes(c.severity)).map((c) => c.id);
  const outline: string[][] = [];
  for (let w = 0; w < weeks - 1; w++) {
    const chunk = rest.slice(w * MAX_FOCUS_CONCEPTS, (w + 1) * MAX_FOCUS_CONCEPTS);
    if (chunk.length) outline.push(chunk);
  }

  return { cycleDays: L, focus, tasks, spill, outline, retest };
}

/** Minutes planned on each day, for invariant checks and the week strip. */
export function minutesByDay(tasks: PlannedTask[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const t of tasks) out[t.day] = (out[t.day] ?? 0) + t.minutes;
  return out;
}
