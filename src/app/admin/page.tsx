import type { Metadata } from "next";
import Link from "next/link";
import { stamp } from "@/lib/admin";
import { TODAY } from "@/lib/data";
import { aiDaily, adminLearnerById, opsStats } from "@/lib/admin-data";
import { fullDate, inr, weekday } from "@/lib/format";
import { AdminHeader, Mono, Panel, TablePanel, td, th } from "@/components/admin-ui";
import { OpsAlerts, OpsStats } from "@/components/admin-ops";

export const metadata: Metadata = { title: "Dashboard" };

/** Admin dashboard — Web App Structure §8.19: stat row, alerts, AI cost this week, failed jobs. */
export default function AdminDashboardPage() {
  const max = Math.max(...aiDaily.map((d) => d.costInr));
  return (
    <div className="flex flex-col gap-6">
      <AdminHeader title="Dashboard" meta={`${fullDate(TODAY)} · figures up to 11:30 IST`} />
      <OpsStats />

      <div className="grid grid-cols-12 gap-6">
        <Panel title="Needs attention" className="col-span-12 xl:col-span-7">
          <OpsAlerts />
        </Panel>
        <Panel title="AI cost, last 7 days" meta="Daily total in rupees" className="col-span-12 xl:col-span-5" action={<Link href="/admin/ai" className="text-sm font-semibold text-primary-text underline underline-offset-4">Details</Link>}>
          <figure>
            <figcaption className="sr-only">AI cost per day for the last 7 days. Values are listed beside each bar.</figcaption>
            <ul className="flex flex-col gap-2">
              {aiDaily.map((d) => (
                <li key={d.date} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm" title={`${d.requests.toLocaleString("en-IN")} requests · revenue ${inr(d.revenueInr)}`}>
                  <span className="text-muted tabular-nums">{d.date === TODAY ? "Today" : `${weekday(d.date)} ${Number(d.date.slice(8))}`}</span>
                  <span aria-hidden="true" className="h-3 rounded-r-[4px] bg-primary ring-1 ring-inset ring-line/30" style={{ width: `${(d.costInr / max) * 100}%` }} />
                  <span className="text-right font-semibold tabular-nums text-ink">{inr(Math.round(d.costInr))}</span>
                </li>
              ))}
            </ul>
          </figure>
        </Panel>
      </div>

      <section id="failed-jobs" aria-labelledby="jobs-h" className="scroll-mt-24">
        <h2 id="jobs-h" className="mb-3 text-base font-semibold text-ink">
          Failed jobs today
        </h2>
        <TablePanel caption="Failed background jobs" footer="Inngest retries each job before it lands here; the learner always gets the deterministic fallback.">
          <thead>
            <tr>
              <th scope="col" className={th}>When (IST)</th>
              <th scope="col" className={th}>Job</th>
              <th scope="col" className={th}>Learner</th>
              <th scope="col" className={th}>Attempts</th>
              <th scope="col" className={th}>What happened</th>
            </tr>
          </thead>
          <tbody>
            {opsStats.failedJobs.map((j) => {
              const l = adminLearnerById(j.learnerId);
              return (
                <tr key={j.id}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(j.at)}</td>
                  <td className={td}><Mono>{j.name}</Mono></td>
                  <td className={td}>
                    <Link href={`/admin/learners/${j.learnerId}?tab=diagnoses`} className="underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                      {l ? `${l.firstName} ${l.lastName}` : j.learnerId}
                    </Link>
                  </td>
                  <td className={`${td} tabular-nums`}>{j.attempts}</td>
                  <td className={`${td} text-muted`}>{j.error}</td>
                </tr>
              );
            })}
          </tbody>
        </TablePanel>
      </section>
    </div>
  );
}
