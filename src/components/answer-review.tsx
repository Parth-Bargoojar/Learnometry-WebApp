"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, CircleX, MinusCircle } from "lucide-react";
import type { AttemptConfig, Response } from "@/lib/types";
import { COST } from "@/lib/config";
import { conceptById, questionById } from "@/lib/data";
import { CATEGORY_LABEL, isCorrect } from "@/lib/diagnosis";
import { duration } from "@/lib/format";
import { MathText } from "./math";
import { Cost, btn } from "./ui";
import { useAttemptResponses } from "./use-result";

type Filter = "all" | "incorrect" | "unanswered" | "marked" | "correct";

/** Answer review — Web App Structure §8.8. Filters live in the URL (?show=). */
export function AnswerReview({ config, fallback }: { config: AttemptConfig; fallback: Response[] }) {
  const { responses } = useAttemptResponses(config.id, fallback);
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("show") as Filter) || "all";
  if (!responses) return <div className="skeleton h-96 w-full" aria-busy="true" />;

  const rows = config.questionIds.map((id, i) => {
    const q = questionById(id);
    const r = responses.find((x) => x.questionId === id);
    const answered = r?.answer != null && r.answer !== "";
    const ok = answered && isCorrect(q, r!.answer);
    return { q, r, i, answered, ok, marked: !!r?.marked };
  });
  const counts: Record<Filter, number> = {
    all: rows.length,
    incorrect: rows.filter((x) => x.answered && !x.ok).length,
    unanswered: rows.filter((x) => !x.answered).length,
    marked: rows.filter((x) => x.marked).length,
    correct: rows.filter((x) => x.ok).length,
  };
  const visible = rows.filter((x) =>
    filter === "incorrect" ? x.answered && !x.ok : filter === "unanswered" ? !x.answered : filter === "marked" ? x.marked : filter === "correct" ? x.ok : true,
  );
  const labels: Record<Filter, string> = { all: "All", incorrect: "Incorrect", unanswered: "Unanswered", marked: "Marked", correct: "Correct" };

  return (
    <div className="mx-auto max-w-[760px]">
      <div role="group" aria-label="Filter questions" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.keys(labels) as Filter[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => router.replace(k === "all" ? "?" : `?show=${k}`, { scroll: false })}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold tabular-nums ${
              filter === k ? "border-2 border-line bg-surface text-ink shadow-brutal-sm" : "border-border-subtle text-muted hover:text-ink"
            }`}
          >
            {labels[k]} ({counts[k]})
          </button>
        ))}
      </div>

      <ol className="mt-5 flex flex-col gap-4">
        {visible.map(({ q, r, i, answered, ok }) => (
          <li key={q.id}>
            <article className="rounded-card border border-border-subtle bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                <span className="font-bold text-ink">Q{i + 1}</span>
                <span>{conceptById(q.conceptId).name}</span>
                <span className={`ml-auto inline-flex items-center gap-1 font-semibold ${ok ? "text-success-text" : answered ? "text-danger-text" : "text-muted"}`}>
                  {ok ? <CircleCheck aria-hidden="true" className="size-4" /> : answered ? <CircleX aria-hidden="true" className="size-4" /> : <MinusCircle aria-hidden="true" className="size-4" />}
                  {ok ? "Correct" : answered ? "Incorrect" : "Not answered"}
                </span>
              </div>
              <MathText as="div" className="mt-3 text-[16px] leading-relaxed text-ink">
                {q.stem}
              </MathText>
              {q.options ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {q.options.map((o) => {
                    const isAns = o.key === q.answer;
                    const picked = r?.answer === o.key;
                    return (
                      <li
                        key={o.key}
                        className={`flex items-center gap-3 rounded-btn px-3 py-2 text-sm ${
                          isAns ? "border-2 border-success bg-success/10" : picked ? "border-2 border-danger bg-danger/10" : "border border-border-subtle"
                        }`}
                      >
                        <span className="font-bold text-ink">{o.key}</span>
                        <MathText className="flex-1 text-ink">{o.text}</MathText>
                        {isAns ? <span className="text-xs font-bold text-success-text">Correct answer</span> : picked ? <span className="text-xs font-bold text-danger-text">Your answer</span> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <dl className="mt-4 flex gap-6 text-sm">
                  <div>
                    <dt className="text-muted">Your answer</dt>
                    <dd className="font-semibold text-ink">{r?.answer ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Correct answer</dt>
                    <dd className="font-semibold text-ink">{q.answer}</dd>
                  </div>
                </dl>
              )}
              <p className="mt-3 text-xs text-muted">
                Time: {duration(r?.seconds ?? 0)} (expected {duration(q.expectedSeconds)})
                {!ok && q.missCause ? <> · Error type: {CATEGORY_LABEL[answered ? q.missCause : "time_pressure"]}</> : null}
              </p>
              <details className="mt-3 border-t border-border-subtle pt-3" open={!ok}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Solution</summary>
                <MathText as="p" className="mt-2 text-[15px] leading-relaxed text-ink">
                  {q.solution}
                </MathText>
              </details>
              {!ok ? (
                <Link href={`/attempt/prac-${q.conceptId}-5`} className={btn("secondary", "sm", "mt-4")}>
                  Practice this concept <Cost credits={COST.practiceSet5} />
                </Link>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
      {!visible.length ? <p className="mt-8 text-center text-muted">No questions in this filter.</p> : null}
    </div>
  );
}
