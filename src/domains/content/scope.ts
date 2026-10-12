/*
  POC content scope (STAGES BE-3, PREREQUISITES P14): JEE Main Class 11 Physics, Laws of Motion
  and Work, Energy and Power, served on all three tracks. Motion in a Plane items (vectors,
  projectile) are prerequisites for the diagnosis, not an assessed chapter.
*/
export const POC_CONCEPTS = ["fbd", "resolution", "friction", "circular", "pseudo", "work-energy", "power"] as const;

/** Concept folder per chapter in `content/physics/`. */
export const CHAPTER_DIR: Record<string, string> = {
  fbd: "laws-of-motion",
  resolution: "laws-of-motion",
  friction: "laws-of-motion",
  circular: "laws-of-motion",
  pseudo: "laws-of-motion",
  vectors: "motion-in-a-plane",
  projectile: "motion-in-a-plane",
  "work-energy": "work-energy-power",
  power: "work-energy-power",
};
