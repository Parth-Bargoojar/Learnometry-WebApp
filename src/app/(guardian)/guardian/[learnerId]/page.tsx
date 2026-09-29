import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, EyeOff, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { guardianLearners } from "@/lib/data";
import { guardianSummary } from "@/lib/guardian-summary";
import { GUARDIAN_CANNOT_SEE, GUARDIAN_CAN_SEE, maskContact } from "@/lib/guardian";
import { dayMonth, shortDate } from "@/lib/format";
import { Card, CardHeader, ProgressBar, SeverityBadge } from "@/components/ui";
import { PairedBar, TrendLine } from "@/components/charts";
import { ResendInvite, WithdrawnNotice } from "@/components/guardian";

export const metadata: Metadata = { title: "Progress" };

/**
 * Read-only learner view for guardians — Web App Structure §8.18, D5.
 * Written for parents; no evidence sheets, no question text, no answers.
 */
export default async function GuardianLearnerPage(props: PageProps<"/guardian/[learnerId]">) {
  const { learnerId } = await props.params;
  const linked = guardianLearners.find((l) => l.id === learnerId);
  if (!linked) notFound();

  if (linked.status === "invited") {
    return (
      <div className="flex flex-col gap-5">
        <h1 tabIndex={-1} className="font-display text-3xl text-ink outline-none">
          {linked.firstName} {linked.lastName}
        </h1>
        <Card level="supporting" className="p-5 sm:p-6">
          <p className="text-[17px] text-ink">{linked.firstName} hasn&apos;t accepted the invite yet.</p>
          <p className="mt-1 text-[15px] text-muted">
            It went to {maskContact(linked.inviteSentTo)} and works until {dayMonth(linked.inviteExpires)}. Progress shows up here after {linked.firstName}&apos;s first
            diagnostic.
          </p>
          <div className="mt-4">
            <ResendInvite to={linked.inviteSentTo} />
          </div>
        </Card>
      </div>
    );
  }

  const s = guardianSummary(learnerId);
  if (!s) notFound();
  const avgBefore = Math.round(s.targeted.reduce((a, t) => a + t.before, 0) / s.targeted.length);
  const avgAfter = Math.round(s.targeted.reduce((a, t) => a + t.after, 0) / s.targeted.length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 tabIndex={-1} className="font-display text-3xl leading-tight text-ink outline-none">
          {s.firstName} {s.lastName}
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          {s.exam} · {s.className} · {s.planName} pass until {dayMonth(s.passEnds)}
        </p>
      </div>

      <WithdrawnNotice learnerId={learnerId} />

      <Card level="primary" className="p-5 sm:p-7" aria-labelledby="week-h">
        <h2 id="week-h" className="font-display text-2xl leading-snug text-ink">
          {s.firstName} is working on {s.focusThisWeek.length} topics this week. The most important is {s.focusThisWeek[0]}.
        </h2>
        <p className="mt-2 text-muted">
          The plan fits {s.dailyMinutes} minutes a day. On {shortDate(s.nextRetest)}, a short retest with new questions checks whether these topics improved.
        </p>
        <div className="mt-5 max-w-md">
          <p className="flex justify-between text-sm text-muted">
            Tasks done this week
            <span className="font-semibold tabular-nums text-ink">
              {s.week.done} of {s.week.total}
            </span>
          </p>
          <div className="mt-1.5">
            <ProgressBar value={s.week.done} max={s.week.total} label="Tasks done this week" tone="ink" />
          </div>
        </div>
        <ol className="mt-5 flex flex-wrap gap-2">
          {s.focusThisWeek.map((t, i) => (
            <li key={t} className="rounded-full border border-border-subtle bg-sunken px-3 py-1 text-sm text-ink">
              <span className="font-semibold tabular-nums">{i + 1}.</span> {t}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="diag-h">
          <CardHeader id="diag-h" title="Latest diagnostic" meta={s.lastDiagnostic ? dayMonth(s.lastDiagnostic.date) : undefined} />
          {s.lastDiagnostic ? (
            <p className="mt-3 font-display text-4xl leading-none tabular-nums text-ink">
              {s.lastDiagnostic.score}
              <span className="text-xl text-muted"> / {s.lastDiagnostic.max}</span>
              <span className="ml-2 text-lg text-muted">{s.lastDiagnostic.pct}%</span>
            </p>
          ) : null}
          <h3 className="mt-5 text-sm font-semibold text-muted">Topics to work on</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {s.weakTopics.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-[15px] text-ink">{t.name}</span>
                <SeverityBadge value={t.severity} size="sm" />
              </li>
            ))}
          </ul>
          {s.strongTopics.length ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-muted">Already strong</h3>
              <p className="mt-1 text-[15px] text-ink">{s.strongTopics.join(" · ")}</p>
            </>
          ) : null}
        </Card>

        <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="prog-h">
          <CardHeader id="prog-h" title="Is it working?" />
          <p className="mt-2 text-[15px] text-ink">
            Topics {s.firstName} has already worked on went from {avgBefore}% to {avgAfter}%, measured by a retest on new questions.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {s.targeted.map((t) => (
              <div key={t.name}>
                <p className="mb-2 text-sm font-semibold text-ink">{t.name}</p>
                <PairedBar before={t.before} after={t.after} beforeLabel="Before" afterLabel="Now" label={t.name} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="trend-h">
        <CardHeader id="trend-h" title="Scores over time" meta="Diagnostics and retests only" />
        <div className="mt-4 max-w-3xl">
          <TrendLine title={`Scores: ${s.trend.map((p) => `${dayMonth(p.date)} ${p.pct}%`).join(", ")}`} points={s.trend.map((p) => ({ ...p, label: dayMonth(p.date) }))} />
        </div>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="rt-h">
        <CardHeader id="rt-h" title="Retests" />
        <ul className="mt-3 divide-y divide-border-subtle">
          {s.retests.flatMap((r) =>
            r.outcomes.map((o) => (
              <li key={`${r.date}-${o.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="w-14 text-sm tabular-nums text-muted">{dayMonth(r.date)}</span>
                <span className="min-w-0 flex-1 text-[15px] text-ink">{o.name}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {o.outcome === "improved" ? (
                    <TrendingUp aria-hidden="true" className="size-4 text-success-text" />
                  ) : o.outcome === "declined" ? (
                    <TrendingDown aria-hidden="true" className="size-4 text-danger-text" />
                  ) : (
                    <Minus aria-hidden="true" className="size-4 text-muted" />
                  )}
                  {o.outcome === "improved" ? `Improved, +${o.after - o.before} pts` : o.outcome === "declined" ? "Slipped" : o.outcome === "stable" ? "About the same" : "Too few questions"}
                </span>
              </li>
            )),
          )}
        </ul>
      </Card>

      <Card level="supporting" className="p-5 sm:p-6" aria-labelledby="vis-h">
        <CardHeader id="vis-h" title="What you can see" meta={`${s.firstName} can see this same list in their settings.`} />
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ul className="flex flex-col gap-2">
            {GUARDIAN_CAN_SEE.map((t) => (
              <li key={t} className="flex gap-2 text-[15px] text-ink">
                <Eye aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                {t}
              </li>
            ))}
          </ul>
          <div>
            <p className="text-sm font-semibold text-muted">Private to {s.firstName}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {GUARDIAN_CANNOT_SEE.map((t) => (
                <li key={t} className="flex gap-2 text-[15px] text-ink">
                  <EyeOff aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
