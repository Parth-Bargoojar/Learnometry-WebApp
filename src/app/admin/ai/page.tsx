import type { Metadata } from "next";
import Link from "next/link";
import { inrPrecise, istDay, stamp } from "@/lib/admin";
import { TODAY } from "@/lib/data";
import {
  MODEL_ALIAS_NOTE,
  adminLearnerById,
  aiConfig,
  aiCostByOperationToday,
  aiCostTodayInr,
  aiDaily,
  aiOperationLabel,
  aiRequests,
  aiTopUsersToday,
  type AiOperation,
} from "@/lib/admin-data";
import { duration, inr } from "@/lib/format";
import { AdminHeader, FilterSelect, Mono, Panel, Pill, TabLinks, TablePanel, num, td, th } from "@/components/admin-ui";
import { BreakerPanel } from "@/components/admin-ops";
import { btn } from "@/components/ui";

export const metadata: Metadata = { title: "AI & cost" };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
] as const;

const STATUS_TONE = { succeeded: "success", fallback: "warning", failed: "danger" } as const;
const STATUS_LABEL = { succeeded: "Succeeded", fallback: "Fallback", failed: "Failed" } as const;

/** AI request/cost console — §8.19 (K8, K9): breaker, cost by operation and user, requests, prompt/model config. */
export default async function AdminAiPage(props: PageProps<"/admin/ai">) {
  const sp = await props.searchParams;
  const range = RANGES.find((r) => r.key === sp.range)?.key ?? "today";
  const op = typeof sp.op === "string" && aiConfig.some((c) => c.operation === sp.op) ? (sp.op as AiOperation) : undefined;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? (sp.status as keyof typeof STATUS_LABEL) : undefined;

  const inRange = aiRequests.filter((r) => range === "7d" || istDay(r.at) === TODAY);
  const requests = inRange.filter((r) => (!op || r.operation === op) && (!status || r.status === status)).slice(0, 50);
  const opTotal = aiCostByOperationToday.reduce((s, o) => s + o.costInr, 0);
  const opMax = Math.max(...aiCostByOperationToday.map((o) => o.costInr));
  const week = aiDaily.reduce((s, d) => ({ cost: s.cost + d.costInr, revenue: s.revenue + d.revenueInr, requests: s.requests + d.requests }), { cost: 0, revenue: 0, requests: 0 });
  const qs = (extra: Record<string, string | undefined>) => {
    const all: Record<string, string | undefined> = { range: range === "today" ? undefined : range, op, status, ...extra };
    const p = new URLSearchParams(Object.entries(all).filter((e): e is [string, string] => !!e[1]));
    return `/admin/ai${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminHeader
        title="AI & cost"
        meta={
          range === "today"
            ? `Today ${inr(Math.round(aiCostTodayInr))} across ${aiDaily[aiDaily.length - 1].requests.toLocaleString("en-IN")} requests`
            : `Last 7 days ${inr(Math.round(week.cost))} across ${week.requests.toLocaleString("en-IN")} requests · ${((week.cost / week.revenue) * 100).toFixed(1)}% of revenue`
        }
      />
      <BreakerPanel />

      <div className="grid grid-cols-12 gap-6">
        <Panel title="Cost by operation, today" meta={`${inr(Math.round(opTotal))} in total`} className="col-span-12 xl:col-span-7">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">AI cost by operation today</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Operation</th>
                <th scope="col" className={`${th} w-1/3`}>
                  <span className="sr-only">Share</span>
                </th>
                <th scope="col" className={`${th} ${num}`}>Cost</th>
                <th scope="col" className={`${th} ${num}`}>Requests</th>
                <th scope="col" className={`${th} ${num}`}>Per request</th>
              </tr>
            </thead>
            <tbody>
              {aiCostByOperationToday.map((o) => (
                <tr key={o.operation}>
                  <td className={td}>{aiOperationLabel(o.operation)}</td>
                  <td className={td}>
                    <span aria-hidden="true" className="block h-2.5 rounded-r-[4px] bg-primary ring-1 ring-inset ring-line/30" style={{ width: `${(o.costInr / opMax) * 100}%` }} />
                  </td>
                  <td className={`${td} ${num} whitespace-nowrap`}>
                    {inr(Math.round(o.costInr))} <span className="text-muted">· {Math.round((o.costInr / opTotal) * 100)}%</span>
                  </td>
                  <td className={`${td} ${num}`}>{o.requests.toLocaleString("en-IN")}</td>
                  <td className={`${td} ${num}`}>{inrPrecise(o.costInr / o.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top learners by cost, today" meta="Learners above 80% of their allowance for 7 days are flagged, not throttled." className="col-span-12 xl:col-span-5">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Top learners by AI cost today</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Learner</th>
                <th scope="col" className={`${th} ${num}`}>Cost</th>
                <th scope="col" className={`${th} ${num}`}>Allowance used</th>
              </tr>
            </thead>
            <tbody>
              {aiTopUsersToday.map((u) => {
                const l = adminLearnerById(u.learnerId);
                const share = u.creditsUsed / u.allowance;
                return (
                  <tr key={u.learnerId}>
                    <td className={td}>
                      <Link href={`/admin/learners/${u.learnerId}`} className="underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                        {l ? `${l.firstName} ${l.lastName}` : u.learnerId}
                      </Link>
                      <span className="block text-xs text-muted">{u.requests} requests</span>
                    </td>
                    <td className={`${td} ${num}`}>{inrPrecise(u.costInr)}</td>
                    <td className={`${td} ${num} ${share >= 0.8 ? "font-semibold text-warning-text" : ""}`}>
                      {u.creditsUsed} / {u.allowance} · {Math.round(share * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <section aria-labelledby="req-h" className="flex flex-col gap-3">
        <h2 id="req-h" className="text-base font-semibold text-ink">
          Requests
        </h2>
        <TabLinks label="Date range" active={range} tabs={RANGES.map((r) => ({ key: r.key, label: r.label, href: qs({ range: r.key === "today" ? undefined : r.key }) }))} />
        <form action="/admin/ai" className="flex flex-wrap items-end gap-3">
          {range !== "today" ? <input type="hidden" name="range" value={range} /> : null}
          <FilterSelect name="op" label="Operation" value={op} options={aiConfig.map((c) => ({ value: c.operation, label: c.label }))} />
          <FilterSelect name="status" label="Status" value={status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          <button type="submit" className={btn("secondary", "sm", "h-10")}>
            Apply
          </button>
        </form>
        <TablePanel caption="AI requests" footer={`Latest ${requests.length} matching requests. Learner IDs are removed from request logs after 90 days (§1.9).`}>
          <thead>
            <tr>
              <th scope="col" className={th}>When (IST)</th>
              <th scope="col" className={th}>Operation</th>
              <th scope="col" className={th}>Learner</th>
              <th scope="col" className={th}>Tier · model</th>
              <th scope="col" className={`${th} ${num}`}>Tokens in / out</th>
              <th scope="col" className={`${th} ${num}`}>Latency</th>
              <th scope="col" className={`${th} ${num}`}>Cost</th>
              <th scope="col" className={`${th} ${num}`}>Credits</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{stamp(r.at)}</td>
                <td className={td}>{aiOperationLabel(r.operation)}</td>
                <td className={td}>
                  {r.learnerId ? (
                    <Link href={`/admin/learners/${r.learnerId}`} className="font-mono text-[13px] underline decoration-border-subtle underline-offset-4 hover:decoration-line">
                      {r.learnerId}
                    </Link>
                  ) : (
                    <span className="text-muted">System</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {r.tier} · <Mono>{r.model}</Mono>
                </td>
                <td className={`${td} ${num} whitespace-nowrap`}>
                  {r.inputTokens.toLocaleString("en-IN")} / {r.outputTokens.toLocaleString("en-IN")}
                  <span className="block text-xs text-muted">{r.cachedTokens.toLocaleString("en-IN")} cached</span>
                </td>
                <td className={`${td} ${num}`}>{duration(r.latencyMs / 1000)}</td>
                <td className={`${td} ${num}`}>{inrPrecise(r.costInr)}</td>
                <td className={`${td} ${num}`}>{r.credits || "—"}</td>
                <td className={td}>
                  <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                  {r.errorCode ? <span className="mt-0.5 block font-mono text-xs text-muted">{r.errorCode}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      </section>

      <section aria-labelledby="cfg-h" className="flex flex-col gap-3">
        <div>
          <h2 id="cfg-h" className="text-base font-semibold text-ink">
            Prompt and model configuration
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Read-only. Prompts live in source control and change only with a new version and a deploy (TRD §8.6). {MODEL_ALIAS_NOTE}
          </p>
        </div>
        <TablePanel caption="Prompt and model configuration per operation">
          <thead>
            <tr>
              <th scope="col" className={th}>Operation</th>
              <th scope="col" className={th}>Tier</th>
              <th scope="col" className={th}>Prompt</th>
              <th scope="col" className={th}>Schema</th>
              <th scope="col" className={`${th} ${num}`}>Max in / out</th>
              <th scope="col" className={`${th} ${num}`}>Timeout</th>
              <th scope="col" className={`${th} ${num}`}>Retries</th>
              <th scope="col" className={th}>Fallback</th>
              <th scope="col" className={`${th} ${num}`}>Credits</th>
            </tr>
          </thead>
          <tbody>
            {aiConfig.map((c) => (
              <tr key={c.operation}>
                <td className={td}>{c.label}</td>
                <td className={td}>{c.tier}</td>
                <td className={td}>
                  <Mono>{c.prompt}</Mono>
                </td>
                <td className={td}>
                  <Mono>{c.schema}</Mono>
                </td>
                <td className={`${td} ${num} whitespace-nowrap`}>
                  {c.maxIn.toLocaleString("en-IN")} / {c.maxOut.toLocaleString("en-IN")}
                </td>
                <td className={`${td} ${num}`}>{c.timeoutS} s</td>
                <td className={`${td} ${num}`}>{c.retries}</td>
                <td className={td}>{c.fallback}</td>
                <td className={`${td} ${num}`}>{c.credits || "—"}</td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
      </section>
    </div>
  );
}
