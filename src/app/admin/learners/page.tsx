import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ADMIN, stamp } from "@/lib/admin";
import { PLANS, type PlanCode } from "@/lib/config";
import { ABUSE_LABEL, ACCOUNT_STATUS_LABEL, adminLearners, type AccountStatus } from "@/lib/admin-data";
import { ageOn, isMinor } from "@/lib/guardian";
import { AdminHeader, FilterSelect, Pill, TablePanel, control, num, td, th } from "@/components/admin-ui";
import { AccountStatusPill } from "@/components/admin-learner";
import { btn } from "@/components/ui";

export const metadata: Metadata = { title: "Learners" };

/** Learner lookup — §8.19: search by email, name or ID; filters in the URL (K14). */
export default async function AdminLearnersPage(props: PageProps<"/admin/learners">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" && sp.status in ACCOUNT_STATUS_LABEL ? (sp.status as AccountStatus) : undefined;
  const plan = typeof sp.plan === "string" && sp.plan in PLANS ? (sp.plan as PlanCode) : undefined;
  const flagged = sp.flagged === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const needle = q.toLowerCase();
  const rows = adminLearners.filter(
    (l) =>
      (!needle || l.email.toLowerCase().includes(needle) || l.id.toLowerCase() === needle || `${l.firstName} ${l.lastName}`.toLowerCase().includes(needle)) &&
      (!status || l.status === status) &&
      (!plan || l.plan === plan) &&
      (!flagged || l.flags.length > 0),
  );
  const shown = rows.slice((page - 1) * ADMIN.pageSize, page * ADMIN.pageSize);
  const filtered = Boolean(q || status || plan || flagged);

  return (
    <div>
      <AdminHeader title="Learners" meta={`${adminLearners.length} accounts in the sample`} />
      <form role="search" action="/admin/learners" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-72 flex-1 flex-col gap-1 text-xs font-semibold text-muted">
          Search
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input name="q" type="search" defaultValue={q} placeholder="Email, name or learner ID" className={`${control} w-full pl-9`} />
          </span>
        </label>
        <FilterSelect name="status" label="Account" value={status} options={Object.entries(ACCOUNT_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="plan" label="Plan" value={plan} options={Object.values(PLANS).map((p) => ({ value: p.code, label: p.name }))} />
        <label className="flex h-10 items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" name="flagged" value="1" defaultChecked={flagged} className="size-4 accent-[var(--color-ink)]" />
          Flagged only
        </label>
        <button type="submit" className={btn("secondary", "sm", "h-10")}>
          Apply
        </button>
        {filtered ? (
          <Link href="/admin/learners" className="inline-flex h-10 items-center px-2 text-sm font-semibold text-primary-text underline underline-offset-4">
            Clear
          </Link>
        ) : null}
      </form>

      {shown.length ? (
        <TablePanel caption="Learners" footer={`${rows.length} result${rows.length === 1 ? "" : "s"}${rows.length > ADMIN.pageSize ? ` · page ${page}` : ""}`}>
          <thead>
            <tr>
              <th scope="col" className={th}>Learner</th>
              <th scope="col" className={th}>Exam</th>
              <th scope="col" className={th}>Plan</th>
              <th scope="col" className={`${th} ${num}`}>Credits</th>
              <th scope="col" className={th}>Last active (IST)</th>
              <th scope="col" className={th}>Account</th>
              <th scope="col" className={th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="hover:bg-sunken">
                <td className={td}>
                  <Link href={`/admin/learners/${l.id}`} className="font-semibold text-ink underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                    {l.firstName} {l.lastName}
                  </Link>
                  <span className="block text-xs text-muted">
                    {l.email} · {l.id}
                  </span>
                </td>
                <td className={td}>
                  {l.exam}
                  <span className="block text-xs text-muted">
                    {l.className} · age {ageOn(l.dateOfBirth)}
                    {isMinor(l.dateOfBirth) ? " · minor" : ""}
                  </span>
                </td>
                <td className={td}>{PLANS[l.plan].name}</td>
                <td className={`${td} ${num}`}>{l.credits}</td>
                <td className={`${td} whitespace-nowrap tabular-nums text-muted`}>{l.lastActive ? stamp(l.lastActive) : "Never"}</td>
                <td className={td}>
                  <AccountStatusPill learner={l} />
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    {l.flags.length ? l.flags.map((f) => <Pill key={f} tone="warning">{ABUSE_LABEL[f]}</Pill>) : <span className="text-muted">—</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      ) : (
        <p className="rounded-card border border-border-subtle bg-surface p-6 text-sm text-muted">
          No learner matches. Search takes a full learner ID, or part of an email or name.{" "}
          <Link href="/admin/learners" className="font-semibold text-primary-text underline underline-offset-4">
            Clear filters
          </Link>
        </p>
      )}
    </div>
  );
}
