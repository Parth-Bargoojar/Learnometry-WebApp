/**
 * The app's only chart forms — Web App Structure §13, DS §49.7.
 * Baseline is a dashed outline and "now" a solid cyan bar with an ink edge: the
 * brand grey/teal pair fails colour-vision separation when measured, fill vs
 * outline does not. Server-rendered SVG/HTML, no chart library.
 */
import { signed } from "@/lib/format";

export function PairedBar({
  label,
  before,
  after,
  beforeLabel = "Baseline",
  afterLabel = "Now",
  showNumbers = true,
}: {
  label?: string;
  before: number;
  after: number;
  beforeLabel?: string;
  afterLabel?: string;
  showNumbers?: boolean;
}) {
  const delta = after - before;
  return (
    <figure className="w-full">
      {label ? <figcaption className="sr-only">{label}</figcaption> : null}
      <div className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="text-muted">{beforeLabel}</span>
        <div className="h-3 rounded-full" aria-hidden="true">
          <div className="h-full rounded-full border-2 border-dashed border-line" style={{ width: `${Math.max(before, 4)}%` }} />
        </div>
        <span className="text-right font-semibold tabular-nums text-muted">{showNumbers ? `${before}%` : ""}</span>
        <span className="font-semibold text-ink">{afterLabel}</span>
        <div className="h-3 rounded-full" aria-hidden="true">
          <div
            className="h-full rounded-full border border-line bg-primary transition-[width] duration-500"
            style={{ width: `${Math.max(after, 4)}%` }}
          />
        </div>
        <span className="text-right font-bold tabular-nums text-ink">{showNumbers ? `${after}%` : ""}</span>
      </div>
      <p className="sr-only">
        {beforeLabel} {before}%, {afterLabel} {after}%, change {signed(delta)} points.
      </p>
    </figure>
  );
}

/** One-series score trend. Circles = diagnostics, squares = retests (shape, not colour). */
export function TrendLine({
  points,
  title,
}: {
  points: { date: string; label: string; pct: number; kind: "diagnostic" | "retest" }[];
  title: string;
}) {
  const w = 640;
  const h = 200;
  const pad = { l: 36, r: 56, t: 16, b: 28 };
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(points.length - 1, 1);
  const y = (v: number) => pad.t + ((100 - v) * (h - pad.t - pad.b)) / 100;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.pct)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} className="h-auto w-full overflow-visible">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} className="stroke-border-subtle" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {v}%
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-primary-deep" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <title>{`${p.label}: ${p.pct}% (${p.kind})`}</title>
            {p.kind === "diagnostic" ? (
              <circle cx={x(i)} cy={y(p.pct)} r={6} className="fill-surface stroke-line" strokeWidth={2} />
            ) : (
              <rect x={x(i) - 6} y={y(p.pct) - 6} width={12} height={12} rx={2} className="fill-primary stroke-line" strokeWidth={2} />
            )}
            <text x={x(i)} y={h - 8} textAnchor="middle" className="fill-muted text-[11px]">
              {p.label}
            </text>
          </g>
        ))}
        <text x={x(points.length - 1) + 12} y={y(last.pct) + 4} className="fill-ink text-[12px] font-semibold">
          {last.pct}%
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-line bg-surface" /> Diagnostic
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[2px] border-2 border-line bg-primary" /> Retest
        </span>
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary-text underline underline-offset-4">View as table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs text-muted">
              <th scope="col" className="py-1.5 font-semibold">Date</th>
              <th scope="col" className="py-1.5 font-semibold">Type</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-b border-border-subtle last:border-0">
                <td className="py-1.5">{p.label}</td>
                <td className="py-1.5 capitalize">{p.kind}</td>
                <td className="py-1.5 text-right tabular-nums">{p.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
