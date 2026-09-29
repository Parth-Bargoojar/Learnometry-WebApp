"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, CircleCheck, Info } from "lucide-react";
import { SHARED, useShared } from "@/lib/local-store";
import { promptInstall, useInstallKind } from "@/lib/pwa";
import { REMINDER_TIMES, derivePushState, disablePush, enablePush, sendTestNotification, type PushPrefs, type PushState } from "@/lib/push";
import { InstallSteps } from "./pwa";
import { btn } from "./ui";

/*
  Push section of Settings › Notifications — Web App Structure §8.16, §8.17, decisions L5–L7.
  What you see depends on where you are: an unsupported browser, a tab that isn't installed
  yet, a blocked permission, or a device that is ready. Nothing is faked and nothing asks
  for permission until the "Turn on" button is tapped.
*/

const NO_PUSH = { enabled: false };

function subscribeVisibility(onChange: () => void) {
  // Permission can be changed in browser settings while this page is open in another window.
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const row = "flex min-h-14 items-center justify-between gap-4 py-2";
const box = "size-5 shrink-0 accent-[var(--color-primary-deep)]";

export function PushSection({
  prefs,
  onChange,
  showGuardian,
  notify,
}: {
  prefs: PushPrefs;
  onChange: (next: PushPrefs) => void;
  showGuardian: boolean;
  notify: (message: string) => void;
}) {
  const [flag] = useShared<{ enabled: boolean }>(SHARED.push, NO_PUSH);
  const state = useSyncExternalStore<PushState | null>(
    subscribeVisibility,
    () => derivePushState(flag.enabled),
    () => null,
  );
  const install = useInstallKind();
  const [steps, setSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    notify(
      {
        on: "Push is on for this device.",
        blocked: "Your browser blocked notifications. Allow them in its settings, then try again.",
        dismissed: "Nothing was turned on. You can try again any time.",
        unsupported: "This browser can't show push notifications.",
        error: "We couldn't turn push on. Check your connection and try again.",
      }[result],
    );
  };

  const shown = state === "on" || state === "off" || state === "install" || state === "ios-install";
  const enabled = state === "on";
  const set = (patch: Partial<PushPrefs>) => onChange({ ...prefs, ...patch });

  return (
    <fieldset className="mt-6" aria-describedby="push-note">
      <legend className="text-sm font-semibold text-ink">Push notifications</legend>

      <div id="push-note" className="mt-1 text-sm text-muted">
        {state === "on" ? (
          <p className="flex items-center gap-2 text-ink">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success-text" />
            Push is on for this device.
          </p>
        ) : null}
        {state === "off" ? <p>Learnometry will ask your browser for permission. We only send what you choose below: no streak reminders, no guilt messages.</p> : null}
        {state === "install" ? <p>Push works once you install Learnometry to your home screen and allow notifications.</p> : null}
        {state === "ios-install" ? <p>On iPhone and iPad, push works after you add Learnometry to your home screen (iOS 16.4 or later).</p> : null}
        {state === "blocked" ? (
          <p className="flex items-start gap-2">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Notifications are blocked for Learnometry in your browser settings. Allow them there, then come back to turn push on.
          </p>
        ) : null}
        {state === "unsupported" ? <p>This browser can&apos;t show push notifications. Email still works.</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {state === "off" ? (
          <button type="button" onClick={turnOn} disabled={busy} className={btn("secondary", "md")}>
            <BellRing aria-hidden="true" className="size-4" />
            {busy ? "Waiting for your browser…" : "Turn on push notifications"}
          </button>
        ) : null}
        {state === "ios-install" ? (
          <button type="button" onClick={() => setSteps(true)} className={btn("secondary", "md")}>
            Show me how
          </button>
        ) : null}
        {state === "install" && install === "prompt" ? (
          <button type="button" onClick={() => void promptInstall()} className={btn("secondary", "md")}>
            Add to home screen
          </button>
        ) : null}
        {enabled ? (
          <>
            <button
              type="button"
              onClick={async () => notify((await sendTestNotification()) ? "Test notification sent." : "We couldn't show a test notification.")}
              className={btn("secondary", "md")}
            >
              Send a test
            </button>
            <button type="button" onClick={() => void disablePush().then(() => notify("Push is off for this device."))} className={btn("ghost", "md")}>
              Turn off on this device
            </button>
          </>
        ) : null}
      </div>

      {shown ? (
        <ul className={`mt-2 divide-y divide-border-subtle ${enabled ? "" : "opacity-60"}`}>
          <li>
            <label className={`${row} ${enabled ? "cursor-pointer" : ""}`}>
              <span className="text-[15px] text-ink">Retest ready</span>
              <input type="checkbox" disabled={!enabled} checked={prefs.retest} onChange={(e) => set({ retest: e.target.checked })} className={box} />
            </label>
          </li>
          <li>
            <label className={`${row} ${enabled ? "cursor-pointer" : ""}`}>
              <span>
                <span className="block text-[15px] text-ink">Diagnosis ready</span>
                <span className="block text-xs text-muted">Only when you&apos;ve left the page while it was being made</span>
              </span>
              <input type="checkbox" disabled={!enabled} checked={prefs.diagnosis} onChange={(e) => set({ diagnosis: e.target.checked })} className={box} />
            </label>
          </li>
          {showGuardian ? (
            <li>
              <label className={`${row} ${enabled ? "cursor-pointer" : ""}`}>
                <span>
                  <span className="block text-[15px] text-ink">Guardian decisions</span>
                  <span className="block text-xs text-muted">When a purchase request is approved or declined</span>
                </span>
                <input type="checkbox" disabled={!enabled} checked={prefs.guardian} onChange={(e) => set({ guardian: e.target.checked })} className={box} />
              </label>
            </li>
          ) : null}
          <li className={row}>
            <label className={`flex flex-1 items-center justify-between gap-4 ${enabled ? "cursor-pointer" : ""}`}>
              <span>
                <span className="block text-[15px] text-ink">Daily study reminder</span>
                <span className="block text-xs text-muted">Off unless you turn it on</span>
              </span>
              <input type="checkbox" disabled={!enabled} checked={prefs.daily} onChange={(e) => set({ daily: e.target.checked })} className={box} />
            </label>
            <select
              aria-label="Reminder time"
              disabled={!enabled || !prefs.daily}
              value={prefs.time}
              onChange={(e) => set({ time: e.target.value })}
              className="h-11 rounded-input border border-border-subtle bg-surface px-2 text-sm text-ink"
            >
              {REMINDER_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </li>
        </ul>
      ) : null}
      <InstallSteps open={steps} onClose={() => setSteps(false)} />
    </fieldset>
  );
}
