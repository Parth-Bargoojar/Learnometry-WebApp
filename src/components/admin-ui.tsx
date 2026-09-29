/**
 * Admin primitives — Shell F "dense" variant (Web App Structure §5.7, §8.19, K14):
 * 44px rows, 14px text, 1px subtle borders, shadows only on primary buttons.
 * Server-safe (no hooks); filters and tabs live in the URL.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function AdminHeader({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 tabIndex={-1} className="font-display text-3xl leading-tight text-ink outline-none">
          {title}
        </h1>
        {meta ? <p className="mt-1 text-sm text-muted">{meta}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ---------- Tables ---------- */

export const table = "w-full border-collapse text-left text-sm";
export const th = "h-10 border-b border-border-subtle px-3 text-xs font-semibold whitespace-nowrap text-muted first:pl-4 last:pr-4";
export const td = "h-11 border-b border-border-subtle px-3 py-2 align-middle text-ink first:pl-4 last:pr-4";
export const num = "text-right tabular-nums";

export function TablePanel({ children, caption, footer }: { children: ReactNode; caption?: string; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
      <div tabIndex={0} className="overflow-x-auto">
        <table className={table}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          {children}
        </table>
      </div>
      {footer ? <div className="border-t border-border-subtle px-4 py-2.5 text-sm text-muted">{footer}</div> : null}
    </div>
  );
}

export function Panel({ title, meta, action, children, className = "" }: { title?: string; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border-subtle bg-surface p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {meta ? <p className="mt-0.5 text-sm text-muted">{meta}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ---------- Status ---------- */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "ink" | "outline";

const tones: Record<Tone, string> = {
  neutral: "border-border-subtle bg-sunken text-muted",
  success: "border-success/35 bg-success/10 text-success-text",
  warning: "border-warning/45 bg-warning/15 text-warning-text",
  danger: "border-danger/35 bg-danger/10 text-danger-text",
  info: "border-info/35 bg-info/10 text-ink",
  ink: "border-line bg-ink text-on-ink",
  outline: "border-dashed border-faint bg-surface text-muted",
};

/** Status is always icon or text, never colour alone (DS §26). */
export function Pill({ tone = "neutral", icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function StatTile({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "warning"; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-2 font-display text-[28px] leading-none text-ink tabular-nums">{value}</dd>
      {sub ? <dd className="mt-2 text-xs text-muted">{sub}</dd> : null}
    </>
  );
  const cls = `block min-w-0 rounded-card border bg-surface p-4 ${
    tone === "danger" ? "border-danger/45" : tone === "warning" ? "border-warning/60" : "border-border-subtle"
  }`;
  return href ? (
    <div className={`${cls} hover:border-line`}>
      <Link href={href} className="block">
        <dl>{body}</dl>
      </Link>
    </div>
  ) : (
    <div className={cls}>
      <dl>{body}</dl>
    </div>
  );
}

/* ---------- Tabs as links (URL state, K14) ---------- */

export function TabLinks({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-5 border-b border-border-subtle">
      <ul className="-mb-px flex flex-wrap gap-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={`inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
                  on ? "border-line text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-ink px-1.5 py-px text-[11px] tabular-nums text-on-ink">{t.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------- Filter bar: a plain GET form, works without JS ---------- */

export const control = "h-10 rounded-input border border-control bg-surface px-3 text-sm text-ink focus:border-ink";

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select name={name} defaultValue={value ?? ""} className={`${control} min-w-36`}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>;
}
