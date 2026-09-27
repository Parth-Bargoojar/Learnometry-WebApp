"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { COST } from "@/lib/config";
import { AIStatus } from "./ai-status";
import { Cost, btn } from "./ui";

export function StepDone({ label }: { label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => setDone((d) => !d)}
      className={
        done
          ? "inline-flex h-9 items-center gap-1.5 rounded-btn border border-success/40 bg-success/10 px-3 text-sm font-semibold text-success-text"
          : btn("secondary", "sm")
      }
    >
      {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : null}
      {done ? "Revised" : label}
    </button>
  );
}

/** On-demand AI explanation (⚡10) with the DS §23 step pattern. Structured, not an essay. */
const EXPLANATIONS: Record<string, string[]> = {
  resolution: [
    "Picture the incline tilting from flat to vertical. Flat: gravity only presses into the surface, so the into-surface part is all of mg and the along-slope part is zero. That matches cos 0° = 1 and sin 0° = 0.",
    "So whenever you are unsure, test θ = 0: the component that should vanish is the sin θ one. On an incline, that is always the along-slope part.",
  ],
  friction: [
    "Static friction is a reaction, not a fixed number. Push a heavy box gently and it pushes back exactly as hard, so it doesn't move.",
    "μs N is only the ceiling. Compare the applied force with that ceiling first: below it, friction equals the applied force; at it, the box is about to slip.",
  ],
  circular: [
    "Ask which real force points at the centre: tension for a stone on a string, friction for a car on a flat road, a component of the normal force on a banked road.",
    "Set that force equal to mv²/r and solve. There is no extra \"centripetal force\" to add on top.",
  ],
};

export function ExplainButton({ concept, conceptId }: { concept: string; conceptId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  if (state === "idle") {
    return (
      <button type="button" onClick={() => setState("loading")} className={btn("ghost", "sm", "border-border-subtle")}>
        <Sparkles aria-hidden="true" className="size-4" />
        Explain this concept <Cost credits={COST.explanation} />
      </button>
    );
  }
  if (state === "loading") {
    return <AIStatus title={`Explaining ${concept.toLowerCase()}`} steps={["Reading your mistakes", "Writing the explanation", "Checking it"]} stepMs={600} onDone={() => setState("ready")} />;
  }
  return (
    <div className="rounded-card-sm border border-info/40 bg-info/5 p-4 text-[15px] leading-relaxed text-ink animate-fade-in">
      <p className="text-xs font-bold uppercase tracking-wider text-info">Explanation</p>
      {(EXPLANATIONS[conceptId] ?? ["Start from the definition, then work one example from your notes step by step, saying why each step follows."]).map((para) => (
        <p key={para.slice(0, 24)} className="mt-2">
          {para}
        </p>
      ))}
      <p className="mt-3 text-xs text-muted">Generated for your mistake pattern · 10 credits used</p>
    </div>
  );
}
