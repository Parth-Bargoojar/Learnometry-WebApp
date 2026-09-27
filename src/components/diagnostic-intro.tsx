"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { COST } from "@/lib/config";
import { CHAPTER_DIAGNOSTICS, DIAGNOSTIC_ID, chapters, credits, learner } from "@/lib/data";
import { Cost, btn } from "./ui";

/** Diagnostic introduction — Web App Structure §8.5: remove every surprise before the timer starts. */
export function DiagnosticIntro() {
  const [scope, setScope] = useState<"full" | "chapter">("full");
  const available = chapters.filter((c) => CHAPTER_DIAGNOSTICS[c.id]);
  const [chapter, setChapter] = useState(available[0].id);
  const full = scope === "full";
  const cost = full ? COST.fullDiagnostic : COST.chapterDiagnostic;
  const enough = credits.balance >= cost;

  const facts = [
    [full ? "30 min" : "15 min", "timed"],
    [full ? "15 Qs" : "8 Qs", "MCQ + numerical"],
    ["+4 / −1", "JEE Main marking"],
    [`⚡ ${cost}`, "credits"],
  ];

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="text-lg text-ink">Find the concepts behind your wrong answers.</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">Scope</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { v: "full" as const, t: "Full diagnostic", d: "All 6 chapters of Class 11 Mechanics" },
            { v: "chapter" as const, t: "One chapter", d: "Go deeper on a single chapter" },
          ].map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer items-start gap-3 rounded-card border-2 bg-surface p-4 ${scope === o.v ? "border-line bg-primary/10 shadow-brutal-sm" : "border-border-subtle hover:border-faint"}`}
            >
              <input type="radio" name="scope" value={o.v} checked={scope === o.v} onChange={() => setScope(o.v)} className="mt-1 size-4 accent-[var(--color-primary-deep)]" />
              <span>
                <span className="block font-semibold text-ink">{o.t}</span>
                <span className="block text-sm text-muted">{o.d}</span>
              </span>
            </label>
          ))}
        </div>
        {!full ? (
          <div className="mt-3">
            <label htmlFor="chapter" className="text-sm font-semibold text-ink">
              Chapter
            </label>
            <select
              id="chapter"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-input border border-border-subtle bg-surface px-3 text-ink sm:w-80"
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">Only chapters with enough checked questions are listed. More are added every week.</p>
          </div>
        ) : null}
      </fieldset>

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-card border-2 border-line bg-surface sm:grid-cols-4">
        {facts.map(([v, l], i) => (
          <div key={l} className={`p-4 ${i % 2 ? "" : "border-r border-border-subtle"} ${i < 2 ? "border-b sm:border-b-0" : ""} border-border-subtle sm:border-r sm:last:border-r-0`}>
            <dt className="sr-only">{l}</dt>
            <dd className="font-display text-2xl leading-none tabular-nums text-ink">{v}</dd>
            <dd className="mt-1.5 text-xs text-muted">{l}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="before-h" className="mt-6">
        <h2 id="before-h" className="text-base font-semibold text-ink">
          Before you start
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            `Find ${full ? "30" : "15"} quiet minutes. The timer keeps running if you leave.`,
            "Keep paper and a pen for rough work. No calculator.",
            "Answers save automatically, even if your connection drops.",
            "You can mark questions and come back to them before submitting.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5 text-[15px] text-ink">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 rounded-card border border-border-subtle bg-surface p-4 text-[15px] text-ink">
        <span className="font-semibold">What you&apos;ll get:</span> a score, the concepts behind each wrong answer, and a study plan sized to your{" "}
        {learner.dailyMinutes} minutes a day.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {enough ? (
          <Link href={full ? `/attempt/${DIAGNOSTIC_ID}` : `/attempt/diag-${chapter}`} className={btn("primary", "lg")}>
            Start diagnostic <Cost credits={cost} />
          </Link>
        ) : (
          <Link href="/credits/buy" className={btn("primary", "lg")}>
            Get credits <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        )}
        <p className="text-sm text-muted">
          {enough ? `You have ${credits.balance} credits.` : `Starting a diagnostic needs ${cost} credits. You have ${credits.balance}.`}
        </p>
      </div>
    </div>
  );
}
