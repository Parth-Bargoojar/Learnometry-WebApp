"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Minus, TrendingDown, TrendingUp, CircleHelp } from "lucide-react";
import type { AttemptConfig, Response } from "@/lib/types";
import { COST } from "@/lib/config";
import { DIAGNOSTIC_ID, conceptById, getAttemptConfig, questionById, sampleDiagnosticResponses } from "@/lib/data";
import { CATEGORY_LABEL, compareRetest, diagnose, isCorrect, scoreAttempt } from "@/lib/diagnosis";
import { signed } from "@/lib/format";
import { AIStatus } from "./ai-status";
import { PairedBar } from "./charts";
import { Mascot } from "./feedback";
import { btn } from "./ui";
import { EvidenceDots } from "./report";
import { useAttemptResponses } from "./use-result";
import { SpendLink } from "./credit-gate";

const EMPTY: Response[] = [];

/** Practice results — Web App Structure §8.11. Practice evidence is labeled as practice. */
export function PracticeResults({ config }: { config: AttemptConfig }) {
  const { responses } = useAttemptResponses(config.id, EMPTY);
  if (!responses) return <div className="skeleton h-80" aria-busy="true" />;
  const s = scoreAttempt(config, responses);
  const concept = conceptById(config.targetConceptId!);
  const marks = config.questionIds.map((id) => {
    const r = responses.find((x) => x.questionId === id);
    if (!r?.answer) return "unanswered" as const;
    return isCorrect(questionById(id), r.answer) ? ("correct" as const) : ("incorrect" as const);
  });
  const missed = config.questionIds.filter((id, i) => marks[i] !== "correct").map(questionById);
  const cats = Array.from(new Set(missed.map((q) => q.missCause).filter(Boolean)));

  if (!responses.length) {
    return (
      <div className="mx-auto max-w-[560px] rounded-card border border-border-subtle bg-surface p-6 text-center">
        <p className="font-semibold text-ink">No practice saved here yet.</p>
        <SpendLink href={`/attempt/${config.id}`} cost={COST.practiceSet5} what="A practice set" className="mt-4">
          Start practice
        </SpendLink>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <section className="rounded-card-lg border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">{concept.name} · practice</p>
        <p className="mt-2 font-display text-4xl tabular-nums text-ink">
          {s.correct} <span className="text-xl text-muted">of {s.total} correct</span>
        </p>
        <div className="mt-3">
          <EvidenceDots marks={marks} />
        </div>
        {cats.length ? (
          <p className="mt-4 text-sm text-ink">
            Mistakes this session: {cats.map((c) => CATEGORY_LABEL[c!].toLowerCase()).join(", ")}.
          </p>
        ) : (
          <p className="mt-4 text-sm text-success-text">No mistakes this session.</p>
        )}
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/plan" className={btn("primary")}>
          Back to your plan <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
        <SpendLink href={`/attempt/${config.id}`} cost={COST.practiceSet5} what="A practice set" variant="secondary">
          Practice again
        </SpendLink>
      </div>
    </div>
  );
}

const OUTCOME = {
  improved: { label: "Improved", icon: TrendingUp, cls: "bg-success/10 text-success-text border-success/35" },
  stable: { label: "Stable", icon: Minus, cls: "bg-sunken text-muted border-border-subtle" },
  declined: { label: "Declined", icon: TrendingDown, cls: "bg-danger/10 text-danger-text border-danger/35" },
  insufficient: { label: "Not enough evidence", icon: CircleHelp, cls: "bg-surface text-muted border-faint border-dashed" },
} as const;

/** Retest result — the proof screen, DS §19 hierarchy. */
export function RetestResult({ config, fallback }: { config: AttemptConfig; fallback: Response[] }) {
  const { responses, own } = useAttemptResponses(config.id, fallback);
  const [ready, setReady] = useState(false);
  const baseCfg = getAttemptConfig(DIAGNOSTIC_ID)!;
  const baseline = useMemo(() => diagnose(baseCfg.questionIds, sampleDiagnosticResponses), [baseCfg]);

  if (!responses) return <div className="skeleton h-96" aria-busy="true" />;
  if (own && !ready) {
    return (
      <div className="mx-auto max-w-[760px]">
        <AIStatus title="Measuring the change" steps={["Scoring your answers", "Comparing with your baseline", "Updating your plan"]} stepMs={700} onDone={() => setReady(true)} />
      </div>
    );
  }

  const order = { improved: 0, stable: 1, insufficient: 2, declined: 3 } as const;
  const rows = compareRetest(baseline, diagnose(config.questionIds, responses)).sort((x, y) => order[x.outcome] - order[y.outcome] || y.delta - x.delta);
  const improved = rows.filter((r) => r.outcome === "improved").length;
  const before = Math.round(rows.reduce((a, r) => a + r.before, 0) / rows.length);
  const after = Math.round(rows.reduce((a, r) => a + r.after, 0) / rows.length);
  const still = rows.filter((r) => r.outcome !== "improved");

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <section className="rounded-card-lg border border-line bg-surface p-5 shadow-brutal-lg sm:p-7" aria-labelledby="headline">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Laws of Motion · {config.questionIds.length} new questions</p>
            <h2 id="headline" className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
              {improved} of {rows.length} concepts improved
            </h2>
            <p className="mt-2 text-lg text-ink">
              Targeted average: {before}% → {after}%{" "}
              <span className={`font-bold ${after - before >= 0 ? "text-success-text" : "text-danger-text"}`}>{signed(after - before)} pts</span>
            </p>
          </div>
          {improved ? <Mascot size="md" className="hidden sm:inline-flex" /> : null}
        </div>
      </section>

      <section aria-labelledby="by-concept">
        <h2 id="by-concept" className="mb-3 text-lg font-semibold text-ink">
          By concept
        </h2>
        <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
          {rows.map((r) => {
            const o = OUTCOME[r.outcome];
            return (
              <li key={r.conceptId} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{conceptById(r.conceptId).name}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${o.cls}`}>
                    <o.icon aria-hidden="true" className="size-3.5" />
                    {o.label}
                  </span>
                  <span className="ml-auto text-sm font-bold tabular-nums text-ink">{signed(r.delta)} pts</span>
                </div>
                <PairedBar before={r.before} after={r.after} afterLabel="Retest" label={conceptById(r.conceptId).name} />
                <p className="mt-2 text-xs text-muted">
                  {r.correct} of {r.total} correct on the retest
                  {r.outcome !== "improved" ? " · stays in your plan" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-5" aria-labelledby="next-h">
        <h2 id="next-h" className="font-semibold text-ink">
          What happens next
        </h2>
        <p className="mt-2 text-[15px] text-ink">
          {still.length
            ? `Your plan was updated: ${conceptById(still[0].conceptId).name} moves to the top next week. Improved concepts move to a review in 2 weeks.`
            : "Every targeted concept improved. They move to a review in 2 weeks, and next week's plan picks new concepts."}
        </p>
        <Link href="/plan" className={btn("primary", "md", "mt-4")}>
          See your updated plan <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </section>
    </div>
  );
}
