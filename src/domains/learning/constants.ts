/*
  Every tunable of the learning algorithms in one place (ALGORITHMS.md). Changing any value
  here bumps ALG_VERSION so stored diagnoses, plans and retest results stay explainable.
*/
export const ALG_VERSION = "alg-v1";

/** Evidence window: the most recent items per concept (ALG §2). */
export const EVIDENCE_WINDOW = 12;

/** Mastery weights (ALG §3). */
export const RECENCY_DECAY = 0.85;
export const DIFFICULTY_WEIGHT = { easy: 0.8, medium: 1, hard: 1.2 } as const;
export const SOURCE_WEIGHT = {
  diagnostic: 1,
  deep: 1,
  retest: 1,
  practice: 0.7,
  /** A hint or explanation was used before the learner answered. */
  practice_assisted: 0.4,
} as const;
export const UNANSWERED_WEIGHT_FACTOR = 0.5;

/** Stored `confidence_score` per band (ALG §4). */
export const CONFIDENCE_SCORE = { insufficient: 0, low: 0.33, medium: 0.66, high: 1 } as const;

/** Forgetting time constant in days (ALG §6). */
export const FORGETTING_DAYS = 21;

/** Priority (ALG §7). */
export const IMPROVEMENT_BY_SEVERITY = {
  critical: 0.9,
  weak: 1,
  needs_work: 0.8,
  insufficient: 0.6,
  stable: 0.4,
  strong: 0.1,
} as const;
export const INSUFFICIENT_WEAKNESS = 0.5;
export const PREREQUISITE_BOOST = 0.5;
export const MIN_INTERVENTION_MINUTES = 15;

/** Error classification (ALG §5). */
export const CARELESS_TIME_SHARE = 0.25;
export const LATE_POSITION_SHARE = 0.2;
export const PREREQUISITE_WEAK_BELOW = 50;
export const WRONG_ANSWER_TOLERANCE_PCT = 1;
/** Tie-break order for the concept-level cause. */
export const CAUSE_TIE_ORDER = ["prerequisite", "conceptual", "calculation", "misread", "strategy", "careless", "time_pressure"] as const;

/** Diagnostic formats (ALG §8): items and minutes per exam track. */
export const DIAGNOSTIC_ITEMS = {
  full: { jee_main: 15, neet: 24, cbse_11: 20 },
  chapter: { jee_main: 8, neet: 12, cbse_11: 10 },
} as const;
export const DIAGNOSTIC_MINUTES = { full: 30, chapter: 15, deep: 60 } as const;
export const ITEMS_PER_CONCEPT = { full: 3, chapter: 3, deep: 6 } as const;

/** Retest (ALG §10). */
export const RETEST_ITEMS_PER_CONCEPT = 3;
export const RETEST_SECONDS_PER_ITEM = 180;
export const RETEST_DELTA = 10;
export const RETEST_MIN_ITEMS = 3;

/** Planning (ALG §11). */
export const CYCLE_DAYS = 7;
export const MAX_FOCUS_CONCEPTS = 3;
export const MIN_DAYS_FOR_RETEST = 3;
export const PRACTICE_SET_SIZE = 5;
export const DEFAULT_PRACTICE_MINUTES = 10;
export const OUTLINE_WEEKS = 4;

/** Abuse signal (ALG §12, K10): utilisation above this share on this many consecutive IST days. */
export const ABUSE_UTILISATION = 0.8;
export const ABUSE_DAYS = 7;
