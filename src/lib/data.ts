/**
 * Sample data for the app build — JEE Main track, Physics, Class 11 Mechanics
 * (launch wedge D3). Everything here stands in for the API responses in
 * CONTEXT.md §7 and is shaped like them, so pages swap `data.ts` for fetch calls
 * without layout changes. Questions are real and their answers are correct
 * (g = 10 m/s², sin 37° = 0.6, sin 53° = 0.8).
 */
import type {
  AttemptConfig,
  Chapter,
  Concept,
  ConceptState,
  CreditTxn,
  Learner,
  PlanTask,
  Question,
  ReportSummary,
  Response,
} from "./types";
import { COST } from "./config";

/** The sample story is anchored to this date so every relative label stays coherent. */
export const TODAY = "2026-09-27";

export const learner: Learner = {
  firstName: "Rohan",
  lastName: "Mehta",
  email: "rohan.mehta@example.com",
  exam: "JEE Main",
  subject: "Physics",
  unit: "Class 11 Mechanics",
  examDate: "2027-01-22",
  dailyMinutes: 60,
  plan: "starter",
  engine: "standard",
  passEnds: "2026-10-19",
  autoRenew: false,
};

export const chapters: Chapter[] = [
  { id: "ch-plane", name: "Motion in a Plane", ncert: "NCERT Class 11 Physics Part I, Ch. 3" },
  { id: "ch-lom", name: "Laws of Motion", ncert: "NCERT Class 11 Physics Part I, Ch. 4" },
  { id: "ch-wep", name: "Work, Energy and Power", ncert: "NCERT Class 11 Physics Part I, Ch. 5" },
];

export const concepts: Concept[] = [
  { id: "vectors", name: "Resolving vectors into components", chapterId: "ch-plane", topic: "Vectors", examWeight: 0.7, prerequisites: [], estimatedMinutes: 25 },
  { id: "projectile", name: "Projectile motion", chapterId: "ch-plane", topic: "Motion in two dimensions", examWeight: 0.85, prerequisites: ["vectors"], estimatedMinutes: 40 },
  { id: "fbd", name: "Free-body diagrams", chapterId: "ch-lom", topic: "Newton's laws", examWeight: 0.75, prerequisites: ["vectors"], estimatedMinutes: 25 },
  { id: "resolution", name: "Resolution of forces on an incline", chapterId: "ch-lom", topic: "Forces on inclined planes", examWeight: 0.9, prerequisites: ["vectors", "fbd"], estimatedMinutes: 35 },
  { id: "friction", name: "Static and kinetic friction", chapterId: "ch-lom", topic: "Friction", examWeight: 0.85, prerequisites: ["resolution"], estimatedMinutes: 40 },
  { id: "circular", name: "Dynamics of circular motion", chapterId: "ch-lom", topic: "Circular motion", examWeight: 0.8, prerequisites: ["fbd"], estimatedMinutes: 40 },
  { id: "pseudo", name: "Pseudo forces", chapterId: "ch-lom", topic: "Non-inertial frames", examWeight: 0.55, prerequisites: ["fbd"], estimatedMinutes: 30 },
  { id: "work-energy", name: "Work–energy theorem", chapterId: "ch-wep", topic: "Work and energy", examWeight: 0.8, prerequisites: [], estimatedMinutes: 35 },
  { id: "power", name: "Power", chapterId: "ch-wep", topic: "Power", examWeight: 0.5, prerequisites: ["work-energy"], estimatedMinutes: 20 },
];

export const conceptById = (id: string) => concepts.find((c) => c.id === id)!;
export const chapterById = (id: string) => chapters.find((c) => c.id === id)!;

/** Launch-unit size for the coverage line ("Assessed 8 of 82 concepts"). */
export const UNIT_CONCEPT_COUNT = 82;

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

const r = String.raw;

export const questions: Question[] = [
  // Resolution of forces — diagnostic
  {
    id: "d01", conceptId: "resolution", type: "mcq", difficulty: "easy", expectedSeconds: 90, missCause: "conceptual",
    stem: r`A block of mass $2\,\text{kg}$ rests on a rough incline of angle $30^\circ$. What is the frictional force acting on the block?`,
    options: [
      { key: "A", text: r`$10\sqrt{3}\,\text{N}$` },
      { key: "B", text: r`$10\,\text{N}$` },
      { key: "C", text: r`$20\,\text{N}$` },
      { key: "D", text: r`$5\,\text{N}$` },
    ],
    answer: "B",
    solution: r`At rest, friction balances the component of weight along the incline: $f = mg\sin 30^\circ = 2 \times 10 \times 0.5 = 10\,\text{N}$. The value $mg\cos 30^\circ = 10\sqrt{3}\,\text{N}$ is the component *into* the surface, which the normal force balances.`,
  },
  {
    id: "d02", conceptId: "resolution", type: "mcq", difficulty: "easy", expectedSeconds: 90, missCause: "conceptual",
    stem: r`A block of mass $4\,\text{kg}$ is placed on a smooth incline of angle $60^\circ$. What is the normal force exerted by the incline?`,
    options: [
      { key: "A", text: r`$20\,\text{N}$` },
      { key: "B", text: r`$20\sqrt{3}\,\text{N}$` },
      { key: "C", text: r`$40\,\text{N}$` },
      { key: "D", text: r`$10\,\text{N}$` },
    ],
    answer: "A",
    solution: r`The normal force balances the weight component perpendicular to the surface: $N = mg\cos 60^\circ = 40 \times 0.5 = 20\,\text{N}$.`,
  },
  {
    id: "d03", conceptId: "resolution", type: "numerical", difficulty: "medium", expectedSeconds: 90, missCause: "conceptual",
    stem: r`A box is pulled by a rope with a force of $50\,\text{N}$ at $37^\circ$ above the horizontal. Find the horizontal component of the force, in newtons.`,
    answer: "40", tolerance: 0.01,
    solution: r`The horizontal component is adjacent to the $37^\circ$ angle: $F_x = 50\cos 37^\circ = 50 \times 0.8 = 40\,\text{N}$.`,
  },
  // Vectors — diagnostic
  {
    id: "d04", conceptId: "vectors", type: "mcq", difficulty: "easy", expectedSeconds: 60, missCause: "conceptual",
    stem: r`A vector of magnitude $10$ units makes an angle of $30^\circ$ with the $x$-axis. Its components $(A_x, A_y)$ are:`,
    options: [
      { key: "A", text: r`$(5,\ 5\sqrt{3})$` },
      { key: "B", text: r`$(5\sqrt{3},\ 5)$` },
      { key: "C", text: r`$(10,\ 5)$` },
      { key: "D", text: r`$(5,\ 5)$` },
    ],
    answer: "B",
    solution: r`$A_x = 10\cos 30^\circ = 5\sqrt{3}$ and $A_y = 10\sin 30^\circ = 5$.`,
  },
  {
    id: "d05", conceptId: "vectors", type: "numerical", difficulty: "easy", expectedSeconds: 60, missCause: "calculation",
    stem: r`Two forces of $3\,\text{N}$ and $4\,\text{N}$ act on a particle at right angles to each other. Find the magnitude of the resultant, in newtons.`,
    answer: "5", tolerance: 0.01,
    solution: r`$R = \sqrt{3^2 + 4^2} = 5\,\text{N}$.`,
  },
  {
    id: "d06", conceptId: "vectors", type: "mcq", difficulty: "easy", expectedSeconds: 60, missCause: "conceptual",
    stem: r`What angle does the vector $\vec{A} = \hat{i} + \hat{j}$ make with the $x$-axis?`,
    options: [
      { key: "A", text: r`$30^\circ$` },
      { key: "B", text: r`$60^\circ$` },
      { key: "C", text: r`$45^\circ$` },
      { key: "D", text: r`$90^\circ$` },
    ],
    answer: "C",
    solution: r`$\tan\theta = A_y / A_x = 1$, so $\theta = 45^\circ$.`,
  },
  // Friction — diagnostic
  {
    id: "d07", conceptId: "friction", type: "mcq", difficulty: "medium", expectedSeconds: 120, missCause: "conceptual",
    stem: r`A $5\,\text{kg}$ block rests on a horizontal floor with $\mu_s = 0.4$. A horizontal force of $15\,\text{N}$ is applied. What is the frictional force on the block?`,
    options: [
      { key: "A", text: r`$20\,\text{N}$` },
      { key: "B", text: r`$15\,\text{N}$` },
      { key: "C", text: r`$0\,\text{N}$` },
      { key: "D", text: r`$5\,\text{N}$` },
    ],
    answer: "B",
    solution: r`Limiting friction is $\mu_s mg = 0.4 \times 50 = 20\,\text{N}$. The applied $15\,\text{N}$ is below that, so the block stays at rest and static friction only matches the applied force: $15\,\text{N}$. $20\,\text{N}$ is the *maximum*, not the actual value.`,
  },
  {
    id: "d08", conceptId: "friction", type: "mcq", difficulty: "medium", expectedSeconds: 90, missCause: "conceptual",
    stem: r`What is the minimum coefficient of static friction needed for a block to stay at rest on an incline of $45^\circ$?`,
    options: [
      { key: "A", text: r`$0.5$` },
      { key: "B", text: r`$1$` },
      { key: "C", text: r`$\sqrt{2}$` },
      { key: "D", text: r`$1/\sqrt{2}$` },
    ],
    answer: "B",
    solution: r`The block is on the verge of slipping when $\mu_s = \tan\theta = \tan 45^\circ = 1$.`,
  },
  {
    id: "d09", conceptId: "friction", type: "numerical", difficulty: "easy", expectedSeconds: 90, missCause: "calculation",
    stem: r`A $2\,\text{kg}$ block slides on a horizontal floor with $\mu_k = 0.25$. Find its deceleration, in $\text{m/s}^2$.`,
    answer: "2.5", tolerance: 0.01,
    solution: r`$a = \mu_k g = 0.25 \times 10 = 2.5\,\text{m/s}^2$; the mass cancels.`,
  },
  // Circular motion — diagnostic
  {
    id: "d10", conceptId: "circular", type: "mcq", difficulty: "medium", expectedSeconds: 120, missCause: "conceptual",
    stem: r`A car takes a flat circular turn of radius $50\,\text{m}$. If $\mu_s = 0.5$, the maximum safe speed is closest to:`,
    options: [
      { key: "A", text: r`$15.8\,\text{m/s}$` },
      { key: "B", text: r`$25\,\text{m/s}$` },
      { key: "C", text: r`$10\,\text{m/s}$` },
      { key: "D", text: r`$22.4\,\text{m/s}$` },
    ],
    answer: "A",
    solution: r`Friction provides the centripetal force: $\mu mg = mv^2/r$, so $v = \sqrt{\mu g r} = \sqrt{0.5 \times 10 \times 50} = \sqrt{250} \approx 15.8\,\text{m/s}$.`,
  },
  {
    id: "d11", conceptId: "circular", type: "numerical", difficulty: "easy", expectedSeconds: 90, missCause: "time_pressure",
    stem: r`A $0.5\,\text{kg}$ stone moves in a horizontal circle of radius $1\,\text{m}$ at $4\,\text{m/s}$. Ignoring gravity, find the tension in the string, in newtons.`,
    answer: "8", tolerance: 0.01,
    solution: r`$T = mv^2/r = 0.5 \times 16 / 1 = 8\,\text{N}$.`,
  },
  {
    id: "d12", conceptId: "circular", type: "mcq", difficulty: "medium", expectedSeconds: 120, missCause: "conceptual",
    stem: r`A road of radius $10\,\text{m}$ is banked so that a car at $10\,\text{m/s}$ needs no friction. The banking angle is:`,
    options: [
      { key: "A", text: r`$30^\circ$` },
      { key: "B", text: r`$37^\circ$` },
      { key: "C", text: r`$45^\circ$` },
      { key: "D", text: r`$60^\circ$` },
    ],
    answer: "C",
    solution: r`$\tan\theta = v^2/(rg) = 100/100 = 1$, so $\theta = 45^\circ$.`,
  },
  // Work–energy — diagnostic
  {
    id: "d13", conceptId: "work-energy", type: "numerical", difficulty: "easy", expectedSeconds: 90, missCause: "conceptual",
    stem: r`A block slides from rest down a frictionless slope, dropping a vertical height of $5\,\text{m}$. Find its speed at the bottom, in m/s.`,
    answer: "10", tolerance: 0.01,
    solution: r`$mgh = \tfrac12 mv^2 \Rightarrow v = \sqrt{2gh} = \sqrt{100} = 10\,\text{m/s}$.`,
  },
  {
    id: "d14", conceptId: "work-energy", type: "mcq", difficulty: "easy", expectedSeconds: 60, missCause: "conceptual",
    stem: r`A $2\,\text{kg}$ mass is raised by $5\,\text{m}$ at constant speed. The work done by the lifting force is:`,
    options: [
      { key: "A", text: r`$10\,\text{J}$` },
      { key: "B", text: r`$50\,\text{J}$` },
      { key: "C", text: r`$100\,\text{J}$` },
      { key: "D", text: r`$0\,\text{J}$` },
    ],
    answer: "C",
    solution: r`At constant speed the lifting force equals $mg$: $W = mgh = 2 \times 10 \times 5 = 100\,\text{J}$.`,
  },
  {
    id: "d15", conceptId: "work-energy", type: "numerical", difficulty: "medium", expectedSeconds: 90, missCause: "calculation",
    stem: r`The speed of a $1\,\text{kg}$ body increases from $2\,\text{m/s}$ to $4\,\text{m/s}$. Find the work done by the net force, in joules.`,
    answer: "6", tolerance: 0.01,
    solution: r`$W = \Delta K = \tfrac12 (1)(4^2 - 2^2) = 6\,\text{J}$.`,
  },

  // Resolution of forces — practice pool
  {
    id: "p01", conceptId: "resolution", type: "mcq", difficulty: "easy", expectedSeconds: 60,
    stem: r`A $10\,\text{kg}$ block sits on a smooth incline of $30^\circ$. The component of its weight along the incline is:`,
    options: [
      { key: "A", text: r`$50\,\text{N}$` },
      { key: "B", text: r`$50\sqrt{3}\,\text{N}$` },
      { key: "C", text: r`$100\,\text{N}$` },
      { key: "D", text: r`$25\,\text{N}$` },
    ],
    answer: "A",
    hint: r`Along the incline you want the component *opposite* the angle $\theta$ in the weight triangle.`,
    solution: r`$mg\sin 30^\circ = 100 \times 0.5 = 50\,\text{N}$. Remember: along the incline is $\sin\theta$, into the surface is $\cos\theta$.`,
  },
  {
    id: "p02", conceptId: "resolution", type: "numerical", difficulty: "easy", expectedSeconds: 60,
    stem: r`A $5\,\text{kg}$ block rests on an incline of $37^\circ$. Find the normal force, in newtons.`,
    answer: "40", tolerance: 0.01,
    hint: r`The normal force balances the component of weight *into* the surface.`,
    solution: r`$N = mg\cos 37^\circ = 50 \times 0.8 = 40\,\text{N}$.`,
  },
  {
    id: "p03", conceptId: "resolution", type: "numerical", difficulty: "medium", expectedSeconds: 90,
    stem: r`A $4\,\text{kg}$ block is held at rest on a smooth $30^\circ$ incline by a force parallel to the incline. Find that force, in newtons.`,
    answer: "20", tolerance: 0.01,
    hint: r`With no friction, the applied force alone must cancel $mg\sin\theta$.`,
    solution: r`$F = mg\sin 30^\circ = 40 \times 0.5 = 20\,\text{N}$.`,
  },
  {
    id: "p04", conceptId: "resolution", type: "mcq", difficulty: "medium", expectedSeconds: 60,
    stem: r`As the angle of a smooth incline increases from $0^\circ$ towards $90^\circ$, what happens to the two weight components on a block?`,
    options: [
      { key: "A", text: "Both increase" },
      { key: "B", text: "Along-incline increases, normal decreases" },
      { key: "C", text: "Along-incline decreases, normal increases" },
      { key: "D", text: "Both stay the same" },
    ],
    answer: "B",
    hint: r`Check the extremes: what are $\sin\theta$ and $\cos\theta$ at $0^\circ$ and $90^\circ$?`,
    solution: r`$mg\sin\theta$ grows from $0$ to $mg$ while $mg\cos\theta$ falls from $mg$ to $0$.`,
  },
  {
    id: "p05", conceptId: "resolution", type: "numerical", difficulty: "medium", expectedSeconds: 60,
    stem: r`A $6\,\text{kg}$ block is on a smooth incline of $53^\circ$. Find the component of its weight along the incline, in newtons.`,
    answer: "48", tolerance: 0.01,
    hint: r`Use $\sin 53^\circ = 0.8$.`,
    solution: r`$mg\sin 53^\circ = 60 \times 0.8 = 48\,\text{N}$.`,
  },

  // Retest — parallel items (never shown in the diagnostic)
  {
    id: "r01", conceptId: "resolution", type: "mcq", difficulty: "easy", expectedSeconds: 90,
    stem: r`A $3\,\text{kg}$ block rests on an incline of $30^\circ$. The normal force on it is:`,
    options: [
      { key: "A", text: r`$15\,\text{N}$` },
      { key: "B", text: r`$15\sqrt{3}\,\text{N}$` },
      { key: "C", text: r`$30\,\text{N}$` },
      { key: "D", text: r`$30\sqrt{3}\,\text{N}$` },
    ],
    answer: "B",
    solution: r`$N = mg\cos 30^\circ = 30 \times \tfrac{\sqrt3}{2} = 15\sqrt{3}\,\text{N}$.`,
  },
  {
    id: "r02", conceptId: "resolution", type: "numerical", difficulty: "medium", expectedSeconds: 90,
    stem: r`A force of $100\,\text{N}$ acts at $53^\circ$ above the horizontal. Find its vertical component, in newtons.`,
    answer: "80", tolerance: 0.01,
    solution: r`$F_y = 100\sin 53^\circ = 80\,\text{N}$.`,
  },
  {
    id: "r03", conceptId: "resolution", type: "numerical", difficulty: "medium", expectedSeconds: 90,
    stem: r`An $8\,\text{kg}$ block slides down a smooth $37^\circ$ incline. Find its acceleration, in $\text{m/s}^2$.`,
    answer: "6", tolerance: 0.01,
    solution: r`$a = g\sin 37^\circ = 10 \times 0.6 = 6\,\text{m/s}^2$.`,
  },
  {
    id: "r04", conceptId: "friction", type: "mcq", difficulty: "medium", expectedSeconds: 120,
    stem: r`A $10\,\text{kg}$ box on a floor with $\mu_s = 0.5$ is pushed horizontally with $30\,\text{N}$. The friction force is:`,
    options: [
      { key: "A", text: r`$50\,\text{N}$` },
      { key: "B", text: r`$30\,\text{N}$` },
      { key: "C", text: r`$0\,\text{N}$` },
      { key: "D", text: r`$20\,\text{N}$` },
    ],
    answer: "B",
    solution: r`Limiting friction is $50\,\text{N}$; $30\,\text{N}$ is below it, so static friction is $30\,\text{N}$.`,
  },
  {
    id: "r05", conceptId: "friction", type: "mcq", difficulty: "medium", expectedSeconds: 90,
    stem: r`If $\mu_s = 1/\sqrt{3}$, the angle of repose is:`,
    options: [
      { key: "A", text: r`$30^\circ$` },
      { key: "B", text: r`$45^\circ$` },
      { key: "C", text: r`$60^\circ$` },
      { key: "D", text: r`$37^\circ$` },
    ],
    answer: "A",
    solution: r`$\tan\theta = 1/\sqrt{3} \Rightarrow \theta = 30^\circ$.`,
  },
  {
    id: "r06", conceptId: "friction", type: "numerical", difficulty: "easy", expectedSeconds: 60,
    stem: r`A $4\,\text{kg}$ block slides on a floor with $\mu_k = 0.2$. Find the kinetic friction force, in newtons.`,
    answer: "8", tolerance: 0.01,
    solution: r`$f = \mu_k mg = 0.2 \times 40 = 8\,\text{N}$.`,
  },
  {
    id: "r07", conceptId: "circular", type: "numerical", difficulty: "easy", expectedSeconds: 60,
    stem: r`A $1\,\text{kg}$ ball moves at $2\,\text{m/s}$ in a circle of radius $0.5\,\text{m}$. Find the centripetal force, in newtons.`,
    answer: "8", tolerance: 0.01,
    solution: r`$F = mv^2/r = 4 / 0.5 = 8\,\text{N}$.`,
  },
  {
    id: "r08", conceptId: "circular", type: "mcq", difficulty: "medium", expectedSeconds: 120,
    stem: r`The maximum speed on a flat curve of radius $40\,\text{m}$ with $\mu_s = 0.4$ is closest to:`,
    options: [
      { key: "A", text: r`$16\,\text{m/s}$` },
      { key: "B", text: r`$12.6\,\text{m/s}$` },
      { key: "C", text: r`$8\,\text{m/s}$` },
      { key: "D", text: r`$20\,\text{m/s}$` },
    ],
    answer: "B",
    solution: r`$v = \sqrt{\mu g r} = \sqrt{160} \approx 12.6\,\text{m/s}$.`,
  },
  {
    id: "r09", conceptId: "circular", type: "mcq", difficulty: "hard", expectedSeconds: 120,
    stem: r`A curve of radius $30\,\text{m}$ is designed for $15\,\text{m/s}$ with no friction. The banking angle is:`,
    options: [
      { key: "A", text: r`$30^\circ$` },
      { key: "B", text: r`$37^\circ$` },
      { key: "C", text: r`$45^\circ$` },
      { key: "D", text: r`$53^\circ$` },
    ],
    answer: "B",
    solution: r`$\tan\theta = v^2/(rg) = 225/300 = 0.75 \Rightarrow \theta = 37^\circ$.`,
  },
];

export const questionById = (id: string) => questions.find((q) => q.id === id)!;

/** Whether validated questions exist yet for a concept (content gate G5). */
export const hasQuestions = (conceptId: string) => questions.some((q) => q.conceptId === conceptId);

/** Practice items available for a concept today (practice pool, else any validated item). */
export function practicePoolSize(conceptId: string) {
  const pool = questions.filter((q) => q.conceptId === conceptId);
  const practice = pool.filter((q) => q.id.startsWith("p"));
  return (practice.length ? practice : pool).length;
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

const JEE_MARKING = { correct: 4, incorrect: -1 };

export const DIAGNOSTIC_ID = "diag-2709";
export const RETEST_ID = "retest-0310";

const attemptConfigs: AttemptConfig[] = [
  {
    id: DIAGNOSTIC_ID,
    kind: "diagnostic",
    title: "Physics diagnostic",
    subtitle: "JEE Main · Class 11 Mechanics",
    durationSeconds: 30 * 60,
    questionIds: ["d01", "d02", "d03", "d04", "d05", "d06", "d07", "d08", "d09", "d10", "d11", "d12", "d13", "d14", "d15"],
    marking: JEE_MARKING,
  },
  {
    id: RETEST_ID,
    kind: "retest",
    title: "Retest",
    subtitle: "New questions on the same concepts",
    durationSeconds: 20 * 60,
    questionIds: ["r01", "r04", "r07", "r02", "r05", "r08", "r03", "r06", "r09"],
    marking: JEE_MARKING,
  },
];

/** Practice attempts are addressed as `prac-<conceptId>-<n>` (n = 5, 10 or 15 questions). */
/** Chapters with enough validated items for a chapter diagnostic (launch gate G5). */
export const CHAPTER_DIAGNOSTICS: Record<string, string[]> = {
  "ch-lom": ["d01", "d02", "d03", "d07", "d08", "d09", "d10", "d12"],
};

export function getAttemptConfig(id: string): AttemptConfig | null {
  const fixed = attemptConfigs.find((a) => a.id === id);
  if (fixed) return fixed;
  const ch = /^diag-(ch-[a-z]+)$/.exec(id);
  if (ch && CHAPTER_DIAGNOSTICS[ch[1]]) {
    return {
      id,
      kind: "diagnostic",
      title: `${chapterById(ch[1]).name} diagnostic`,
      subtitle: "JEE Main · one chapter",
      durationSeconds: 15 * 60,
      questionIds: CHAPTER_DIAGNOSTICS[ch[1]],
      marking: JEE_MARKING,
    };
  }
  const m = /^prac-([a-z-]+?)-(5|10|15)$/.exec(id);
  if (!m) return null;
  const concept = concepts.find((c) => c.id === m[1]);
  if (!concept) return null;
  const pool = questions.filter((q) => q.conceptId === concept.id);
  if (!pool.length) return null;
  const practicePool = pool.filter((q) => q.id.startsWith("p"));
  const ids = (practicePool.length ? practicePool : pool).map((q) => q.id);
  const n = Number(m[2]);
  // Until the bank is seeded the set repeats its pool; the count on screen is always honest.
  const questionIds = Array.from({ length: Math.min(n, ids.length) }, (_, i) => ids[i % ids.length]);
  return {
    id,
    kind: "practice",
    title: "Practice",
    subtitle: concept.name,
    durationSeconds: null,
    questionIds,
    marking: JEE_MARKING,
    targetConceptId: concept.id,
    goal: concept.id === "resolution" ? "Pick sin θ vs cos θ correctly on inclines" : "Close the gap found in your diagnostic",
  };
}

/** The saved diagnostic responses behind the sample report (used when no local attempt exists). */
export const sampleDiagnosticResponses: Response[] = [
  { questionId: "d01", answer: "A", seconds: 150 },
  { questionId: "d02", answer: "A", seconds: 95 },
  { questionId: "d03", answer: "30", seconds: 170 },
  { questionId: "d04", answer: "B", seconds: 55 },
  { questionId: "d05", answer: "5", seconds: 40 },
  { questionId: "d06", answer: "C", seconds: 35 },
  { questionId: "d07", answer: "A", seconds: 140 },
  { questionId: "d08", answer: "B", seconds: 80 },
  { questionId: "d09", answer: "2.5", seconds: 70 },
  { questionId: "d10", answer: "A", seconds: 115 },
  { questionId: "d11", answer: null, seconds: 20 },
  { questionId: "d12", answer: "C", seconds: 130 },
  { questionId: "d13", answer: "10", seconds: 75 },
  { questionId: "d14", answer: "C", seconds: 45 },
  { questionId: "d15", answer: "6", seconds: 90 },
];

export const sampleRetestResponses: Response[] = [
  { questionId: "r01", answer: "B", seconds: 70 },
  { questionId: "r04", answer: "A", seconds: 110 },
  { questionId: "r07", answer: "8", seconds: 50 },
  { questionId: "r02", answer: "80", seconds: 60 },
  { questionId: "r05", answer: "A", seconds: 70 },
  { questionId: "r08", answer: "B", seconds: 100 },
  { questionId: "r03", answer: "6", seconds: 65 },
  { questionId: "r06", answer: "8", seconds: 45 },
  { questionId: "r09", answer: "B", seconds: 115 },
];

/* ------------------------------------------------------------------ */
/* Learner state                                                       */
/* ------------------------------------------------------------------ */

/**
 * Concept state after the 13 Sep diagnostic, the 20 Sep retest and today's
 * diagnostic. `baselineMastery` is the first measured value.
 */
export const conceptStates: ConceptState[] = [
  { conceptId: "vectors", mastery: 88, scoredItems: 9, recentCorrect: 3, recentTotal: 3, avgSeconds: 43, expectedSeconds: 60, priorityScore: 0.1, lastPracticed: "2026-09-19", baselineMastery: 38, errors: { conceptual: 2 } },
  { conceptId: "fbd", mastery: 57, scoredItems: 6, recentCorrect: 2, recentTotal: 3, avgSeconds: 96, expectedSeconds: 90, priorityScore: 0.3, lastPracticed: "2026-09-18", baselineMastery: 50, errors: { conceptual: 2, misread: 1 } },
  { conceptId: "resolution", mastery: 38, scoredItems: 3, recentCorrect: 1, recentTotal: 3, avgSeconds: 138, expectedSeconds: 90, priorityScore: 1, lastPracticed: null, baselineMastery: 38, errors: { conceptual: 2 } },
  { conceptId: "friction", mastery: 63, scoredItems: 3, recentCorrect: 2, recentTotal: 3, avgSeconds: 97, expectedSeconds: 100, priorityScore: 0.43, lastPracticed: null, baselineMastery: 63, errors: { conceptual: 1 } },
  { conceptId: "circular", mastery: 63, scoredItems: 3, recentCorrect: 2, recentTotal: 3, avgSeconds: 88, expectedSeconds: 110, priorityScore: 0.41, lastPracticed: null, baselineMastery: 63, errors: { time_pressure: 1 } },
  { conceptId: "work-energy", mastery: 88, scoredItems: 3, recentCorrect: 3, recentTotal: 3, avgSeconds: 70, expectedSeconds: 80, priorityScore: 0.13, lastPracticed: null, baselineMastery: 88, errors: {} },
  { conceptId: "pseudo", mastery: 0, scoredItems: 1, recentCorrect: 0, recentTotal: 1, avgSeconds: 120, expectedSeconds: 120, priorityScore: 0.2, lastPracticed: null, baselineMastery: null, errors: { conceptual: 1 } },
];

export const stateFor = (conceptId: string) => conceptStates.find((s) => s.conceptId === conceptId) ?? null;

/** Concepts targeted by past interventions (for the progress headline). */
export const targetedConcepts = ["vectors", "fbd"];

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

export const planMeta = {
  week: 1,
  weeks: 3,
  startedOn: TODAY,
  retestOn: "2026-10-03",
  focus: ["resolution", "friction", "circular"],
  why: [
    "Resolution of forces on an incline comes first: friction problems depend on it, and it carries the most exam weight of your gaps.",
    "Static and kinetic friction comes next. Two of your three friction answers were right, so it needs practice more than re-learning.",
    "Circular motion is last this week. You understood it; the missed question was skipped under time pressure.",
  ],
};

export const planTasks: PlanTask[] = [
  { id: "t1", conceptId: "resolution", date: "2026-09-27", type: "revise", priority: 1, minutes: 35, action: "Splitting weight on an incline: which part is sin θ, which is cos θ", then: "5 targeted questions", reviewOn: "2026-10-02", status: "pending", practiceQuestions: 5 },
  { id: "t2", conceptId: "friction", date: "2026-09-27", type: "revise", priority: 3, minutes: 15, action: "Static friction only matches the applied force until the limit", status: "pending" },
  { id: "t3", conceptId: "fbd", date: "2026-09-27", type: "review", priority: 4, minutes: 10, action: "Draw three free-body diagrams from last week's retest", status: "completed" },
  { id: "t4", conceptId: "resolution", date: "2026-09-28", type: "practice", priority: 1, minutes: 10, action: "5 questions, mixed angles", status: "pending", practiceQuestions: 5 },
  { id: "t5", conceptId: "friction", date: "2026-09-28", type: "practice", priority: 3, minutes: 35, action: "Friction on inclines", then: "10 targeted questions", status: "pending", practiceQuestions: 10 },
  { id: "t6", conceptId: "circular", date: "2026-09-28", type: "revise", priority: 3, minutes: 15, action: "Which force supplies the centripetal force in each set-up", status: "pending" },
  { id: "t7", conceptId: "friction", date: "2026-09-29", type: "practice", priority: 3, minutes: 25, action: "10 questions, limiting vs actual friction", status: "pending", practiceQuestions: 10 },
  { id: "t8", conceptId: "circular", date: "2026-09-29", type: "practice", priority: 3, minutes: 15, action: "5 questions on banked roads", status: "pending", practiceQuestions: 5 },
  { id: "t9", conceptId: "resolution", date: "2026-09-29", type: "review", priority: 1, minutes: 10, action: "Re-derive the incline components without notes", status: "pending" },
  { id: "t10", conceptId: "circular", date: "2026-09-30", type: "practice", priority: 3, minutes: 35, action: "Timed set: flat curves and banking", then: "10 targeted questions", status: "pending", practiceQuestions: 10 },
  { id: "t11", conceptId: "friction", date: "2026-09-30", type: "review", priority: 3, minutes: 10, action: "Review your wrong answers from Monday", status: "pending" },
  { id: "t12", conceptId: "resolution", date: "2026-10-01", type: "practice", priority: 1, minutes: 25, action: "10 harder incline questions", status: "pending", practiceQuestions: 10 },
  { id: "t13", conceptId: "circular", date: "2026-10-01", type: "practice", priority: 3, minutes: 20, action: "5 questions, vertical circles", status: "pending", practiceQuestions: 5 },
  { id: "t14", conceptId: "friction", date: "2026-10-02", type: "review", priority: 3, minutes: 30, action: "Mixed review of all three concepts", status: "pending" },
  { id: "t15", conceptId: "resolution", date: "2026-10-03", type: "retest", priority: 1, minutes: 20, action: "Retest: 9 new questions on this week's concepts", status: "pending" },
];

export const upcomingWeeks = [
  { week: 2, range: "4–10 Oct", concepts: ["pseudo", "fbd", "power"] },
  { week: 3, range: "11–17 Oct", concepts: ["projectile", "work-energy"] },
];

/* ------------------------------------------------------------------ */
/* History, credits, notifications                                     */
/* ------------------------------------------------------------------ */

export const reports: ReportSummary[] = [
  { attemptId: DIAGNOSTIC_ID, date: "2026-09-27", kind: "diagnostic", title: "Physics diagnostic", score: 41, max: 60, status: "ready" },
  { attemptId: "retest-2009", date: "2026-09-20", kind: "retest", title: "Retest · Vectors, free-body diagrams", score: 20, max: 24, status: "ready" },
  { attemptId: "diag-1309", date: "2026-09-13", kind: "diagnostic", title: "Physics diagnostic", score: 29, max: 60, status: "ready" },
];

/** Score trend for diagnostics (circle) and retests (square), as a percentage. */
export const scoreTrend = [
  { date: "2026-09-13", kind: "diagnostic" as const, pct: 48 },
  { date: "2026-09-20", kind: "retest" as const, pct: 83 },
  { date: "2026-09-27", kind: "diagnostic" as const, pct: 68 },
];

export const pastRetests = [
  {
    id: "retest-2009",
    date: "2026-09-20",
    title: "Vectors · Free-body diagrams",
    results: [
      { conceptId: "vectors", baseline: 38, retest: 88, items: 3 },
      { conceptId: "fbd", baseline: 50, retest: 57, items: 3 },
    ],
  },
];

export const credits = {
  balance: 120,
  buckets: [
    { label: "Plan credits", amount: 100, note: "Refills to 200 at 00:00 IST" },
    { label: "Promotional", amount: 20, note: "EARLYACCESS · expire 12 Oct" },
    { label: "Purchased", amount: 0, note: "Packs last 90 days" },
  ],
};

export const creditHistory: CreditTxn[] = [
  { id: "c1", date: "2026-09-27", description: "Study plan · Week 1", amount: -COST.studyPlan, bucket: "Plan" },
  { id: "c2", date: "2026-09-27", description: "Full diagnostic · Physics", amount: -COST.fullDiagnostic, bucket: "Plan" },
  { id: "c3", date: "2026-09-27", description: "Daily refill", amount: 200, bucket: "Plan" },
  { id: "c4", date: "2026-09-26", description: "Explanation · Free-body diagrams", amount: -COST.explanation, bucket: "Plan" },
  { id: "c5", date: "2026-09-26", description: "Practice set · Vectors (5 Qs)", amount: -COST.practiceSet5, bucket: "Plan" },
  { id: "c6", date: "2026-09-26", description: "Daily refill", amount: 200, bucket: "Plan" },
  { id: "c7", date: "2026-09-20", description: "Retest · Vectors, free-body diagrams", amount: -COST.retest, bucket: "Promotional" },
  { id: "c8", date: "2026-09-19", description: "EARLYACCESS bonus", amount: 100, bucket: "Promotional" },
];

export const payments = [
  { id: "pay1", date: "2026-09-19", item: "Starter · 30-day pass (EARLYACCESS −20%)", amount: 159, status: "Paid" },
];

export const notifications = [
  { id: "n1", date: "2026-09-27", title: "Your study plan is ready", body: "Start with Resolution of forces on an incline.", href: "/plan", unread: true },
  { id: "n2", date: "2026-09-27", title: "Diagnosis ready", body: "3 concepts to fix, 2 you can skip for now.", href: `/assess/results/${DIAGNOSTIC_ID}`, unread: true },
  { id: "n3", date: "2026-09-20", title: "Retest result", body: "Vectors improved by 50 pts.", href: "/progress", unread: false },
];
