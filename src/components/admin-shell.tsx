"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Cpu,
  CreditCard,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Network,
  ScrollText,
  ShieldAlert,
  Sun,
  ToggleRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ADMIN } from "@/lib/admin";
import { abuseFlags, adminRefunds, adminUser, type AbuseStatus, type AdminRefund } from "@/lib/admin-data";
import { SHARED, useShared } from "@/lib/local-store";
import { clearDeviceData } from "@/lib/pwa";
import { ThemeProvider, useTheme, type ThemePref } from "./theme";
import { Popover, menuItem } from "./popover";

/*
  Shell F — Admin (Web App Structure §5.7, §8.19). Desktop only: below 1024px the
  console is replaced by a single message. Grouped left sidebar, dense content,
  same tokens as the learner app. Each page renders its own h1.
*/

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "refunds" | "abuse" };

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "People", items: [{ href: "/admin/learners", label: "Learners", icon: Users }] },
  {
    label: "Content",
    items: [
      { href: "/admin/questions", label: "Questions", icon: FileQuestion },
      { href: "/admin/curriculum", label: "Curriculum", icon: Network },
    ],
  },
  { label: "Money", items: [{ href: "/admin/payments", label: "Payments", icon: CreditCard, badge: "refunds" }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/ai", label: "AI & cost", icon: Cpu },
      { href: "/admin/security", label: "Security", icon: ShieldAlert, badge: "abuse" },
      { href: "/admin/flags", label: "Feature flags", icon: ToggleRight },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

const initials = adminUser.name
  .split(" ")
  .map((p) => p[0])
  .join("");

/** 12 h admin session (§1.9), shown so nobody is surprised mid-task. */
const sessionEnds = (() => {
  const d = new Date(new Date(adminUser.signedInAt).getTime() + ADMIN.sessionHours * 3_600_000 + 5.5 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} IST`;
})();

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center lg:hidden">
        <Image src="/logo-mark.png" alt="" width={64} height={64} className="size-12" />
        <h1 className="text-lg font-semibold text-ink">The admin console works on a laptop or desktop.</h1>
        <p className="max-w-sm text-sm text-muted">Open it on a screen at least 1024 pixels wide.</p>
      </div>
      <Frame>{children}</Frame>
    </ThemeProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const first = useRef(true);

  // Focus the new page's h1 on client navigation (a11y §14), not on first load.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>("#main h1")?.focus({ preventScroll: true });
  }, [pathname]);

  const section = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="hidden min-h-screen lg:block">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-btn focus:border-2 focus:border-ink focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[var(--sidebar-w)] flex-col border-r border-border-subtle bg-background">
        <Link href="/admin" aria-label="Admin dashboard" className="flex h-[var(--topbar-h)] items-center gap-2.5 px-5">
          <Image src="/primary-logo.png" alt="Learnometry" width={611} height={133} sizes="150px" className="h-7 w-auto dark:hidden" priority />
          <Image src="/primary-logo-dark.png" alt="Learnometry" width={611} height={133} sizes="150px" className="hidden h-7 w-auto dark:block" />
          <span className="rounded-full border border-line bg-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-ink">Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 pt-2">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-faint">{g.label}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const active = section(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-10 items-center gap-3 rounded-btn border px-3 text-sm font-semibold ${
                          active ? "border-line bg-surface text-ink" : "border-transparent text-muted hover:bg-sunken hover:text-ink"
                        }`}
                      >
                        <item.icon aria-hidden="true" className="size-4.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge === "refunds" ? <RefundBadge /> : item.badge === "abuse" ? <AbuseBadge /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <p className="border-t border-border-subtle px-5 py-3 text-xs text-muted">
          Sample data · session ends {sessionEnds}
        </p>
      </aside>

      <div className="flex min-h-screen flex-col pl-[var(--sidebar-w)]">
        <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex h-[var(--topbar-h)] max-w-[1360px] items-center justify-end gap-2 px-8">
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-btn px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
              Open learner app
            </Link>
            <AccountMenu />
          </div>
        </header>
        <main id="main" className="flex-1 px-8 pb-16 pt-8">
          <div className="mx-auto w-full max-w-[1296px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="rounded-full bg-ink px-1.5 py-px text-[11px] tabular-nums text-on-ink">
      {n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function RefundBadge() {
  const [decided] = useShared<Record<string, { status: AdminRefund["status"] }>>(SHARED.adminRefunds, {});
  const open = adminRefunds.filter((r) => (decided[r.id]?.status ?? r.status) === "requested").length;
  return <Count n={open} label="waiting for a decision" />;
}

function AbuseBadge() {
  const [changed] = useShared<Record<string, AbuseStatus>>(SHARED.adminAbuse, {});
  const open = abuseFlags.filter((f) => (changed[f.id] ?? f.status) === "open").length;
  return <Count n={open} label="open, needs review" />;
}

function AccountMenu() {
  const { pref, setPref } = useTheme();
  const themes: { value: ThemePref; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <Popover
      label="Account menu"
      triggerClassName="flex size-11 items-center justify-center"
      panelClassName="w-72"
      trigger={<span className="flex size-9 items-center justify-center rounded-full border border-line bg-primary/20 text-xs font-bold text-ink">{initials}</span>}
    >
      {() => (
        <div>
          <div className="px-3 pb-2 pt-1.5">
            <p className="text-sm font-semibold text-ink">{adminUser.name}</p>
            <p className="text-xs text-muted">{adminUser.email} · Admin</p>
            <p className="mt-1 text-xs text-muted">Signed in with 2FA · session ends {sessionEnds}</p>
          </div>
          <div role="group" aria-label="Theme" className="mx-1.5 my-1 grid grid-cols-3 gap-1 rounded-full border border-border-subtle bg-sunken p-1">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={pref === t.value}
                onClick={() => setPref(t.value)}
                className={`flex h-9 items-center justify-center gap-1 rounded-full border text-xs font-semibold ${
                  pref === t.value ? "border-line bg-surface text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <t.icon aria-hidden="true" className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          <Link href="/login" onClick={() => void clearDeviceData()} className={`${menuItem} mt-1 border-t border-border-subtle`}>
            <LogOut aria-hidden="true" className="size-4 text-muted" />
            Sign out
          </Link>
        </div>
      )}
    </Popover>
  );
}
