"use client";

/**
 * Web Push, browser side — Web App Structure §8.16–§8.17, §9.10, decisions L5–L7.
 *
 * Rules: push is offered only to an installed app; permission is asked only from a tap on
 * "Turn on push notifications", never on load; the copy of every push is generic (no score,
 * name or question text on a lock screen); and nothing here nags.
 *
 * `SHARED.push` and `SHARED.pushSubscription` stand in for the subscription row the API will
 * hold (`POST /api/push/subscriptions`). With `NEXT_PUBLIC_VAPID_PUBLIC_KEY` unset (this
 * build, no server yet) permission and the test notification still work end to end; a real
 * subscription is created the moment the key exists.
 */
import { SHARED, removeShared, writeShared } from "./local-store";
import { isIOS, isStandalone, workerReady } from "./pwa";

export type PushPrefs = { retest: boolean; diagnosis: boolean; guardian: boolean; daily: boolean; time: string };

export const REMINDER_TIMES = ["07:00", "16:00", "18:00", "19:00", "20:00", "21:00"] as const;

/** Reminder is opt-in (§8.17); event pushes start on once push itself is on. */
export const DEFAULT_PUSH_PREFS: PushPrefs = { retest: true, diagnosis: true, guardian: true, daily: false, time: "19:00" };

/**
 * unsupported: this browser can't do push · ios-install: iPhone/iPad only allow push for an
 * installed app (16.4+) · install: install first (§9.8) · blocked: the user said no in the
 * browser · off: can be turned on · on: subscribed.
 */
export type PushState = "unsupported" | "ios-install" | "install" | "blocked" | "off" | "on";

export const pushCapable = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** `enabled` is the app's own flag; permission can be revoked behind our back, so both are checked. */
export function derivePushState(enabled: boolean): PushState {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!pushCapable()) return "unsupported";
  if (!isStandalone()) return "install";
  if (Notification.permission === "denied") return "blocked";
  return enabled && Notification.permission === "granted" ? "on" : "off";
}

function vapidKey(): Uint8Array<ArrayBuffer> | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const raw = atob((key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnableResult = "on" | "blocked" | "dismissed" | "unsupported" | "error";

/** Must be called from a tap: browsers ignore (or auto-deny) permission requests made on load. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushCapable()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return "blocked";
    if (permission !== "granted") return "dismissed";
    const registration = await workerReady();
    const key = vapidKey();
    if (key) {
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      writeShared(SHARED.pushSubscription, sub.toJSON());
    }
    writeShared(SHARED.push, { enabled: true });
    return "on";
  } catch {
    return "error";
  }
}

export async function disablePush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
  } catch {}
  removeShared(SHARED.pushSubscription);
  writeShared(SHARED.push, { enabled: false });
}

/** A local notification through the same worker path, so the learner can see what push looks like. */
export async function sendTestNotification(): Promise<boolean> {
  try {
    if (Notification.permission !== "granted") return false;
    const registration = await workerReady();
    await registration.showNotification("This is what a notification looks like", {
      body: "Your retest is ready.",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: "test",
      data: { url: "/settings/notifications" },
    });
    return true;
  } catch {
    return false;
  }
}
