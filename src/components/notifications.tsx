"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { Bell, CalendarCheck, ClipboardCheck, CreditCard, RefreshCw, UserCheck, Zap, type LucideIcon } from "lucide-react";
import { TODAY, notifications, type NotificationKind } from "@/lib/data";
import { relativeDay } from "@/lib/format";
import { SHARED, useShared } from "@/lib/local-store";
import { Popover } from "./popover";

/*
  Notifications — Web App Structure §8.17: bell popover (latest 5) + full page.
  Read state is shared so the bell dot, the popover and the page agree
  (`POST /api/notifications/read` in production).
*/

const ICON: Record<NotificationKind, LucideIcon> = {
  plan: CalendarCheck,
  diagnosis: ClipboardCheck,
  retest: RefreshCw,
  credits: Zap,
  payment: CreditCard,
  guardian: UserCheck,
};

const NO_READS: string[] = [];

export function useNotifications() {
  const [read, setRead] = useShared<string[]>(SHARED.readNotifications, NO_READS);
  const items = useMemo(() => notifications.map((n) => ({ ...n, unread: n.unread && !read.includes(n.id) })), [read]);
  const markRead = useCallback((id: string) => setRead((r) => (r.includes(id) ? r : [...r, id])), [setRead]);
  const markAll = useCallback(() => setRead(notifications.map((n) => n.id)), [setRead]);
  return { items, unread: items.filter((n) => n.unread).length, markRead, markAll };
}

type Item = ReturnType<typeof useNotifications>["items"][number];

function Row({ n, onOpen, compact = false }: { n: Item; onOpen: () => void; compact?: boolean }) {
  const Icon = ICON[n.kind];
  return (
    <Link href={n.href} onClick={onOpen} className={`flex gap-3 rounded-btn hover:bg-sunken ${compact ? "px-2.5 py-2.5" : "px-5 py-4"}`}>
      <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken">
        <Icon aria-hidden="true" className="size-4 text-muted" />
        {n.unread ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-danger" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block ${compact ? "text-sm" : "text-[15px]"} ${n.unread ? "font-semibold" : "font-medium"} text-ink`}>
          {n.title}
          {n.unread ? <span className="sr-only"> (unread)</span> : null}
        </span>
        <span className={`block text-muted ${compact ? "truncate text-xs" : "text-sm"}`}>{n.body}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{relativeDay(n.date)}</span>
    </Link>
  );
}

export function NotificationBell() {
  const { items, unread, markRead, markAll } = useNotifications();
  return (
    <Popover
      label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      triggerClassName="relative flex size-11 items-center justify-center rounded-btn text-muted hover:bg-sunken hover:text-ink"
      align="none"
      // Mobile: the avatar sits right of the bell, so shift the panel to stay on screen.
      panelClassName="w-[min(22rem,calc(100vw-2rem))] -right-[3.25rem] sm:right-0"
      trigger={
        <>
          <Bell aria-hidden="true" className="size-5" />
          {unread ? <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-surface bg-danger" /> : null}
        </>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread ? (
              <button type="button" onClick={markAll} className="inline-flex min-h-9 touch:min-h-11 items-center text-xs font-semibold text-primary-text underline underline-offset-4">
                Mark all as read
              </button>
            ) : null}
          </div>
          <ul>
            {items.slice(0, 5).map((n) => (
              <li key={n.id}>
                <Row
                  n={n}
                  compact
                  onOpen={() => {
                    markRead(n.id);
                    close();
                  }}
                />
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={close} className="mt-1 flex min-h-11 items-center justify-center border-t border-border-subtle text-sm font-semibold text-primary-text">
            See all notifications
          </Link>
        </div>
      )}
    </Popover>
  );
}

export function NotificationList() {
  const { items, unread, markRead, markAll } = useNotifications();
  const groups = [
    { title: "Today", list: items.filter((n) => n.date === TODAY) },
    { title: "Earlier", list: items.filter((n) => n.date !== TODAY) },
  ].filter((g) => g.list.length);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{unread ? `${unread} unread` : "You're all caught up."}</p>
        {unread ? (
          <button type="button" onClick={markAll} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline underline-offset-4">
            Mark all as read
          </button>
        ) : null}
      </div>
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`n-${g.title}`}>
          <h2 id={`n-${g.title}`} className="mb-2 text-sm font-semibold text-muted">
            {g.title}
          </h2>
          <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
            {g.list.map((n) => (
              <li key={n.id}>
                <Row n={n} onOpen={() => markRead(n.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted">
        Choose which emails you get in{" "}
        <Link href="/settings/notifications" className="font-semibold text-primary-text underline underline-offset-4">
          notification settings
        </Link>
        .
      </p>
    </div>
  );
}
