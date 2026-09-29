"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CircleSlash, MoreHorizontal, RotateCcw } from "lucide-react";
import type { PlanTask } from "@/lib/types";
import { conceptById } from "@/lib/data";
import { relativeDay } from "@/lib/format";
import { PriorityBadge, btn } from "./ui";
import { Dialog } from "./dialog";
import { Toast, toastAction } from "./toast";

const TYPE_LABEL: Record<PlanTask["type"], string> = {
  learn: "Learn",
  revise: "Revise",
  practice: "Practice",
  review: "Review",
  retest: "Retest",
};

/**
 * Study tasks with optimistic complete/skip + Undo (Web App Structure §9.3).
 * Completion never changes mastery (DS §17) — only assessments do.
 */
export function TaskList({ tasks, primaryFirst = true, compact = false }: { tasks: PlanTask[]; primaryFirst?: boolean; compact?: boolean }) {
  const [items, setItems] = useState(tasks);
  const [toast, setToast] = useState<{ text: string; undo: PlanTask[] } | null>(null);
  const [skipFor, setSkipFor] = useState<PlanTask | null>(null);

  const update = (id: string, status: PlanTask["status"], text: string) => {
    const before = items;
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, status } : t)));
    setToast({ text, undo: before });
    window.setTimeout(() => setToast((t) => (t?.undo === before ? null : t)), 4000);
  };

  const firstPending = items.find((t) => t.status === "pending");

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((task) => {
          const concept = conceptById(task.conceptId);
          const done = task.status !== "pending";
          if (done) {
            return (
              <li key={task.id} className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${task.status === "completed" ? "bg-success text-white" : "bg-sunken text-muted"}`}>
                  {task.status === "completed" ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : <CircleSlash aria-hidden="true" className="size-4" />}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-muted">
                  <span className="font-medium text-ink">{concept.name}</span> · {TYPE_LABEL[task.type]} · {task.minutes} min
                </p>
                <span className="text-xs font-semibold text-muted">{task.status === "completed" ? "Done" : "Skipped"}</span>
                <button
                  type="button"
                  onClick={() => update(task.id, "pending", "Moved back to your list")}
                  className="flex size-9 items-center justify-center rounded-btn text-muted hover:bg-sunken hover:text-ink"
                  aria-label={`Undo: mark ${concept.name} as not done`}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          }
          const isPrimary = primaryFirst && task.id === firstPending?.id;
          return (
            <li
              key={task.id}
              className={`${isPrimary ? "rounded-card-lg border-2 border-line shadow-brutal" : "rounded-card border border-border-subtle"} bg-surface p-4 sm:p-5`}
            >
              <div className="flex gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => update(task.id, "completed", `${concept.name} marked done`)}
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-line hover:bg-success/15"
                  aria-label={`Mark ${concept.name}, ${TYPE_LABEL[task.type].toLowerCase()}, as done`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge value={task.priority} compact />
                    <Link href={`/plan/tasks/${task.id}`} className="font-semibold text-ink hover:underline hover:underline-offset-4">
                      {concept.name}
                    </Link>
                    <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{task.minutes} min</span>
                  </div>
                  <p className="mt-1.5 text-[15px] text-ink">
                    <span className="font-semibold">{TYPE_LABEL[task.type]}:</span> {task.action}
                  </p>
                  {!compact && (task.then || task.reviewOn) ? (
                    <p className="mt-1 text-sm text-muted">
                      {task.then ? <>Then: {task.then}</> : null}
                      {task.then && task.reviewOn ? " · " : null}
                      {task.reviewOn ? <>Review: {relativeDay(task.reviewOn)}</> : null}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/plan/tasks/${task.id}`} className={btn(isPrimary ? "primary" : "secondary", "sm")}>
                      Start task <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSkipFor(task)}
                      className="flex h-9 items-center gap-1 rounded-btn px-2 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                      Skip or move
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!skipFor} onClose={() => setSkipFor(null)} title="Skip or move this task" description={skipFor ? conceptById(skipFor.conceptId).name : undefined}>
        <p className="text-sm text-muted">Your reason helps the plan adjust. Nothing is marked as mastered.</p>
        <div className="mt-4 flex flex-col gap-2">
          {["I already know this", "No time today", "Too hard right now"].map((reason) => (
            <button
              key={reason}
              type="button"
              className={btn("secondary", "md", "justify-start")}
              onClick={() => {
                if (skipFor) update(skipFor.id, "skipped", `Skipped: ${reason.toLowerCase()}`);
                setSkipFor(null);
              }}
            >
              {reason}
            </button>
          ))}
          <button
            type="button"
            className={btn("ghost", "md", "justify-start")}
            onClick={() => {
              if (skipFor) update(skipFor.id, "skipped", "Moved to tomorrow");
              setSkipFor(null);
            }}
          >
            Move to tomorrow instead
          </button>
        </div>
      </Dialog>

      <Toast>
        {toast ? (
          <>
            {toast.text}
            <button
              type="button"
              className={toastAction}
              onClick={() => {
                setItems(toast.undo);
                setToast(null);
              }}
            >
              Undo
            </button>
          </>
        ) : null}
      </Toast>
    </>
  );
}
