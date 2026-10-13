"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleDashed, OctagonAlert, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import {
  AUTOMATED_VALIDATORS,
  QUESTION_STATUS_LABEL,
  VALIDATOR_LABEL,
  canSuspend,
  transitionBlocker,
  cyclePath,
  publishBlockers,
  stamp,
  type Edge,
  type QuestionAction,
  type QuestionStatus,
  type ValidationResult,
  type ValidatorType,
} from "@/lib/admin";
import { discardCurriculumDraftAction, publishCurriculumAction, saveCurriculumDraftAction } from "@/app/admin/curriculum/actions";
import { changeQuestionsAction } from "@/app/admin/questions/actions";
import type { AdminQuestion, AdminQuestionDetail } from "@/domains/content/types";
import { MathText } from "./math";
import { ReasonDialog, field, labelCls } from "./admin-core";
import { Pill, num, td, th, type Tone } from "./admin-ui";
import { useToast } from "./toast";
import { btn } from "./ui";

/* ------------------------------------------------------------------ */
/* Question state (K6)                                                 */
/* ------------------------------------------------------------------ */

type TransitionResult = { done: string[]; skipped: { id: string; reason: string }[] };
const results = (q: AdminQuestion) => Object.fromEntries(Object.entries(q.validations).map(([k, v]) => [k, v.result])) as Record<ValidatorType, ValidationResult>;

export const STATUS_TONE: Record<QuestionStatus, Tone> = { draft: "outline", validated: "info", reviewed: "warning", published: "success", suspended: "danger" };

const RESULT: Record<ValidationResult, { icon: LucideIcon; cls: string; label: string }> = {
  pass: { icon: CircleCheck, cls: "text-success-text", label: "Pass" },
  warning: { icon: TriangleAlert, cls: "text-warning-text", label: "Warning" },
  fail: { icon: OctagonAlert, cls: "text-danger-text", label: "Fail" },
  pending: { icon: CircleDashed, cls: "text-muted", label: "Pending" },
};

function ValidationSummary({ results }: { results: Record<ValidatorType, ValidationResult> }) {
  const auto = AUTOMATED_VALIDATORS.map((v) => results[v]);
  const fail = auto.filter((r) => r === "fail").length;
  const warn = auto.filter((r) => r === "warning").length;
  const pass = auto.filter((r) => r === "pass").length;
  return (
    <span className="flex flex-wrap gap-1">
      {fail ? <Pill tone="danger" icon={OctagonAlert}>{fail} fail</Pill> : null}
      {warn ? <Pill tone="warning" icon={TriangleAlert}>{warn} warning</Pill> : null}
      {!fail && !warn ? <Pill tone="success" icon={CircleCheck}>{pass}/{auto.length} pass</Pill> : null}
      {results.human !== "pass" ? <Pill tone="outline" icon={CircleDashed}>Review</Pill> : null}
    </span>
  );
}

export type QuestionRow = AdminQuestion;

/** Calls the server action and reports its outcome; the page re-renders from the database afterwards. */
function useQuestionChange() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const change = (action: QuestionAction, ids: string[], reason: string, done?: (r: TransitionResult) => void) =>
    start(async () => {
      const res = await changeQuestionsAction({ action, ids, reason });
      if (!res.ok) return toast.show(res.error.message);
      const verb = action === "review" ? "Reviewed" : action === "publish" ? "Published" : "Suspended";
      toast.show(`${verb} ${res.data.done.length}${res.data.skipped.length ? `, skipped ${res.data.skipped.length}` : ""}`);
      done?.(res.data);
      router.refresh();
    });
  return { change, pending, toast };
}

export function QuestionTable({ rows }: { rows: QuestionRow[] }) {
  const { change, pending, toast } = useQuestionChange();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<"publish" | "suspend" | null>(null);

  const visible = rows;
  const chosen = visible.filter((r) => selected.has(r.id));
  const plan = (kind: "publish" | "suspend") => {
    const blocker = (r: QuestionRow) => transitionBlocker(kind, r.status, results(r));
    const ok = chosen.filter((r) => !blocker(r));
    const skipped = chosen.filter((r) => blocker(r)).map((r) => ({ row: r, why: blocker(r)! }));
    return { ok, skipped };
  };
  const p = bulk ? plan(bulk) : null;
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!visible.length) {
    return (
      <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">
        No questions match these filters.{" "}
        <Link href="/admin/questions" className="font-semibold text-primary-text underline underline-offset-4">
          Clear filters
        </Link>
      </p>
    );
  }

  return (
    <>
      <div className="sticky top-[var(--topbar-h)] z-10 mb-3 flex min-h-12 flex-wrap items-center gap-3 rounded-card border border-border-subtle bg-surface px-4 py-2">
        <p className="text-sm text-muted" aria-live="polite">
          {chosen.length ? <strong className="text-ink">{chosen.length} selected</strong> : `${visible.length} questions`}
        </p>
        {chosen.length ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulk("publish")} className={btn("primary", "sm")}>
              Publish
            </button>
            <button type="button" onClick={() => setBulk("suspend")} className={btn("secondary", "sm")}>
              Suspend
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className={btn("ghost", "sm")}>
              Clear selection
            </button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
        <div tabIndex={0} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Questions</caption>
            <thead>
              <tr>
                <th scope="col" className={`${th} w-10`}>
                  <input
                    type="checkbox"
                    aria-label="Select all shown questions"
                    checked={allOn}
                    onChange={() => setSelected(allOn ? new Set() : new Set(visible.map((r) => r.id)))}
                    className="size-6 accent-[var(--color-ink)]"
                  />
                </th>
                <th scope="col" className={th}>Question</th>
                <th scope="col" className={th}>Concept</th>
                <th scope="col" className={th}>Use</th>
                <th scope="col" className={th}>Difficulty</th>
                <th scope="col" className={th}>Validation</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={`${th} ${num}`}>Served</th>
                <th scope="col" className={`${th} ${num}`}>Correct</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "bg-sunken" : undefined}>
                  <td className={td}>
                    <input type="checkbox" aria-label={`Select ${r.slug}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-6 accent-[var(--color-ink)]" />
                  </td>
                  <td className={`${td} max-w-md`}>
                    <Link href={`/admin/questions/${r.id}`} className="font-mono text-[13px] font-semibold text-ink underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                      {r.slug}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{r.exam}</span>
                    <MathText as="span" className="mt-0.5 line-clamp-2 block text-muted">{r.stem}</MathText>
                  </td>
                  <td className={td}>
                    {r.conceptName}
                    <span className="block text-xs text-muted">{r.chapterName}</span>
                  </td>
                  <td className={td}>{r.use}</td>
                  <td className={`${td} capitalize`}>{r.difficulty}</td>
                  <td className={td}><ValidationSummary results={results(r)} /></td>
                  <td className={td}><Pill tone={STATUS_TONE[r.status]}>{QUESTION_STATUS_LABEL[r.status]}</Pill></td>
                  <td className={`${td} ${num}`}>{r.served || "—"}</td>
                  <td className={`${td} ${num}`}>{r.correctRate === null ? "—" : `${Math.round(r.correctRate * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        title={bulk === "publish" ? "Publish selected questions?" : "Suspend selected questions?"}
        summary={
          p ? (
            <div className="flex flex-col gap-2">
              <p>
                {bulk === "publish" ? "Publishes" : "Suspends"} <strong>{p.ok.length}</strong>
                {p.ok.length ? `: ${p.ok.map((r) => r.slug).join(", ")}` : ""}.{" "}
                {bulk === "publish" ? "They can appear in new assessments at once." : "They leave new assessments at once; attempts in progress still score them."}
              </p>
              {p.skipped.length ? (
                <div>
                  <p className="font-semibold">Skips {p.skipped.length}:</p>
                  <ul className="mt-1 list-disc pl-4 text-muted">
                    {p.skipped.map(({ row, why }) => (
                      <li key={row.id}>
                        {row.slug}: {why}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null
        }
        validate={() => (p && !p.ok.length ? `None of the selected questions can be ${bulk === "publish" ? "published" : "suspended"}.` : null)}
        confirmLabel={bulk === "publish" ? `Publish ${p?.ok.length ?? 0}` : `Suspend ${p?.ok.length ?? 0}`}
        destructive={bulk === "suspend"}
        onConfirm={(reason) => {
          if (!p || !bulk) return;
          change(bulk, p.ok.map((r) => r.id), reason, () => setSelected(new Set()));
        }}
      />
      {pending ? <p className="sr-only" role="status">Saving…</p> : null}
      {toast.node}
    </>
  );
}

/** Detail page panel: validators, status and the actions they allow. */
export function QuestionReview({ question }: { question: AdminQuestionDetail }) {
  const { change, toast } = useQuestionChange();
  const q = question;
  const res = results(q);
  const blockers = publishBlockers(q.status, res);
  const autoFail = AUTOMATED_VALIDATORS.some((v) => res[v] === "fail");
  const [action, setAction] = useState<QuestionAction | null>(null);

  const copy = {
    review: { title: "Record your review?", summary: "You checked the stem, answer, solution, syllabus fit and exam style. Status becomes Reviewed.", label: "Mark reviewed" },
    publish: { title: `Publish ${q.slug}?`, summary: "It can appear in new diagnostics, practice and retests at once.", label: "Publish" },
    suspend: { title: `Suspend ${q.slug}?`, summary: "It leaves new assessments at once. Attempts in progress still score it, and past results don't change.", label: "Suspend" },
  } as const;

  return (
    <>
      <section className="rounded-card border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Status</h2>
          <Pill tone={STATUS_TONE[q.status]}>{QUESTION_STATUS_LABEL[q.status]}</Pill>
        </div>
        {q.statusNote ? <p className="mt-2 text-sm text-muted">{q.statusNote}</p> : null}
        {q.status !== "published" && blockers.length ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-ink">
            {blockers.map((b) => (
              <li key={b} className="flex gap-2">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-text" />
                {b}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {res.human !== "pass" && !autoFail && q.status !== "published" ? (
            <button type="button" onClick={() => setAction("review")} className={btn("secondary", "sm")}>
              Mark reviewed
            </button>
          ) : null}
          {q.status !== "published" ? (
            <button type="button" disabled={blockers.length > 0} onClick={() => setAction("publish")} className={btn("primary", "sm")}>
              Publish
            </button>
          ) : null}
          {canSuspend(q.status) ? (
            <button type="button" onClick={() => setAction("suspend")} className={btn("destructive", "sm")}>
              Suspend
            </button>
          ) : null}
        </div>
        {autoFail ? <p className="mt-3 text-sm text-muted">Fix the content in the question source and re-import; the new version runs the validators again.</p> : null}
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Validation</h2>
        <ul className="mt-3 divide-y divide-border-subtle">
          {([...AUTOMATED_VALIDATORS, "human"] as ValidatorType[]).map((v) => {
            const r = q.validations[v];
            const R = RESULT[r.result];
            return (
              <li key={v} className="flex items-start gap-3 py-2.5">
                <R.icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${R.cls}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{VALIDATOR_LABEL[v]}</p>
                  {r.note ? <p className="text-xs text-muted">{r.note}</p> : null}
                </div>
                <span className={`text-xs font-semibold ${R.cls}`}>{R.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <ReasonDialog
        open={!!action}
        onClose={() => setAction(null)}
        title={action ? copy[action].title : ""}
        summary={action ? copy[action].summary : null}
        confirmLabel={action ? copy[action].label : ""}
        destructive={action === "suspend"}
        onConfirm={(reason) => {
          if (action) change(action, [q.id], reason);
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Curriculum edges (K7)                                               */
/* ------------------------------------------------------------------ */

const key = (e: Edge) => `${e.from}>${e.to}`;

export function CurriculumEdges({
  examCode,
  version,
  published,
  draft: savedDraft,
  concepts,
  publishedAt,
  publishedBy,
}: {
  examCode: string;
  version: number;
  published: Edge[];
  draft: Edge[] | null;
  concepts: { id: string; name: string }[];
  publishedAt: string | null;
  publishedBy: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [saving, start] = useTransition();
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [draft, setLocal] = useState<Edge[]>(savedDraft ?? published);

  const next = `v${version + 1}`;
  const name = (c: string) => concepts.find((x) => x.id === c)?.name ?? c;
  const baseline = published;
  const base = new Set(baseline.map(key));
  const now = new Set(draft.map(key));
  const added = draft.filter((e) => !base.has(key(e)));
  const removed = baseline.filter((e) => !now.has(key(e)));
  const changes = added.length + removed.length;

  const candidate = from && to ? { from, to } : null;
  const exists = candidate ? now.has(key(candidate)) : false;
  const cycle = candidate && !exists ? cyclePath(draft, candidate.from, candidate.to) : null;

  /** Show the change at once and save it as this track's draft; a refusal puts the old list back. */
  const setDraft = (edges: Edge[]) => {
    const before = draft;
    setLocal(edges);
    start(async () => {
      const res = await saveCurriculumDraftAction({ exam: examCode, edges });
      if (!res.ok) {
        setLocal(before);
        toast.show(res.error.message);
      }
    });
  };

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-base font-semibold text-ink">
            Prerequisites
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Published v{version} · draft {next} with {changes} change{changes === 1 ? "" : "s"}. This track&apos;s own graph.
          </p>
        </div>
        <div className="flex gap-2">
          {changes ? (
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const res = await discardCurriculumDraftAction({ exam: examCode });
                  if (!res.ok) return toast.show(res.error.message);
                  setLocal(published);
                  router.refresh();
                })
              }
              className={btn("ghost", "sm")}
            >
              Discard draft
            </button>
          ) : null}
          <button type="button" disabled={!changes || saving} onClick={() => setPublishing(true)} className={btn("primary", "sm")}>
            Publish {next}
          </button>
        </div>
      </div>

      <form
        className="mt-5 grid grid-cols-2 items-end gap-3 rounded-card-sm border border-border-subtle bg-sunken p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!candidate || exists || cycle) return;
          setDraft([...draft, candidate]);
          setFrom("");
          setTo("");
        }}
      >
        <div>
          <label htmlFor={`${id}-from`} className={labelCls}>
            Prerequisite
          </label>
          <select id={`${id}-from`} value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} h-10`}>
            <option value="">Choose a concept</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-to`} className={labelCls}>
            Comes before
          </label>
          <select id={`${id}-to`} value={to} onChange={(e) => setTo(e.target.value)} className={`${field} h-10`}>
            <option value="">Choose a concept</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={!candidate || exists || !!cycle} className={btn("secondary", "sm", "h-10 justify-self-start col-span-2")}>
          Add edge
        </button>
        <div aria-live="polite" className="col-span-2 text-sm">
          {candidate ? (
            exists ? (
              <p className="text-muted">That edge already exists.</p>
            ) : cycle ? (
              <p className="flex gap-2 text-danger-text">
                <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {cycle.length === 1
                  ? "A concept can't be its own prerequisite."
                  : `This would create a loop: ${cycle.map(name).join(" → ")} → ${name(candidate.to)}. Remove an edge in the loop first.`}
              </p>
            ) : (
              <p className="flex gap-2 text-success-text">
                <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                No loop. Plans will teach {name(candidate.from)} before {name(candidate.to)}.
              </p>
            )
          ) : null}
        </div>
      </form>

      <table className="mt-4 w-full border-collapse text-left text-sm">
        <caption className="sr-only">Prerequisite edges in the draft</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>Prerequisite</th>
            <th scope="col" className={th}>Comes before</th>
            <th scope="col" className={th}>Draft</th>
            <th scope="col" className={th}><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {[...draft, ...removed].map((e) => {
            const isAdded = !base.has(key(e));
            const isRemoved = !now.has(key(e));
            return (
              <tr key={key(e)} className={isRemoved ? "text-muted line-through" : undefined}>
                <td className={td}>{name(e.from)}</td>
                <td className={td}>{name(e.to)}</td>
                <td className={td}>{isAdded ? <Pill tone="info">Added</Pill> : isRemoved ? <Pill tone="warning">Removed</Pill> : null}</td>
                <td className={`${td} text-right`}>
                  {isRemoved ? (
                    <button type="button" onClick={() => setDraft([...draft, e])} className="h-9 rounded-btn px-2 text-sm font-semibold text-primary-text underline underline-offset-4">
                      Undo
                    </button>
                  ) : (
                    <button type="button" onClick={() => setDraft(draft.filter((x) => key(x) !== key(e)))} aria-label={`Remove: ${name(e.from)} before ${name(e.to)}`} className="inline-flex size-9 items-center justify-center rounded-btn text-muted hover:bg-sunken hover:text-danger-text">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-muted">
        {publishedAt ? `Last published ${stamp(publishedAt)}${publishedBy ? ` by ${publishedBy}` : ""}.` : `v${version} is the initial graph.`}
      </p>

      <ReasonDialog
        open={publishing}
        onClose={() => setPublishing(false)}
        title={`Publish curriculum ${next}?`}
        summary={
          <>
            {added.length} edge{added.length === 1 ? "" : "s"} added, {removed.length} removed. New plans and diagnostics use {next} at once; existing plans keep their version until the next retest or rebuild.
          </>
        }
        confirmLabel={`Publish ${next}`}
        onConfirm={(reason) =>
          start(async () => {
            const res = await publishCurriculumAction({ exam: examCode, reason });
            if (!res.ok) return toast.show(res.error.message);
            toast.show(`Curriculum v${res.data.version} published`);
            router.refresh();
          })
        }
      />
      {toast.node}
    </section>
  );
}
