import type { Metadata } from "next";
import Link from "next/link";
import { QUESTION_STATUS_LABEL, type QuestionStatus } from "@/lib/admin";
import { questionFilterOptions, questionsForAdmin } from "@/domains/content/service";
import { AdminHeader, FilterSelect } from "@/components/admin-ui";
import { QuestionTable } from "@/components/admin-content";
import { btn } from "@/components/ui";

export const metadata: Metadata = { title: "Questions" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Question manager — §8.19: filters in the URL, validation chips, bulk publish/suspend (K6). */
export default async function AdminQuestionsPage(props: PageProps<"/admin/questions">) {
  const sp = await props.searchParams;
  const status = str(sp.status);
  const f = {
    exam: str(sp.exam),
    chapterId: str(sp.chapter),
    conceptId: str(sp.concept),
    difficulty: str(sp.difficulty),
    use: str(sp.use),
    status: status && status in QUESTION_STATUS_LABEL ? (status as QuestionStatus) : undefined,
  };

  const [rows, options] = await Promise.all([questionsForAdmin(f), questionFilterOptions()]);
  const any = Object.values(f).some(Boolean);
  const chapters = options.chapters.filter((c) => !f.exam || c.exam === f.exam);
  const concepts = options.concepts.filter((c) => !f.exam || c.exam === f.exam);

  return (
    <div>
      <AdminHeader title="Questions" meta={`${rows.length} item${rows.length === 1 ? "" : "s"}${any ? " match these filters" : ""}`} />
      <form action="/admin/questions" className="mb-4 flex flex-wrap items-end gap-3">
        <FilterSelect name="exam" label="Exam" value={f.exam} options={options.exams.map((e) => ({ value: e.code, label: e.name }))} />
        <FilterSelect name="chapter" label="Chapter" value={f.chapterId} options={chapters.map((c) => ({ value: c.id, label: `${c.name}${f.exam ? "" : ` · ${c.exam}`}` }))} />
        <FilterSelect name="concept" label="Concept" value={f.conceptId} options={concepts.map((c) => ({ value: c.id, label: `${c.name}${f.exam ? "" : ` · ${c.exam}`}` }))} />
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
      <QuestionTable rows={rows} />
      <p className="mt-3 text-sm text-muted">
        Questions enter through the validated import pipeline; the console reviews, publishes and suspends them. Draft → Validated (automated checks) → Reviewed (a person) → Published.
      </p>
    </div>
  );
}
