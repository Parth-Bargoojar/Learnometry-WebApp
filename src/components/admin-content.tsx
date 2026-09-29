"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, OctagonAlert, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import {
  AUTOMATED_VALIDATORS,
  QUESTION_STATUS_LABEL,
  VALIDATOR_LABEL,
  canSuspend,
  cyclePath,
  publishBlockers,
  stamp,
  type Edge,
  type QuestionStatus,
  type ValidationResult,
  type ValidatorType,
} from "@/lib/admin";
import { admins, curriculumEdges, curriculumVersion, type QuestionMeta } from "@/lib/admin-data";
import { SHARED, useShared } from "@/lib/local-store";
import { MathText } from "./math";
import { ReasonDialog, field, labelCls, nowIso, useAuditLog } from "./admin-core";
import { Pill, num, td, th, type Tone } from "./admin-ui";
import { useToast } from "./toast";
import { btn } from "./ui";

/* ------------------------------------------------------------------ */
/* Question state (K6)                                                 */
/* ------------------------------------------------------------------ */

type QPatch = { status?: QuestionStatus; human?: ValidationResult; note?: string; by?: string; at?: string };

function useQuestionPatches() {
  return useShared<Record<string, QPatch>>(SHARED.adminQuestions, {});
}

function merged(m: QuestionMeta, p?: QPatch) {
  const validations = p?.human ? { ...m.validations, human: { result: p.human } } : m.validations;
  const results = Object.fromEntries(Object.entries(validations).map(([k, v]) => [k, v.result])) as Record<ValidatorType, ValidationResult>;
  return { ...m, status: p?.status ?? m.status, statusNote: p?.note ?? m.statusNote, validations, results };
}

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

export interface QuestionRow {
  meta: QuestionMeta;
  stem: string;
  concept: string;
  chapter: string;
}

export function QuestionTable({ rows, statusFilter }: { rows: QuestionRow[]; statusFilter?: QuestionStatus }) {
  const [patches, set] = useQuestionPatches();
  const log = useAuditLog();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<"publish" | "suspend" | null>(null);

  const visible = useMemo(
    () => rows.map((r) => ({ ...r, q: merged(r.meta, patches[r.meta.id]) })).filter((r) => !statusFilter || r.q.status === statusFilter),
    [rows, patches, statusFilter],
  );
  const chosen = visible.filter((r) => selected.has(r.meta.id));
  const plan = (kind: "publish" | "suspend") => {
    const ok = chosen.filter((r) => (kind === "publish" ? !publishBlockers(r.q.status, r.q.results).length : canSuspend(r.q.status)));
    const skipped = chosen.filter((r) => !ok.includes(r));
    return { ok, skipped };
  };
  const p = bulk ? plan(bulk) : null;
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r.meta.id));

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
                    onChange={() => setSelected(allOn ? new Set() : new Set(visible.map((r) => r.meta.id)))}
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
                <tr key={r.meta.id} className={selected.has(r.meta.id) ? "bg-sunken" : undefined}>
                  <td className={td}>
                    <input type="checkbox" aria-label={`Select ${r.meta.id}`} checked={selected.has(r.meta.id)} onChange={() => toggle(r.meta.id)} className="size-6 accent-[var(--color-ink)]" />
                  </td>
                  <td className={`${td} max-w-md`}>
                    <Link href={`/admin/questions/${r.meta.id}`} className="font-mono text-[13px] font-semibold text-ink underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                      {r.meta.id}
                    </Link>
                    <MathText as="span" className="mt-0.5 line-clamp-2 block text-muted">{r.stem}</MathText>
                  </td>
                  <td className={td}>
                    {r.concept}
                    <span className="block text-xs text-muted">{r.chapter}</span>
                  </td>
                  <td className={td}>{r.meta.use}</td>
                  <td className={`${td} capitalize`}>{r.meta.difficulty}</td>
                  <td className={td}><ValidationSummary results={r.q.results} /></td>
                  <td className={td}><Pill tone={STATUS_TONE[r.q.status]}>{QUESTION_STATUS_LABEL[r.q.status]}</Pill></td>
                  <td className={`${td} ${num}`}>{r.meta.served || "—"}</td>
                  <td className={`${td} ${num}`}>{r.meta.correctRate === null ? "—" : `${Math.round(r.meta.correctRate * 100)}%`}</td>
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
                {p.ok.length ? `: ${p.ok.map((r) => r.meta.id).join(", ")}` : ""}.{" "}
                {bulk === "publish" ? "They can appear in new assessments at once." : "They leave new assessments at once; attempts in progress still score them."}
              </p>
              {p.skipped.length ? (
                <div>
                  <p className="font-semibold">Skips {p.skipped.length}:</p>
                  <ul className="mt-1 list-disc pl-4 text-muted">
                    {p.skipped.map((r) => (
                      <li key={r.meta.id}>
                        {r.meta.id}: {bulk === "publish" ? publishBlockers(r.q.status, r.q.results).join(" ") : `${QUESTION_STATUS_LABEL[r.q.status]}, not published.`}
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
          const status: QuestionStatus = bulk === "publish" ? "published" : "suspended";
          set((prev) => {
            const next = { ...prev };
            for (const r of p.ok) next[r.meta.id] = { ...next[r.meta.id], status, note: bulk === "suspend" ? reason : undefined, by: "usr_admin_aarav", at: nowIso() };
            return next;
          });
          for (const r of p.ok) log({ action: `question.${status}`, resourceType: "question", resourceId: r.meta.id, summary: `${QUESTION_STATUS_LABEL[r.q.status]} → ${QUESTION_STATUS_LABEL[status]} (bulk)`, reason });
          setSelected(new Set());
          toast.show(`${bulk === "publish" ? "Published" : "Suspended"} ${p.ok.length}${p.skipped.length ? `, skipped ${p.skipped.length}` : ""}`);
        }}
      />
      {toast.node}
    </>
  );
}

/** Detail page panel: validators, status and the actions they allow. */
export function QuestionReview({ meta }: { meta: QuestionMeta }) {
  const [patches, set] = useQuestionPatches();
  const log = useAuditLog();
  const toast = useToast();
  const q = merged(meta, patches[meta.id]);
  const blockers = publishBlockers(q.status, q.results);
  const autoFail = AUTOMATED_VALIDATORS.some((v) => q.results[v] === "fail");
  const [action, setAction] = useState<"review" | "publish" | "suspend" | null>(null);

  const copy = {
    review: { title: "Record your review?", summary: "You checked the stem, answer, solution, syllabus fit and exam style. Status becomes Reviewed.", label: "Mark reviewed" },
    publish: { title: `Publish ${meta.id}?`, summary: "It can appear in new diagnostics, practice and retests at once.", label: "Publish" },
    suspend: { title: `Suspend ${meta.id}?`, summary: "It leaves new assessments at once. Attempts in progress still score it, and past results don't change.", label: "Suspend" },
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
          {q.results.human !== "pass" && !autoFail ? (
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
          if (!action) return;
          const before = q.status;
          const patch: QPatch =
            action === "review"
              ? { human: "pass", status: q.status === "draft" || q.status === "validated" ? "reviewed" : q.status }
              : { status: action === "publish" ? "published" : "suspended", note: action === "suspend" ? reason : undefined };
          set((prev) => ({ ...prev, [meta.id]: { ...prev[meta.id], ...patch, by: "usr_admin_aarav", at: nowIso() } }));
          log({
            action: action === "review" ? "question.reviewed" : `question.${patch.status}`,
            resourceType: "question",
            resourceId: meta.id,
            summary: action === "review" ? "Human review: pass" : `${QUESTION_STATUS_LABEL[before]} → ${QUESTION_STATUS_LABEL[patch.status!]}`,
            reason,
          });
          toast.show(action === "review" ? "Review recorded" : action === "publish" ? "Published" : "Suspended");
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Curriculum edges (K7)                                               */
/* ------------------------------------------------------------------ */

type CurriculumState = { draft: Edge[] | null; published: { version: string; at: string; edges: Edge[] } | null };

const key = (e: Edge) => `${e.from}>${e.to}`;
const bump = (v: string) => {
  const [maj, min] = v.slice(1).split(".").map(Number);
  return `v${maj}.${min + 1}`;
};

export function CurriculumEdges({ concepts }: { concepts: { id: string; name: string }[] }) {
  const [state, set] = useShared<CurriculumState>(SHARED.adminCurriculum, { draft: null, published: null });
  const log = useAuditLog();
  const toast = useToast();
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [publishing, setPublishing] = useState(false);

  const name = (c: string) => concepts.find((x) => x.id === c)?.name ?? c;
  const baseline = state.published?.edges ?? curriculumEdges;
  const version = state.published?.version ?? curriculumVersion.published;
  const draft = state.draft ?? baseline;
  const base = new Set(baseline.map(key));
  const now = new Set(draft.map(key));
  const added = draft.filter((e) => !base.has(key(e)));
  const removed = baseline.filter((e) => !now.has(key(e)));
  const changes = added.length + removed.length;

  const candidate = from && to ? { from, to } : null;
  const exists = candidate ? now.has(key(candidate)) : false;
  const cycle = candidate && !exists ? cyclePath(draft, candidate.from, candidate.to) : null;

  const setDraft = (edges: Edge[]) => set((prev) => ({ ...prev, draft: edges }));

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-base font-semibold text-ink">
            Prerequisites
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Published {version} · draft {bump(version)} with {changes} change{changes === 1 ? "" : "s"}. Shared by every exam track.
          </p>
        </div>
        <div className="flex gap-2">
          {changes ? (
            <button type="button" onClick={() => set((prev) => ({ ...prev, draft: null }))} className={btn("ghost", "sm")}>
              Discard draft
            </button>
          ) : null}
          <button type="button" disabled={!changes} onClick={() => setPublishing(true)} className={btn("primary", "sm")}>
            Publish {bump(version)}
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
        Last published {stamp(state.published?.at ?? curriculumVersion.publishedAt)} by {state.published ? "you" : admins[curriculumVersion.publishedBy]}.
      </p>

      <ReasonDialog
        open={publishing}
        onClose={() => setPublishing(false)}
        title={`Publish curriculum ${bump(version)}?`}
        summary={
          <>
            {added.length} edge{added.length === 1 ? "" : "s"} added, {removed.length} removed. New plans and diagnostics use {bump(version)} at once; existing plans keep their version until the next retest or rebuild.
          </>
        }
        confirmLabel={`Publish ${bump(version)}`}
        onConfirm={(reason) => {
          const next = bump(version);
          set({ draft: null, published: { version: next, at: nowIso(), edges: draft } });
          log({ action: "curriculum.published", resourceType: "curriculum", resourceId: next, summary: `Published ${next}: +${added.length} / −${removed.length} edges`, reason });
          toast.show(`Curriculum ${next} published`);
        }}
      />
      {toast.node}
    </section>
  );
}
