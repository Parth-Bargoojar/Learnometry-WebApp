"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  CloudCheck,
  CloudOff,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  Timer,
  X,
} from "lucide-react";
import type { AttemptConfig, Question, Response } from "@/lib/types";
import { COST } from "@/lib/config";
import { conceptById, questionById } from "@/lib/data";
import { isCorrect } from "@/lib/diagnosis";
import { clock } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/diagnosis";
import { MathText } from "./math";
import { useOnline } from "@/lib/pwa";
import { Dialog } from "./dialog";
import { ShortcutRows, playerShortcuts } from "./keyboard-sheet";
import { Cost, btn } from "./ui";

type Saved = { startedAt: number; current: number; responses: Record<string, Response>; submitted?: boolean };
type SaveState = "saved" | "saving" | "offline";

const storageKey = (id: string) => `lm-attempt-${id}`;
export const resultKey = (id: string) => `lm-result-${id}`;

function load(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/**
 * The assessment player — Focus shell, Web App Structure §8.6.
 * Local-first: every change is written to storage immediately (the server queue
 * replaces the `saving` simulation). The timer is derived from `startedAt`, never
 * counted in memory, so a refresh cannot add time.
 */
export function Player({ config }: { config: AttemptConfig }) {
  const router = useRouter();
  const qs = useMemo(() => config.questionIds.map(questionById), [config]);
  const practice = config.kind === "practice";

  const [ready, setReady] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [saveStep, setSave] = useState<SaveState>("saved");
  // Offline is a fact about the connection, not about the last write: it shows from the moment
  // the connection drops and clears the moment it returns (the queue then flushes, TRD §12.2).
  const online = useOnline();
  const save: SaveState = !online ? "offline" : saveStep === "offline" ? "saved" : saveStep;
  const [now, setNow] = useState(0);
  const [hideTimer, setHideTimer] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [finishing, setFinishing] = useState<null | "submit" | "timeout">(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [announce, setAnnounce] = useState("");
  const enteredAt = useRef(0);

  // Restore or start (resume after refresh, §8.6).
  useEffect(() => {
    const saved = load(config.id);
    const s: Saved = saved && !saved.submitted ? saved : { startedAt: Date.now(), current: 0, responses: {} };
    /* eslint-disable react-hooks/set-state-in-effect -- hydrating from browser storage after mount */
    setStartedAt(s.startedAt);
    setIndex(s.current);
    setResponses(s.responses);
    setNow(Date.now());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    enteredAt.current = Date.now();
  }, [config.id]);

  const persist = useCallback(
    (next: Record<string, Response>, current: number) => {
      try {
        localStorage.setItem(storageKey(config.id), JSON.stringify({ startedAt, current, responses: next } satisfies Saved));
      } catch {}
      setSave("saving");
      window.setTimeout(() => setSave("saved"), 350);
    },
    [config.id, startedAt],
  );


  const elapsed = ready ? (now - startedAt) / 1000 : 0;
  const remaining = config.durationSeconds ? Math.max(0, config.durationSeconds - elapsed) : null;

  const q = qs[index];
  const r = responses[q.id];

  const finish = useCallback(
    (reason: "submit" | "timeout") => {
      setFinishing(reason);
      const list = qs.map((x) => responses[x.id] ?? { questionId: x.id, answer: null, seconds: 0 });
      try {
        localStorage.setItem(resultKey(config.id), JSON.stringify(list));
        localStorage.setItem(storageKey(config.id), JSON.stringify({ startedAt, current: index, responses, submitted: true }));
      } catch {}
      const dest =
        config.kind === "practice"
          ? `/practice/results/${config.id}`
          : config.kind === "retest"
            ? `/assess/retests/${config.id}/result`
            : `/assess/results/${config.id}`;
      window.setTimeout(() => router.push(dest), 1400);
    },
    [qs, responses, config, router, startedAt, index],
  );

  // Timer: 1 s tick derived from startedAt. The tick is the clock subscription, so it
  // also owns the 5- and 1-minute announcements and the auto-submit at zero (§7.3).
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  const announced = useRef<Set<number>>(new Set());
  useEffect(() => {
    const total = config.durationSeconds;
    if (!total || !ready || finishing) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      const rem = total - (n - startedAt) / 1000;
      for (const mark of [300, 60]) {
        if (rem <= mark && !announced.current.has(mark)) {
          announced.current.add(mark);
          setAnnounce(mark === 300 ? "5 minutes left" : "1 minute left");
        }
      }
      if (rem <= 0) {
        window.clearInterval(t);
        finishRef.current("timeout");
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [config.durationSeconds, ready, finishing, startedAt]);

  const setAnswer = useCallback(
    (answer: string | null) => {
      if (practice && checked[q.id]) return;
      const spent = Math.round((Date.now() - enteredAt.current) / 1000);
      const prev = responses[q.id];
      const next = { ...responses, [q.id]: { ...prev, questionId: q.id, answer, seconds: (prev?.seconds ?? 0) + spent } };
      enteredAt.current = Date.now();
      setResponses(next);
      persist(next, index);
    },
    [practice, checked, q.id, responses, persist, index],
  );

  const toggleMark = useCallback(() => {
    const prev = responses[q.id] ?? { questionId: q.id, answer: null, seconds: 0 };
    const next = { ...responses, [q.id]: { ...prev, marked: !prev.marked } };
    setResponses(next);
    persist(next, index);
  }, [q.id, responses, persist, index]);

  const go = useCallback(
    (to: number) => {
      const i = Math.max(0, Math.min(qs.length - 1, to));
      setIndex(i);
      enteredAt.current = Date.now();
      persist(responses, i);
      setMapOpen(false);
      document.getElementById("question")?.focus({ preventScroll: false });
    },
    [qs.length, persist, responses],
  );

  const isLast = index === qs.length - 1;
  const counts = useMemo(() => {
    const vals = qs.map((x) => responses[x.id]);
    const answered = vals.filter((v) => v?.answer != null && v.answer !== "").length;
    const marked = vals.filter((v) => v?.marked).length;
    return { answered, marked, unanswered: qs.length - answered };
  }, [qs, responses]);

  const onPrimary = useCallback(() => {
    if (practice) {
      if (!checked[q.id]) {
        if (r?.answer == null || r.answer === "") return;
        setChecked((c) => ({ ...c, [q.id]: true }));
        return;
      }
      if (isLast) finish("submit");
      else go(index + 1);
      return;
    }
    if (isLast) setSubmitOpen(true);
    else go(index + 1);
  }, [practice, checked, q, r, isLast, finish, go, index]);

  // Enter in the numeric field commits the answer first; the check runs on the render after
  // that commit, when `r` holds the new value.
  const enterAfterCommit = useRef(false);
  useEffect(() => {
    if (!enterAfterCommit.current) return;
    enterAfterCommit.current = false;
    onPrimary();
  });

  // Keyboard shortcuts (optional, never required).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (submitOpen || exitOpen || mapOpen || keysOpen || finishing) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter") {
        // Buttons, links and summaries keep their own Enter; a focused option is the exception,
        // because "Enter = Check answer" is the point of practice (§9.9).
        if (!practice || (["BUTTON", "A", "SUMMARY", "SELECT"].includes(t.tagName) && t.getAttribute("role") !== "radio")) return;
        e.preventDefault();
        onPrimary();
        return;
      }
      if (q.type === "mcq" && q.options) {
        const byLetter = q.options.find((o) => o.key.toLowerCase() === k);
        const byNum = q.options[Number(k) - 1];
        const opt = byLetter ?? (/^[1-4]$/.test(k) ? byNum : undefined);
        if (opt) {
          e.preventDefault();
          setAnswer(opt.key);
          return;
        }
      }
      if (k === "arrowright" || k === "n") go(index + 1);
      else if (k === "arrowleft" || k === "p") go(index - 1);
      else if (k === "m" && !practice) toggleMark();
      else if (k === "backspace" || k === "delete") setAnswer(null);
      else if (k === "?") setKeysOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, index, go, setAnswer, toggleMark, onPrimary, practice, submitOpen, exitOpen, mapOpen, keysOpen, finishing]);

  // Leave guard only while a save is in flight.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (save !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [save]);

  if (!ready) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  const exitHref = config.kind === "practice" ? "/practice" : "/assess";
  const primaryLabel = practice
    ? checked[q.id]
      ? isLast
        ? "Finish practice"
        : "Next question"
      : "Check answer"
    : isLast
      ? "Review & submit"
      : "Save & next";

  return (
    <div className="flex min-h-screen flex-col">
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>

      {/* Focus bar */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5">
          <h1 className="sr-only">{config.title}</h1>
          <button type="button" onClick={() => setExitOpen(true)} aria-label="Exit" className="flex h-11 min-w-11 justify-center items-center gap-1.5 rounded-btn px-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
            <X aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-semibold text-ink">{config.title}</p>
            <p className="truncate text-xs text-muted">{config.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="flex h-11 items-center gap-1 rounded-btn px-2 text-sm font-semibold tabular-nums text-ink hover:bg-sunken md:ml-4 xl:hidden"
            aria-label={`Question ${index + 1} of ${qs.length}. Open question map`}
          >
            Q {index + 1}/{qs.length}
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
          <p className="hidden text-sm font-semibold tabular-nums text-ink xl:ml-4 xl:block">
            Question {index + 1} of {qs.length}
          </p>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SaveIndicator state={save} />
            {remaining !== null ? <TimerChip remaining={remaining} hidden={hideTimer} onToggle={() => setHideTimer((h) => !h)} /> : null}
            {!practice ? (
              <button type="button" onClick={() => setSubmitOpen(true)} className={btn("secondary", "sm")}>
                Submit
              </button>
            ) : null}
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={qs.length}
          aria-valuenow={counts.answered}
          className="h-1 bg-sunken"
        >
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(counts.answered / qs.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-8 px-3 pb-32 pt-5 sm:px-5 sm:pt-8">
        <main className="mx-auto w-full max-w-[760px] min-w-0">
          {practice && config.targetConceptId ? <PracticeHeader config={config} total={qs.length} /> : null}

          <article
            id="question"
            tabIndex={-1}
            aria-labelledby="q-stem"
            className="rounded-card-lg border border-border-subtle bg-surface p-6 outline-none sm:p-8"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle pb-3 text-[13px] text-muted">
              <span className="font-bold text-ink">Q{index + 1}</span>
              <span>{conceptById(q.conceptId) && config.kind === "diagnostic" ? chapterLabel(q) : conceptById(q.conceptId).name}</span>
              <span>{q.type === "mcq" ? "Single correct" : "Numerical value"}</span>
              <span className="ml-auto tabular-nums">
                +{config.marking.correct} / −{Math.abs(config.marking.incorrect)}
              </span>
            </div>

            <MathText as="div" className="mt-4 text-[17px] leading-relaxed text-ink sm:text-lg">
              {q.stem}
            </MathText>
            <span id="q-stem" className="sr-only">
              Question {index + 1}
            </span>

            <div className="mt-6">
              {q.type === "mcq" ? (
                <Options q={q} value={r?.answer ?? null} onChange={setAnswer} reveal={practice && checked[q.id]} />
              ) : (
                <NumericAnswer
                  key={q.id}
                  value={r?.answer ?? ""}
                  onChange={setAnswer}
                  onEnter={practice ? () => (enterAfterCommit.current = true) : undefined}
                  reveal={practice && checked[q.id]}
                  q={q}
                />
              )}
            </div>

            {!practice || !checked[q.id] ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!practice ? (
                  <button
                    type="button"
                    aria-pressed={!!r?.marked}
                    onClick={toggleMark}
                    className={`flex h-10 touch:h-11 items-center gap-1.5 rounded-btn border px-3 text-sm font-semibold ${
                      r?.marked ? "border-warning bg-warning/15 text-warning-text" : "border-border-subtle text-muted hover:text-ink"
                    }`}
                  >
                    <Flag aria-hidden="true" className="size-4" />
                    {r?.marked ? "Marked for review" : "Mark for review"}
                  </button>
                ) : null}
                {r?.answer ? (
                  <button type="button" onClick={() => setAnswer(null)} className="flex h-10 touch:h-11 items-center gap-1.5 rounded-btn px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
                    <Eraser aria-hidden="true" className="size-4" />
                    Clear answer
                  </button>
                ) : null}
                {practice && q.hint ? (
                  hints[q.id] ? null : (
                    <button type="button" onClick={() => setHints((h) => ({ ...h, [q.id]: true }))} className="flex h-10 touch:h-11 items-center gap-1 rounded-btn px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
                      <Lightbulb aria-hidden="true" className="size-4" />
                      Hint <Cost credits={COST.hint} className="border-border-subtle" />
                    </button>
                  )
                ) : null}
              </div>
            ) : null}

            {practice && hints[q.id] && q.hint ? (
              <div className="mt-4 rounded-card-sm border border-info/40 bg-info/5 p-4 text-[15px] text-ink">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-info">Hint</p>
                <MathText>{q.hint}</MathText>
              </div>
            ) : null}

            {practice && checked[q.id] ? (
              <PracticeFeedback q={q} answer={r?.answer ?? null} confidence={r?.confidence} onConfidence={(c) => {
                const next = { ...responses, [q.id]: { ...responses[q.id], confidence: c } };
                setResponses(next);
                persist(next, index);
              }} />
            ) : null}
          </article>

          <p className="mt-4 hidden text-center text-xs text-faint sm:block">
            <button type="button" onClick={() => setKeysOpen(true)} className="inline-flex min-h-8 items-center gap-1 underline underline-offset-4 hover:text-ink">
              <Keyboard aria-hidden="true" className="size-3.5" /> Keyboard shortcuts
            </button>
          </p>
        </main>

        {!practice ? (
          <aside aria-label="Question map" className="sticky top-24 hidden h-fit w-[280px] shrink-0 rounded-card border border-border-subtle bg-surface p-4 xl:block">
            <QuestionMap qs={qs} responses={responses} index={index} onGo={go} counts={counts} />
          </aside>
        ) : null}
      </div>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-surface/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[72px] max-w-[760px] items-center gap-3 px-3 sm:px-5 xl:max-w-[1080px] xl:pr-[312px]">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={btn("secondary", "md", "px-3 sm:px-5")} aria-label="Previous question">
            <ArrowLeft aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={practice && !checked[q.id] && (r?.answer == null || r.answer === "")}
            className={btn("primary", "md", "ml-auto min-w-[10rem] flex-1 sm:flex-none")}
          >
            {primaryLabel}
            <ArrowRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {/* Sheets & dialogs */}
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} title="Question map" variant="sheet">
        {practice ? (
          <ol className="flex flex-wrap gap-2">
            {qs.map((x, i) => (
              <li key={`${x.id}-${i}`}>
                <button type="button" onClick={() => go(i)} className={`size-11 rounded-card-sm border text-sm font-semibold ${i === index ? "border-2 border-primary" : "border-border-subtle"}`}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <QuestionMap qs={qs} responses={responses} index={index} onGo={go} counts={counts} />
        )}
      </Dialog>

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit your test?" description={remaining !== null ? `${clock(remaining)} left on the timer` : undefined}>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Answered", counts.answered],
            ["Marked", counts.marked],
            ["Not answered", counts.unanswered],
          ].map(([k, v]) => (
            <div key={k} className="rounded-card-sm border border-border-subtle bg-sunken px-2 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted">
          Unanswered questions score 0. Wrong answers cost {Math.abs(config.marking.incorrect)} mark. You can&apos;t change answers after submitting.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => setSubmitOpen(false)} className={btn("secondary")}>
            Keep working
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitOpen(false);
              finish("submit");
            }}
            className={btn("primary")}
          >
            Submit test
          </button>
        </div>
      </Dialog>

      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={practice ? "Leave practice?" : "Leave the test?"}
        description={
          remaining !== null
            ? `Your answers are saved. The timer keeps running: ${clock(remaining)} left.`
            : "Your answers so far are saved."
        }
      >
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => router.push(exitHref)} className={btn("secondary")}>
            Leave
          </button>
          <button type="button" autoFocus onClick={() => setExitOpen(false)} className={btn("primary")}>
            Keep going
          </button>
        </div>
      </Dialog>

      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keyboard shortcuts" description="Optional. Everything also works by tap or click.">
        <ShortcutRows rows={playerShortcuts(practice)} />
      </Dialog>

      {finishing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-6 animate-fade-in" role="alert" aria-busy="true">
          <div className="flex flex-col items-center gap-4 text-center">
            <LoaderCircle aria-hidden="true" className="size-10 animate-spin text-primary-text" />
            <p className="font-display text-2xl text-ink">
              {finishing === "timeout" ? "Time's up. Submitting your answers." : practice ? "Saving your practice" : "Scoring your answers"}
            </p>
            <p className="text-sm text-muted">Marked by fixed rules on our server, negative marking included.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* During a diagnostic the chapter is shown, never the concept (it would hint the answer). */
function chapterLabel(q: Question) {
  const c = conceptById(q.conceptId);
  return { "ch-plane": "Motion in a Plane", "ch-lom": "Laws of Motion", "ch-wep": "Work, Energy and Power" }[c.chapterId] ?? "";
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: CloudCheck, text: "Saved", cls: "text-muted" },
    saving: { icon: LoaderCircle, text: "Saving…", cls: "text-muted" },
    offline: { icon: CloudOff, text: "Offline, saved on this device", cls: "text-warning-text" },
  }[state];
  return (
    <p role="status" className={`flex items-center gap-1.5 text-xs font-medium ${map.cls}`}>
      <map.icon aria-hidden="true" className={`size-4 ${state === "saving" ? "animate-spin" : ""}`} />
      <span className={state === "offline" ? "" : "hidden sm:inline"}>{map.text}</span>
      {state !== "offline" ? <span className="sr-only sm:hidden">{map.text}</span> : null}
    </p>
  );
}

function TimerChip({ remaining, hidden, onToggle }: { remaining: number; hidden: boolean; onToggle: () => void }) {
  const tone = remaining <= 60 ? "bg-danger text-white border-danger" : remaining <= 300 ? "bg-warning/15 text-warning-text border-warning/50" : "bg-surface text-ink border-border-subtle";
  const showAnyway = remaining <= 60;
  return (
    <div className={`flex h-9 touch:h-11 items-center gap-1 rounded-full border pl-3 pr-1 text-sm font-bold tabular-nums ${tone}`}>
      <Timer aria-hidden="true" className="size-4" />
      <span aria-hidden="true" className="min-w-[3.2rem]">
        {hidden && !showAnyway ? "––:––" : clock(remaining)}
      </span>
      <span className="sr-only">Time left: {Math.ceil(remaining / 60)} minutes</span>
      <button type="button" onClick={onToggle} aria-label={hidden ? "Show timer" : "Hide timer"} className="flex size-7 touch:size-11 items-center justify-center rounded-full hover:bg-sunken/60">
        {hidden ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
}

function Options({ q, value, onChange, reveal }: { q: Question; value: string | null; onChange: (v: string) => void; reveal: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opts = q.options!;
  const focusIdx = Math.max(0, opts.findIndex((o) => o.key === value));
  return (
    <div role="radiogroup" aria-labelledby="q-stem" className="flex flex-col gap-3">
      {opts.map((o, i) => {
        const selected = value === o.key;
        const isAnswer = o.key === q.answer;
        let cls = "border border-border-subtle bg-surface hover:border-line hover:bg-sunken/40";
        let badge = "bg-sunken text-ink";
        let trailing = null;
        if (reveal) {
          if (isAnswer) {
            cls = "border border-success bg-success/10 ring-1 ring-success";
            badge = "bg-success text-white";
            trailing = <span className="flex items-center gap-1 text-xs font-bold text-success-text"><CircleCheck aria-hidden="true" className="size-4" />Correct answer</span>;
          } else if (selected) {
            cls = "border border-danger bg-danger/10 ring-1 ring-danger";
            badge = "bg-danger text-white";
            trailing = <span className="flex items-center gap-1 text-xs font-bold text-danger-text"><CircleX aria-hidden="true" className="size-4" />Your answer</span>;
          } else cls = "border border-border-subtle bg-surface opacity-70";
        } else if (selected) {
          cls = "border border-primary bg-primary/10 text-ink ring-1 ring-primary";
          badge = "bg-ink text-on-ink";
          trailing = <Check aria-hidden="true" className="size-5 text-ink" strokeWidth={2.5} />;
        }
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === focusIdx ? 0 : -1}
            disabled={reveal}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                const n = (i + 1) % opts.length;
                refs.current[n]?.focus();
                onChange(opts[n].key);
              } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                const n = (i - 1 + opts.length) % opts.length;
                refs.current[n]?.focus();
                onChange(opts[n].key);
              }
            }}
            className={`flex min-h-14 w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left transition-[background-color,border-color] duration-100 sm:px-4 ${cls}`}
          >
            <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${badge}`}>
              {o.key}
            </span>
            <span className="sr-only">Option {o.key}: </span>
            <MathText className="min-w-0 flex-1 text-base font-medium leading-relaxed text-ink">{o.text}</MathText>
            {trailing}
          </button>
        );
      })}
    </div>
  );
}

function NumericAnswer({
  value,
  onChange,
  onEnter,
  reveal,
  q,
}: {
  value: string;
  onChange: (v: string | null) => void;
  onEnter?: () => void;
  reveal: boolean;
  q: Question;
}) {
  const [draft, setDraft] = useState(value);
  const invalid = draft !== "" && !/^-?\d*\.?\d{0,2}$/.test(draft);
  const correct = reveal && isCorrect(q, draft);
  return (
    <div className="max-w-xs">
      <label htmlFor="numeric" className="text-sm font-semibold text-ink">
        Your answer
      </label>
      <input
        id="numeric"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        disabled={reveal}
        aria-invalid={invalid}
        aria-describedby="numeric-help"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => !invalid && onChange(draft.trim() === "" ? null : draft.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !invalid) {
            onChange(draft.trim() === "" ? null : draft.trim());
            onEnter?.();
          }
        }}
        className={`mt-2 h-14 w-full rounded-input border-2 bg-surface px-4 text-xl font-semibold tabular-nums text-ink outline-none focus:border-line ${
          reveal ? (correct ? "border-success" : "border-danger") : invalid ? "border-danger" : "border-border-subtle"
        }`}
      />
      <p id="numeric-help" className={`mt-2 text-sm ${invalid ? "text-danger-text" : "text-muted"}`}>
        {invalid ? "Enter a number, like 12 or 2.5." : "Enter a number. Up to 2 decimal places."}
      </p>
    </div>
  );
}

function PracticeHeader({ config, total }: { config: AttemptConfig; total: number }) {
  const c = conceptById(config.targetConceptId!);
  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border-subtle bg-surface px-4 py-3 text-sm sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <dt className="text-xs text-muted">Target</dt>
        <dd className="font-semibold text-ink">{c.name}</dd>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <dt className="text-xs text-muted">Goal</dt>
        <dd className="font-semibold text-ink">{config.goal}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Questions</dt>
        <dd className="font-semibold tabular-nums text-ink">{total}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Difficulty</dt>
        <dd className="font-semibold text-ink">Matched to you</dd>
      </div>
    </dl>
  );
}

function PracticeFeedback({
  q,
  answer,
  confidence,
  onConfidence,
}: {
  q: Question;
  answer: string | null;
  confidence?: number;
  onConfidence: (c: number) => void;
}) {
  const ok = isCorrect(q, answer);
  return (
    <div className="mt-6 animate-fade-in" role="status">
      <div className={`rounded-card-sm border-l-4 p-4 ${ok ? "border-success bg-success/10" : "border-danger bg-danger/10"}`}>
        <p className={`flex items-center gap-2 font-semibold ${ok ? "text-success-text" : "text-danger-text"}`}>
          {ok ? <CircleCheck aria-hidden="true" className="size-5" /> : <CircleX aria-hidden="true" className="size-5" />}
          {ok ? "Correct" : `Not quite. The answer is ${q.type === "mcq" ? q.answer : q.answer}.`}
        </p>
        {!ok && q.missCause ? <p className="mt-1 text-sm text-ink">Looks like a {CATEGORY_LABEL[q.missCause].toLowerCase()} error.</p> : null}
        <details className="mt-3" open={!ok}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">Solution</summary>
          <MathText as="p" className="mt-2 text-[15px] leading-relaxed text-ink">
            {q.solution}
          </MathText>
        </details>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-muted">How sure were you? (optional)</legend>
        <div className="mt-2 flex gap-2">
          {[
            ["Guess", 0.2],
            ["Unsure", 0.5],
            ["Sure", 0.9],
          ].map(([label, v]) => (
            <button
              key={label}
              type="button"
              aria-pressed={confidence === v}
              onClick={() => onConfidence(v as number)}
              className={`h-10 touch:h-11 rounded-full border px-4 text-sm font-semibold ${
                confidence === v ? "border border-primary bg-primary/10 text-ink" : "border-border-subtle text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function QuestionMap({
  qs,
  responses,
  index,
  onGo,
  counts,
}: {
  qs: Question[];
  responses: Record<string, Response>;
  index: number;
  onGo: (i: number) => void;
  counts: { answered: number; marked: number; unanswered: number };
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        Answered {counts.answered} · Marked {counts.marked} · Not answered {counts.unanswered}
      </p>
      <ol className="mt-3 grid grid-cols-5 gap-2">
        {qs.map((x, i) => {
          const rr = responses[x.id];
          const answered = rr?.answer != null && rr.answer !== "";
          const marked = !!rr?.marked;
          const current = i === index;
          const state = [answered ? "answered" : "not answered", marked ? "marked for review" : "", current ? "current" : ""].filter(Boolean).join(", ");
          return (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-label={`Question ${i + 1}, ${state}`}
                aria-current={current ? "step" : undefined}
                className={`relative flex size-11 items-center justify-center rounded-card-sm text-sm font-semibold tabular-nums xl:size-10 ${
                  answered ? "bg-primary/20 text-ink" : "bg-surface text-muted"
                } ${marked ? "border-2 border-warning" : current ? "border-2 border-primary" : answered ? "border border-line" : "border border-border-subtle"} ${
                  current && marked ? "ring-2 ring-line ring-offset-1" : ""
                }`}
              >
                {i + 1}
                {marked ? <Flag aria-hidden="true" className="absolute -right-1 -top-1 size-3.5 fill-warning text-warning-text" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-col gap-1.5 text-xs text-muted">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm border border-line bg-primary/20" />Answered</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm border-2 border-warning" />Marked for review</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm border border-border-subtle" />Not answered</li>
      </ul>
    </div>
  );
}
