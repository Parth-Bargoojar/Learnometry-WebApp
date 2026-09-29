/**
 * App primitives — Design System v1.1 §10, §11, §49. Server-safe (no hooks).
 * Built on the app semantic tokens (`line`, `muted`, `sunken`, `on-primary`…) so every
 * primitive works in the dark theme. Marketing keeps its own `ui/button.tsx`.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleHelp,
  OctagonAlert,
  TrendingDown,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Confidence, Priority, Severity } from "@/lib/config";

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const lift =
  "shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-y-0.5 active:shadow-none";

const variants: Record<Variant, string> = {
  primary: `bg-primary text-on-primary border-2 border-line ${lift}`,
  secondary: `bg-surface text-ink border-2 border-line ${lift}`,
  ghost: "text-ink border-2 border-transparent hover:bg-sunken",
  destructive: `bg-danger text-white border-2 border-line ${lift}`,
};

const sizes: Record<Size, string> = {
  sm: "h-9 touch:h-11 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-7 text-base gap-2",
};

export function btn(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "inline-flex items-center justify-center whitespace-nowrap rounded-btn font-semibold cursor-pointer select-none",
    "transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  ].join(" ");
}

/** The ⚡cost pill that sits inside a button (DS §21: cost before the click). */
export function Cost({ credits, className = "" }: { credits: number; className?: string }) {
  return (
    <span className={`ml-1 inline-flex items-center gap-0.5 border-l border-current/25 pl-2.5 tabular-nums ${className}`}>
      <Zap aria-hidden="true" className="size-3.5" />
      {credits}
      <span className="sr-only"> credits</span>
    </span>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className"
>) {
  return (
    <Link href={href} className={btn(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-sm font-semibold text-primary-text underline decoration-1 underline-offset-4 hover:text-ink min-h-6 touch:min-h-11 ${className}`}
    >
      {children}
    </Link>
  );
}

/* ---------- Cards (border & shadow budget, DS §49.4) ---------- */

type Level = "primary" | "structural" | "supporting";

const levels: Record<Level, string> = {
  primary: "rounded-card-lg border-2 border-line bg-surface shadow-brutal-lg",
  structural: "rounded-card-lg border-2 border-line bg-surface",
  supporting: "rounded-card border border-border-subtle bg-surface",
};

export function Card({
  level = "supporting",
  className = "",
  children,
  as: Tag = "section",
  ...rest
}: { level?: Level; className?: string; children: ReactNode; as?: "section" | "article" | "div" } & Record<string, unknown>) {
  return (
    <Tag className={`${levels[level]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  action,
  meta,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold leading-snug text-ink">
          {title}
        </h2>
        {meta ? <p className="mt-0.5 text-sm text-muted">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------- Status: severity, priority, confidence (DS §49.5) ---------- */

const severity: Record<Severity, { label: string; icon: LucideIcon; cls: string }> = {
  strong: { label: "Strong", icon: CircleCheck, cls: "bg-success/10 text-success-text border-success/35" },
  stable: { label: "Stable", icon: CircleDot, cls: "bg-sunken text-muted border-border-subtle" },
  needs_work: { label: "Needs work", icon: CircleAlert, cls: "bg-warning/15 text-warning-text border-warning/45" },
  weak: { label: "Weak", icon: TrendingDown, cls: "bg-danger/10 text-danger-text border-danger/35" },
  critical: { label: "Critical", icon: OctagonAlert, cls: "bg-danger text-white border-line" },
  insufficient: { label: "Not enough evidence", icon: CircleHelp, cls: "bg-surface text-muted border-faint border-dashed" },
};

export const severityLabel = (s: Severity) => severity[s].label;

export function SeverityBadge({ value, size = "md" }: { value: Severity; size?: "sm" | "md" }) {
  const s = severity[value];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold uppercase tracking-wide ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${s.cls}`}
    >
      <s.icon aria-hidden="true" className="size-3.5" />
      {s.label}
    </span>
  );
}

const priority: Record<Priority, { label: string; cls: string }> = {
  1: { label: "Critical", cls: "bg-ink text-on-ink border-line" },
  2: { label: "High", cls: "bg-surface text-ink border-2 border-line" },
  3: { label: "Medium", cls: "bg-sunken text-muted border border-border-subtle" },
  4: { label: "Low", cls: "bg-transparent text-muted border border-border-subtle" },
};

export function PriorityBadge({ value, compact = false }: { value: Priority; compact?: boolean }) {
  const p = priority[value];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${p.cls}`}
      title={`Priority ${value}: ${p.label}`}
    >
      P{value}
      {compact ? <span className="sr-only"> {p.label}</span> : <span className="font-semibold">&nbsp;· {p.label}</span>}
    </span>
  );
}

const confidenceSteps: Record<Exclude<Confidence, "insufficient">, number> = { low: 1, medium: 2, high: 3 };
const confidenceWord: Record<Confidence, string> = { low: "Low", medium: "Medium", high: "High", insufficient: "Not enough evidence" };

export function ConfidenceMeter({ value }: { value: Confidence }) {
  if (value === "insufficient") return <SeverityBadge value="insufficient" size="sm" />;
  const n = confidenceSteps[value];
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1.5 rounded-sm ${i <= n ? "bg-ink" : "bg-border-subtle"}`}
            style={{ height: `${6 + i * 4}px` }}
          />
        ))}
      </span>
      <span>
        <span className="sr-only">Confidence: </span>
        {confidenceWord[value]}
      </span>
    </span>
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "primary",
  size = "md",
  hatched = false,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: "primary" | "success" | "warning" | "danger" | "ink";
  size?: "sm" | "md";
  hatched?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger", ink: "bg-ink" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`w-full overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-border-subtle ${size === "sm" ? "h-1.5" : "h-2"}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${fill}`}
        style={{
          width: `${pct}%`,
          backgroundImage: hatched
            ? "repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 0.55) 3px 6px)"
            : undefined,
        }}
      />
    </div>
  );
}

/* ---------- Misc ---------- */

/** Uppercase field label for structured AI output (DS §38): Evidence / Likely cause / Next. */
export function FieldLabel({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
      {children}
      {note ? <span className="font-medium normal-case tracking-normal text-faint"> · {note}</span> : null}
    </p>
  );
}

export function Chip({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-sunken px-2.5 py-1 text-xs font-medium text-ink">
      {Icon ? <Icon aria-hidden="true" className="size-3.5 text-muted" /> : null}
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl leading-none text-ink tabular-nums sm:text-[28px]">{value}</dd>
      {sub ? <dd className="mt-1.5 text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}

export function PageHeader({ context, action }: { context?: ReactNode; action?: ReactNode }) {
  if (!context && !action) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
      {context ? <p className="text-sm text-muted">{context}</p> : <span />}
      {action}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
  icon: Icon = CircleAlert,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  const cls = {
    info: "border-info/40 bg-info/5",
    warning: "border-warning/50 bg-warning/10",
    danger: "border-danger/40 bg-danger/5",
    success: "border-success/40 bg-success/5",
  }[tone];
  const ic = { info: "text-info", warning: "text-warning-text", danger: "text-danger-text", success: "text-success-text" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:items-center ${cls}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${ic}`} />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {children ? <div className="mt-0.5 text-sm text-muted">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:ml-2">{action}</div> : null}
    </div>
  );
}
