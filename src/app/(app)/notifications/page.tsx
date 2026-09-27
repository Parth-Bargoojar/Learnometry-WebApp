import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notifications } from "@/lib/data";
import { relativeDay } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <ul className="mx-auto flex max-w-[760px] flex-col divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
      {notifications.map((n) => (
        <li key={n.id}>
          <Link href={n.href} className="flex gap-4 px-5 py-4 hover:bg-sunken">
            <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken">
              <Bell aria-hidden="true" className="size-4 text-muted" />
              {n.unread ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-danger" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] ${n.unread ? "font-semibold" : "font-medium"} text-ink`}>
                {n.title}
                {n.unread ? <span className="sr-only"> (unread)</span> : null}
              </span>
              <span className="block text-sm text-muted">{n.body}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">{relativeDay(n.date)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
