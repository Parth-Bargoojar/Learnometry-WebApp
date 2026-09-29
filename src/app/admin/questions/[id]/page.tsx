import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { stamp } from "@/lib/admin";
import { chapterById, conceptById, questions } from "@/lib/data";
import { admins, questionMetaById } from "@/lib/admin-data";
import { duration } from "@/lib/format";
import { AdminHeader, Mono, Panel } from "@/components/admin-ui";
import { QuestionReview } from "@/components/admin-content";
import { MathText } from "@/components/math";
import { FieldLabel } from "@/components/ui";

export async function generateMetadata(props: PageProps<"/admin/questions/[id]">): Promise<Metadata> {
  return { title: `Question ${(await props.params).id}` };
}

/** Question detail — §8.19: student-view preview with KaTeX, metadata, validators, versions, Publish/Suspend. */
export default async function AdminQuestionPage(props: PageProps<"/admin/questions/[id]">) {
  const { id } = await props.params;
  const q = questions.find((x) => x.id === id);
  const meta = questionMetaById(id);
  if (!q || !meta) notFound();
  const concept = conceptById(q.conceptId);

  return (
    <div>
      <Link href="/admin/questions" className="mb-2 inline-flex h-9 items-center text-sm font-semibold text-muted hover:text-ink">
        ← Questions
      </Link>
      <AdminHeader title={`Question ${q.id}`} meta={`${concept.name} · ${chapterById(concept.chapterId).name} · ${meta.exam}`} />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 xl:col-span-7">
          <Panel title="Student view" meta="As it renders in the player">
            <div className="rounded-card-sm border border-border-subtle bg-background p-5">
              <MathText as="p" className="text-[17px] leading-relaxed text-ink">
                {q.stem}
              </MathText>
              {q.options ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {q.options.map((o) => (
                    <li
                      key={o.key}
                      className={`flex items-start gap-3 rounded-btn border px-3 py-2.5 ${o.key === q.answer ? "border-2 border-success bg-success/5" : "border-border-subtle bg-surface"}`}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">{o.key}</span>
                      <MathText className="pt-0.5 text-ink">{o.text}</MathText>
                      {o.key === q.answer ? <span className="ml-auto self-center text-xs font-semibold text-success-text">Answer</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink">
                  Numerical answer: <strong className="tabular-nums">{q.answer}</strong>
                  {q.tolerance ? <span className="text-muted"> (± {q.tolerance * 100}%)</span> : null}
                </p>
              )}
            </div>
            <div className="mt-5">
              <FieldLabel>Solution</FieldLabel>
              <MathText as="p" className="mt-1.5 text-[15px] leading-relaxed text-ink">
                {q.solution}
              </MathText>
            </div>
            {q.hint ? (
              <div className="mt-4">
                <FieldLabel>Hint</FieldLabel>
                <MathText as="p" className="mt-1.5 text-[15px] text-ink">
                  {q.hint}
                </MathText>
              </div>
            ) : null}
          </Panel>

          <Panel title="Version history">
            <ol className="divide-y divide-border-subtle">
              {[...meta.versions].reverse().map((v) => (
                <li key={v.n} className="flex flex-wrap items-baseline gap-x-3 py-2.5 text-sm">
                  <span className="font-semibold text-ink">v{v.n}</span>
                  <span className="tabular-nums text-muted">{stamp(v.at)}</span>
                  <span className="text-muted">{admins[v.by] ?? v.by}</span>
                  <span className="min-w-0 flex-1 text-ink">{v.reason}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">Attempts keep the version they used. A content change makes a new version, which starts again at Draft.</p>
          </Panel>
        </div>

        <div className="col-span-12 flex flex-col gap-6 xl:col-span-5">
          <QuestionReview meta={meta} />
          <Panel title="Metadata">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Row label="ID"><Mono>{q.id}</Mono></Row>
              <Row label="Type">{q.type === "mcq" ? "Multiple choice" : "Numerical"}</Row>
              <Row label="Difficulty"><span className="capitalize">{q.difficulty}</span></Row>
              <Row label="Used in">{meta.use}</Row>
              <Row label="Expected time">{duration(q.expectedSeconds)}</Row>
              <Row label="Quality score">{meta.quality.toFixed(2)}</Row>
              <Row label="Served">{meta.served || "Not yet"}</Row>
              <Row label="Answered correctly">{meta.correctRate === null ? "—" : `${Math.round(meta.correctRate * 100)}%`}</Row>
              <Row label="Source"><span className="capitalize">{meta.source}</span></Row>
              <Row label="Miss usually means"><span className="capitalize">{q.missCause?.replace("_", " ") ?? "—"}</span></Row>
              <Row label="Learning objective" className="col-span-2">{meta.learningObjective}</Row>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}
