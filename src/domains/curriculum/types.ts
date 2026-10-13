import type { Edge } from "@/domains/admin/rules";

/* What the admin curriculum screen receives (BE-3.5). Pure types, safe for components to import. */

export interface CurriculumConcept {
  /** Stable code shared across tracks, e.g. `resolution`; edges refer to it. */
  code: string;
  name: string;
  weight: number;
  minutes: number;
  active: boolean;
  /** Published questions on this track (launch gate G5 wants 12). */
  published: number;
}

export interface CurriculumChapter {
  id: string;
  name: string;
  ncert: string | null;
  topics: { name: string; concepts: CurriculumConcept[] }[];
}

export interface CurriculumView {
  examCode: string;
  examName: string;
  publishedVersion: number;
  publishedAt: string | null;
  /** Name of whoever published it; null for the seed. */
  publishedBy: string | null;
  chapters: CurriculumChapter[];
  /** The published graph. */
  edges: Edge[];
  /** Unpublished edits as a full edge list, or null when there is no draft. */
  draft: Edge[] | null;
}
