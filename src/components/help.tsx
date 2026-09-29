"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Mail } from "lucide-react";
import { PLANS } from "@/lib/config";
import { learner } from "@/lib/data";
import { SUPPORT_EMAIL, SUPPORT_REPLY } from "@/lib/site";
import { SUPPORT_TOPICS, type SupportTopic } from "@/lib/support";
import { Dialog } from "./dialog";
import { btn } from "./ui";

/*
  Help — Web App Structure §4.1 `/help`: answers first, then a support email that
  already carries the account details (the website's email-support modal, adapted:
  signed-in users never have to type who they are).
*/

function mailParts(topic: SupportTopic) {
  const t = SUPPORT_TOPICS[topic];
  const body = [
    "Hi Learnometry team,",
    "",
    t.ask,
    "",
    "",
    "—",
    `Account email: ${learner.email}`,
    `Plan: ${PLANS[learner.plan].name} · Exam: ${learner.exam}`,
  ].join("\n");
  const s = encodeURIComponent(t.subject);
  const b = encodeURIComponent(body);
  return {
    mailto: `mailto:${SUPPORT_EMAIL}?subject=${s}&body=${b}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${s}&body=${b}`,
  };
}

export function ContactSupport({ initialTopic }: { initialTopic?: SupportTopic }) {
  const [open, setOpen] = useState(!!initialTopic);
  const [topic, setTopic] = useState<SupportTopic>(initialTopic ?? "problem");
  const [copied, setCopied] = useState(false);
  const links = mailParts(topic);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("primary")}>
        <Mail aria-hidden="true" className="size-5" />
        Contact support
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Contact support" description={SUPPORT_REPLY}>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">What is it about?</legend>
          <div className="mt-2 flex flex-col gap-2">
            {(Object.keys(SUPPORT_TOPICS) as SupportTopic[]).map((k) => (
              <label
                key={k}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card-sm border-2 px-3 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  topic === k ? "border-line bg-primary/10" : "border-border-subtle"
                }`}
              >
                <input type="radio" name="topic" checked={topic === k} onChange={() => setTopic(k)} className="sr-only" />
                <span className="flex-1 text-[15px] font-medium text-ink">{SUPPORT_TOPICS[k].label}</span>
                {topic === k ? <Check aria-hidden="true" className="size-4 text-ink" /> : null}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-4 text-sm text-muted">We add your account email and plan to the message, so you don&apos;t have to.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href={links.mailto} className={btn("primary", "md", "sm:flex-1")}>
            Open email app
          </a>
          <a href={links.gmail} target="_blank" rel="noopener" className={btn("secondary", "md", "sm:flex-1")}>
            Open in Gmail <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card-sm bg-sunken px-3 py-2">
          <span className="min-w-0 truncate text-sm text-ink">{SUPPORT_EMAIL}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(SUPPORT_EMAIL);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2500);
              } catch {}
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary-text"
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            <span aria-live="polite">{copied ? "Copied" : "Copy address"}</span>
          </button>
        </div>
      </Dialog>
    </>
  );
}

export function HelpAnswers({ items }: { items: { q: string; a: string }[] }) {
  return (
    <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
      {items.map((it) => (
        <li key={it.q}>
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {it.q}
              <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-4 text-[15px] leading-relaxed text-ink">{it.a}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
