"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ClipboardCheck,
  CreditCard,
  House,
  LifeBuoy,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Target,
  TrendingUp,
  CalendarCheck,
  Keyboard,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PLANS, creditStateFor, enoughFor } from "@/lib/config";
import { credits, learner } from "@/lib/data";
import { routeInfo } from "@/lib/routes";
import { clearDeviceData, useStandalone } from "@/lib/pwa";
import { ThemeProvider, useTheme, type ThemePref } from "./theme";
import { Dialog } from "./dialog";
import { NotificationBell } from "./notifications";
import { KeyboardSheet, useShortcutSheet } from "./keyboard-sheet";
import { OfflineBanner } from "./pwa";

/* DS §9 — order locked: Home, Assess, Practice, Plan, Progress. */
const PRIMARY: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/assess", label: "Assess", icon: ClipboardCheck },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/plan", label: "Plan", icon: CalendarCheck },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

const SECONDARY: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/credits", label: "Credits", icon: Zap },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const initials = `${learner.firstName[0]}${learner.lastName[0]}`;
const plan = PLANS[learner.plan];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ShellFrame>{children}</ShellFrame>
    </ThemeProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const info = routeInfo(pathname);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const keys = useShortcutSheet();
  // An installed app has no browser Back button, so the shell keeps its own at every width.
  const standalone = useStandalone();

  // On client navigation, move focus to the new page's h1 (a11y §14) — not on first load.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-btn focus:border-2 focus:border-ink focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>

      <Sidebar section={info.section} onShortcuts={keys.show} />

      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-w)] print:pl-0">
        <header className="print:hidden sticky top-0 z-20 border-b border-border-subtle bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex h-[var(--topbar-h)] max-w-[1264px] items-center gap-2 px-4 sm:px-6 lg:px-8">
            {info.parent ? (
              <Link
                href={info.parent.href}
                className={`-ml-2 flex h-11 items-center gap-0.5 rounded-btn pr-2 text-sm font-semibold text-muted hover:text-ink ${standalone ? "" : "lg:hidden"}`}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
                <span className="sr-only">Back to </span>
                {info.parent.label}
              </Link>
            ) : (
              <Link href="/dashboard" aria-label="Learnometry home" className="-ml-1 flex size-11 shrink-0 items-center justify-center lg:hidden">
                <Image src="/logo-mark.png" alt="" width={64} height={64} sizes="36px" className="size-9" priority />
              </Link>
            )}
            <h1
              ref={titleRef}
              tabIndex={-1}
              className={`min-w-0 truncate leading-tight text-ink outline-none lg:flex-none lg:text-left lg:font-display lg:text-2xl ${
                info.parent ? "flex-1 text-center text-[15px] font-semibold" : "font-display text-xl"
              }`}
            >
              {info.title}
            </h1>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <CreditChip />
              <NotificationBell />
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Account menu"
                className="flex size-11 items-center justify-center lg:hidden"
              >
                <Avatar />
              </button>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 pb-[calc(var(--bottomnav-h)+28px)] pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <OfflineBanner />
            {children}
          </div>
        </main>
      </div>

      <BottomTabs section={info.section} />
      <AccountSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
      <KeyboardSheet open={keys.open} onClose={keys.close} />
    </>
  );
}

function navItemClass(active: boolean) {
  return `relative flex min-h-11 items-center gap-3 rounded-btn px-3 text-[15px] transition-colors duration-150 ${
    active
      ? "bg-primary/10 font-semibold text-primary-text after:absolute after:bottom-2 after:left-0 after:top-2 after:w-1 after:rounded-r after:bg-primary"
      : "font-medium text-muted hover:bg-sunken hover:text-ink"
  }`;
}

function Sidebar({ section, onShortcuts }: { section: string; onShortcuts: () => void }) {
  return (
    <aside aria-label="Sidebar" className="print:hidden fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-w)] flex-col border-r border-border-subtle bg-background lg:flex">
      <Link href="/dashboard" aria-label="Learnometry home" className="flex h-[var(--topbar-h)] items-center px-5">
        <Image src="/primary-logo.png" alt="Learnometry" width={611} height={133} sizes="180px" className="h-9 w-auto dark:hidden" priority />
        <Image src="/primary-logo-dark.png" alt="Learnometry" width={611} height={133} sizes="180px" className="hidden h-9 w-auto dark:block" />
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-3">
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} aria-current={section === item.href ? "page" : undefined} className={navItemClass(section === item.href)}>
            <item.icon aria-hidden="true" className="size-5 shrink-0" />
            {item.label}
          </Link>
        ))}
        <hr className="my-3 border-border-subtle" />
        {SECONDARY.map((item) => (
          <Link key={item.href} href={item.href} aria-current={section === item.href ? "page" : undefined} className={navItemClass(section === item.href)}>
            <item.icon aria-hidden="true" className="size-5 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/help" className="mx-3 mb-2 flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
        <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
        Help
      </Link>
      <UserBlock onShortcuts={onShortcuts} />
    </aside>
  );
}

function BottomTabs({ section }: { section: string }) {
  return (
    <nav
      aria-label="Main"
      className="print:hidden fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-xl">
        {PRIMARY.map((item) => {
          const active = section === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150 ${active ? "text-ink" : "text-muted"}`}
              >
                {active ? <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" /> : null}
                <item.icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Avatar() {
  return (
    <span className="flex size-9 items-center justify-center rounded-full border border-line bg-primary/20 text-xs font-bold text-ink">
      {initials}
    </span>
  );
}

function UserBlock({ onShortcuts }: { onShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border-subtle p-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-btn p-2 text-left hover:bg-sunken"
        aria-haspopup="dialog"
      >
        <Avatar />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {learner.firstName} {learner.lastName}
          </span>
          <span className="block truncate text-xs text-muted">
            {learner.exam} · {plan.name}
          </span>
        </span>
      </button>
      <AccountSheet open={open} onClose={() => setOpen(false)} onShortcuts={onShortcuts} />
    </div>
  );
}

/** `onShortcuts` is passed only where a keyboard is likely (the desktop sidebar's account menu). */
function AccountSheet({ open, onClose, onShortcuts }: { open: boolean; onClose: () => void; onShortcuts?: () => void }) {
  const { pref, setPref } = useTheme();
  const themes: { value: ThemePref; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  const link = "flex min-h-12 items-center gap-3 rounded-btn px-3 text-[15px] font-medium text-ink hover:bg-sunken";
  return (
    <Dialog open={open} onClose={onClose} title={`${learner.firstName} ${learner.lastName}`} description={`${learner.email} · ${plan.name} plan`} variant="sheet">
      <nav aria-label="Account" className="flex flex-col gap-1">
        {SECONDARY.map((item) => (
          <Link key={item.href} href={item.href} onClick={onClose} className={link}>
            <item.icon aria-hidden="true" className="size-5 text-muted" />
            {item.label}
          </Link>
        ))}
        <Link href="/help" onClick={onClose} className={link}>
          <LifeBuoy aria-hidden="true" className="size-5 text-muted" />
          Help
        </Link>
        {onShortcuts ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onShortcuts();
            }}
            className={`${link} w-full text-left`}
          >
            <Keyboard aria-hidden="true" className="size-5 text-muted" />
            Keyboard shortcuts
          </button>
        ) : null}
      </nav>
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-ink">Theme</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-border-subtle bg-sunken p-1">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={pref === t.value}
              onClick={() => setPref(t.value)}
              className={`flex h-10 touch:h-11 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold ${
                pref === t.value ? "border-border-subtle bg-surface text-ink shadow-sm" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <t.icon aria-hidden="true" className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Link href="/login" onClick={() => void clearDeviceData()} className={`${link} mt-5 border-t border-border-subtle pt-2`}>
        <LogOut aria-hidden="true" className="size-5 text-muted" />
        Sign out
      </Link>
    </Dialog>
  );
}

/* ---------- Credit chip (DS §21, Web App Structure §7.8) ---------- */

function CreditChip() {
  const [open, setOpen] = useState(false);
  const state = creditStateFor(credits.balance, plan.periodCredits);
  const tone = {
    normal: "border-border-subtle bg-surface text-ink",
    low: "border-warning/45 bg-warning/15 text-warning-text",
    critical: "border-line bg-warning text-on-primary",
    exhausted: "border-danger bg-surface text-danger-text border-2",
  }[state];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex h-9 touch:h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums ${tone}`}
      >
        <Zap aria-hidden="true" className={`size-4 ${state === "normal" ? "text-primary-deep" : ""}`} />
        {credits.balance}
        <span className="hidden sm:inline"> credits</span>
        <span className="sr-only">. View credit details</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${credits.balance} credits`} description={`${plan.name} plan · ${plan.periodCredits} a day, refilled at 00:00 IST`}>
        <p className="mb-2 text-[15px] font-semibold text-ink">{enoughFor(credits.balance)}</p>
        <ul className="divide-y divide-border-subtle">
          {credits.buckets.map((b) => (
            <li key={b.label} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-ink">{b.label}</p>
                <p className="text-xs text-muted">{b.note}</p>
              </div>
              <p className="font-display text-xl tabular-nums text-ink">{b.amount}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">We use credits that expire soonest first.</p>
        <Link href="/credits" onClick={() => setOpen(false)} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
          View credit history
        </Link>
      </Dialog>
    </>
  );
}
