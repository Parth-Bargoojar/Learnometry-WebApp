"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, LifeBuoy, LogOut, Monitor, Moon, Settings, Sun, UserCheck, Users, type LucideIcon } from "lucide-react";
import { guardianAccount, guardianLearners } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import { clearDeviceData } from "@/lib/pwa";
import { Dialog } from "./dialog";
import { Popover } from "./popover";
import { OfflineBanner } from "./pwa";
import { ThemeProvider, useTheme, type ThemePref } from "./theme";

/*
  Shell E — Guardian (Web App Structure §5.6, §8.18). Top bar only: logo, learner
  switcher when there's more than one child, account menu. Three destinations,
  reached from the overview; sub-pages get a Back link instead of tabs.
*/

export function GuardianShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Frame>{children}</Frame>
    </ThemeProvider>
  );
}

const initials = guardianAccount.name
  .split(" ")
  .map((p) => p[0])
  .join("");

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const first = useRef(true);
  const learnerId = /^\/guardian\/(lrn_[^/]+)/.exec(pathname)?.[1] ?? null;
  const isOverview = pathname === "/guardian";

  // Move focus to the new page's h1 on client navigation (a11y §14), not on first load.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>("#main h1")?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-btn focus:border-2 focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-[var(--topbar-h)] max-w-[1008px] items-center gap-2 px-4 sm:px-6">
          <Link href="/guardian" aria-label="Guardian overview" className="flex h-11 min-w-11 shrink-0 items-center">
            <Image src="/logo-mark.png" alt="" width={64} height={64} sizes="36px" className="size-9 sm:hidden" priority />
            <Image src="/primary-logo.png" alt="Learnometry" width={611} height={133} sizes="160px" className="hidden h-8 w-auto sm:block dark:sm:hidden" priority />
            <Image src="/primary-logo-dark.png" alt="Learnometry" width={611} height={133} sizes="160px" className="hidden h-8 w-auto dark:sm:block" />
          </Link>
          <span className="ml-1 hidden rounded-full border border-border-subtle bg-sunken px-2.5 py-0.5 text-xs font-semibold text-muted sm:inline">Guardian</span>
          <div className="ml-auto flex items-center gap-1.5">
            {guardianLearners.length > 1 ? <LearnerSwitcher current={learnerId} /> : null}
            <button type="button" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-label="Account menu" className="flex size-11 items-center justify-center">
              <span className="flex size-9 items-center justify-center rounded-full border-2 border-line bg-primary/20 text-xs font-bold text-ink">{initials}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 px-4 pb-16 pt-5 text-[17px] sm:px-6 sm:pt-8">
        <div className="mx-auto w-full max-w-[960px]">
          <OfflineBanner />
          {!isOverview ? (
            <Link href="/guardian" className="-ml-2 mb-3 inline-flex h-11 items-center gap-0.5 rounded-btn pr-2 text-sm font-semibold text-muted hover:text-ink">
              <ChevronLeft aria-hidden="true" className="size-5" />
              Overview
            </Link>
          ) : null}
          {children}
        </div>
      </main>

      <AccountSheet open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

function LearnerSwitcher({ current }: { current: string | null }) {
  const active = guardianLearners.find((l) => l.id === current);
  return (
    <Popover
      triggerClassName="flex h-11 items-center gap-1.5 rounded-btn border border-border-subtle bg-surface px-3 text-sm font-semibold text-ink hover:border-line"
      panelClassName="w-60"
      trigger={
        <>
          <Users aria-hidden="true" className="size-4 text-muted" />
          <span className="max-w-[8rem] truncate">{active ? active.firstName : "All children"}</span>
          <span className="sr-only">: switch child</span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted" />
        </>
      }
    >
      {(close) => (
        <ul>
          <li>
            <SwitchLink href="/guardian" label="All children" active={!current} onPick={close} />
          </li>
          {guardianLearners.map((l) => (
            <li key={l.id}>
              <SwitchLink
                href={l.status === "active" ? `/guardian/${l.id}` : "/guardian"}
                label={`${l.firstName} ${l.lastName}`}
                note={l.status === "active" ? l.exam : "Invite sent"}
                active={current === l.id}
                onPick={close}
              />
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

function SwitchLink({ href, label, note, active, onPick }: { href: string; label: string; note?: string; active: boolean; onPick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onPick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-2 rounded-btn px-3 py-1.5 text-sm hover:bg-sunken ${active ? "font-semibold text-ink" : "text-ink"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {note ? <span className="block text-xs font-normal text-muted">{note}</span> : null}
      </span>
      {active ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
    </Link>
  );
}

function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pref, setPref } = useTheme();
  const themes: { value: ThemePref; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  const link = "flex min-h-12 items-center gap-3 rounded-btn px-3 text-[15px] font-medium text-ink hover:bg-sunken";
  return (
    <Dialog open={open} onClose={onClose} title={guardianAccount.name} description={`${guardianAccount.email} · Guardian account`} variant="sheet">
      <nav aria-label="Guardian" className="flex flex-col gap-1">
        <Link href="/guardian" onClick={onClose} className={link}>
          <Users aria-hidden="true" className="size-5 text-muted" />
          Overview
        </Link>
        <Link href="/guardian/approvals" onClick={onClose} className={link}>
          <UserCheck aria-hidden="true" className="size-5 text-muted" />
          Approvals
        </Link>
        <Link href="/guardian/settings" onClick={onClose} className={link}>
          <Settings aria-hidden="true" className="size-5 text-muted" />
          Consent &amp; settings
        </Link>
        <a href={siteUrl("/faq")} onClick={onClose} className={link}>
          <LifeBuoy aria-hidden="true" className="size-5 text-muted" />
          Help
        </a>
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
              className={`flex h-10 touch:h-11 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-semibold ${
                pref === t.value ? "border-line bg-surface text-ink shadow-brutal-sm" : "border-transparent text-muted hover:text-ink"
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
