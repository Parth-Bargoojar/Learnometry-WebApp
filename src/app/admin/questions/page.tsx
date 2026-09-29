import type { Metadata } from "next";
import Link from "next/link";
import { QUESTION_STATUS_LABEL, type QuestionStatus } from "@/lib/admin";
import { chapterById, chapters, conceptById, concepts, questionById } from "@/lib/data";
import { questionMeta } from "@/lib/admin-data";
import { AdminHeader, FilterSelect } from "@/components/admin-ui";
import { QuestionTable, type QuestionRow } from "@/components/admin-content";
import { btn } from "@/components/ui";

export const metadata: Metadata = { title: "Questions" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Question manager — §8.19: filters in the URL, validation chips, bulk publish/suspend (K6). */
export default async function AdminQuestionsPage(props: PageProps<"/admin/questions">) {
  const sp = await props.searchParams;
  const f = {
    exam: str(sp.exam),
    chapter: str(sp.chapter),
    concept: str(sp.concept),
    difficulty: str(sp.difficulty),
    use: str(sp.use),
    status: str(sp.status) && str(sp.status)! in QUESTION_STATUS_LABEL ? (str(sp.status) as QuestionStatus) : undefined,
  };

  const rows: QuestionRow[] = questionMeta
    .filter(
      (m) =>
        (!f.exam || m.exam === f.exam) &&
        (!f.chapter || m.chapterId === f.chapter) &&
        (!f.concept || m.conceptId === f.concept) &&
        (!f.difficulty || m.difficulty === f.difficulty) &&
        (!f.use || m.use === f.use),
    )
    .map((m) => ({ meta: m, stem: questionById(m.id).stem, concept: conceptById(m.conceptId).name, chapter: chapterById(m.chapterId).name }));

  const any = Object.values(f).some(Boolean);

  return (
    <div>
      <AdminHeader title="Questions" meta={`${questionMeta.length} items in the sample bank · JEE Main, Class 11 Mechanics`} />
      <form action="/admin/questions" className="mb-4 flex flex-wrap items-end gap-3">
        <FilterSelect name="exam" label="Exam" value={f.exam} options={[{ value: "JEE Main", label: "JEE Main" }]} />
        <FilterSelect name="chapter" label="Chapter" value={f.chapter} options={chapters.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="concept" label="Concept" value={f.concept} options={concepts.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="status" label="Status" value={f.status} options={Object.entries(QUESTION_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="difficulty" label="Difficulty" value={f.difficulty} options={["easy", "medium", "hard"].map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} />
        <FilterSelect name="use" label="Use" value={f.use} options={["Diagnostic", "Practice", "Retest"].map((u) => ({ value: u, label: u }))} />
        <button type="submit" className={btn("secondary", "sm", "h-10")}>
          Apply
        </button>
        {any ? (
          <Link href="/admin/questions" className="inline-flex h-10 items-center px-2 text-sm font-semibold text-primary-text underline underline-offset-4">
            Clear
          </Link>
        ) : null}
      </form>
      <QuestionTable rows={rows} statusFilter={f.status} />
      <p className="mt-3 text-sm text-muted">
        Questions enter through the validated import pipeline; the console reviews, publishes and suspends them. Draft → Validated (automated checks) → Reviewed (a person) → Published.
      </p>
    </div>
  );
}
