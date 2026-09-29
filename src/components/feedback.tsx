/**
 * Feedback components — DS §24, §13 (mascot), §49.8. Server-safe.
 */
import Image from "next/image";
import type { ReactNode } from "react";
import { CircleAlert, Lock } from "lucide-react";

const mascotSize = { sm: 64, md: 96, lg: 144 } as const;

/** The panda, always contained: 2px ink circle + primary ring (DS §49.8). Decorative. */
export function Mascot({ size = "md", className = "" }: { size?: keyof typeof mascotSize; className?: string }) {
  const px = mascotSize[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white ring-4 ring-primary/25 animate-fade-in ${className}`}
      style={{ width: px, height: px }}
    >
      <Image src="/mascot.jpeg" alt="" width={px * 2} height={px * 2} sizes={`${px}px`} className="size-full scale-110 object-contain" />
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  mascot = true,
  as: Heading = "h2",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  mascot?: boolean;
  /** "h1" where the page has no top bar to carry the page title (the root 404). */
  as?: "h1" | "h2";
}) {
  return (
    <div role="status" className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-4 py-10 text-center">
      {mascot ? <Mascot /> : null}
      <Heading className="mt-2 text-lg font-semibold text-ink">{title}</Heading>
      <p className="text-[15px] leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, reassurance, action }: { title: string; reassurance: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-danger/35 bg-danger/5 p-5">
      <span className="flex size-12 items-center justify-center rounded-card-sm bg-danger/10">
        <CircleAlert aria-hidden="true" className="size-6 text-danger-text" />
      </span>
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{reassurance}</p>
      </div>
      {action}
    </div>
  );
}

export function LockedState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card-lg border-2 border-dashed border-faint bg-surface p-6">
      <span className="flex size-10 items-center justify-center rounded-card-sm bg-sunken">
        <Lock aria-hidden="true" className="size-5 text-muted" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 max-w-prose text-[15px] text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}
