import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, Settings, UserCheck } from "lucide-react";
import { TODAY, guardianAccount, guardianLearners } from "@/lib/data";
import { guardianSummary } from "@/lib/guardian-summary";
import { maskContact } from "@/lib/guardian";
import { dayMonth, fullDate, shortDate } from "@/lib/format";
import { ButtonLink, Card, ProgressBar } from "@/components/ui";
import { ApprovalsCount, PendingApprovalsBanner, ResendInvite } from "@/components/guardian";

export const metadata: Metadata = { title: "Guardian overview" };

/** Guardian overview — Web App Structure §8.18: one card per linked learner. */
export default function GuardianOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 tabIndex={-1} className="font-display text-3xl leading-tight text-ink outline-none">
          Overview
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          {guardianAccount.name} · {fullDate(TODAY)}
        </p>
      </div>

      <PendingApprovalsBanner />

      <section aria-labelledby="children-h" className="flex flex-col gap-5">
        <h2 id="children-h" className="sr-only">
          Your children
        </h2>
        {guardianLearners.map((l) => (l.status === "active" ? <ActiveLearner key={l.id} id={l.id} /> : <InvitedLearner key={l.id} id={l.id} />))}
      </section>

      <nav aria-label="Guardian" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DestCard href="/guardian/approvals" icon={UserCheck} title="Approvals" meta={<ApprovalsCount />} />
        <DestCard href="/guardian/settings" icon={Settings} title="Consent & settings" meta="Consent records, withdrawal, your account" />
      </nav>
    </div>
  );
}

function ActiveLearner({ id }: { id: string }) {
  const s = guardianSummary(id);
  if (!s) return null;
  return (
    <Card level="structural" as="article" className="p-5 sm:p-7" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${id}-h`} className="font-display text-2xl text-ink">
            {s.firstName} {s.lastName}
          </h3>
          <p className="mt-0.5 text-[15px] text-muted">
            {s.exam} · {s.className} · {s.planName} pass until {dayMonth(s.passEnds)}
          </p>
        </div>
        <ButtonLink href={`/guardian/${id}`} variant="secondary">
          View details <ArrowRight aria-hidden="true" className="size-5" />
        </ButtonLink>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-5 border-y border-border-subtle py-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-semibold text-muted">Last diagnostic</dt>
          {s.lastDiagnostic ? (
            <>
              <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">
                {s.lastDiagnostic.score}
                <span className="text-lg text-muted"> / {s.lastDiagnostic.max}</span>
              </dd>
              <dd className="mt-1.5 text-sm text-muted">
                {s.lastDiagnostic.pct}% · {dayMonth(s.lastDiagnostic.date)}
              </dd>
            </>
          ) : (
            <dd className="mt-1 text-[15px] text-ink">Not taken yet</dd>
          )}
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">This week&apos;s plan</dt>
          <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">
            {s.week.done}
            <span className="text-lg text-muted"> of {s.week.total} tasks</span>
          </dd>
          <dd className="mt-2.5">
            <ProgressBar value={s.week.done} max={s.week.total} label={`${s.firstName}'s tasks done this week`} tone="ink" size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">Next retest</dt>
          <dd className="mt-1 font-display text-3xl leading-none text-ink">{shortDate(s.nextRetest)}</dd>
          <dd className="mt-1.5 text-sm text-muted">Checks this week&apos;s {s.focusThisWeek.length} topics</dd>
        </div>
      </dl>

    </Card>
  );
}

function InvitedLearner({ id }: { id: string }) {
  const l = guardianLearners.find((x) => x.id === id);
  if (!l || l.status !== "invited") return null;
  return (
    <Card level="supporting" as="article" className="p-5 sm:p-7" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-h`} className="font-display text-2xl text-ink">
          {l.firstName} {l.lastName}
        </h3>
        <span className="rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-warning-text">
          Invite sent
        </span>
      </div>
      <p className="mt-0.5 text-[15px] text-muted">
        {l.exam} · {l.className}
      </p>
      <p className="mt-4 flex items-start gap-2 text-[15px] text-ink">
        <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
        <span>
          We sent a login invite to {maskContact(l.inviteSentTo)} on {dayMonth(l.inviteSentOn)}. It works until {dayMonth(l.inviteExpires)}. Progress shows up here
          after {l.firstName}&apos;s first diagnostic.
        </span>
      </p>
      <div className="mt-4">
        <ResendInvite to={l.inviteSentTo} />
      </div>
    </Card>
  );
}

function DestCard({ href, icon: Icon, title, meta }: { href: string; icon: typeof Settings; title: string; meta: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-h-20 items-center gap-4 rounded-card border border-border-subtle bg-surface p-5 hover:border-line">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-card-sm bg-sunken">
        <Icon aria-hidden="true" className="size-5 text-ink" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{meta}</span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
