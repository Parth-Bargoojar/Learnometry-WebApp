"use client";

/**
 * Browser-side PWA state — Web App Structure §9.8. Three things the UI asks about:
 * am I online, am I running installed, and can I offer to install.
 *
 * `beforeinstallprompt` fires once, early, and only Chromium fires it, so `startPwa()`
 * (called from <PwaBoot> in the root layout) captures it for whichever screen needs it later.
 * Safari on iOS has no such event; there the install card explains "Add to Home Screen".
 */
import { useSyncExternalStore } from "react";
import { SHARED, removeShared } from "./local-store";

/** Today's plan, kept for the offline page (written by <TodayPlanSnapshot>). */
export const TODAY_PLAN_KEY = "lm-today-plan";

/* ---------- Online ---------- */

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True on the server, so nothing flashes "offline" during hydration. */
export const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

/* ---------- Installed (standalone) ---------- */

const STANDALONE = "(display-mode: standalone)";

export function isStandalone() {
  // iOS Safari reports installed state on `navigator.standalone`, not in the media query.
  return window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function subscribeStandalone(onChange: () => void) {
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export const useStandalone = () => useSyncExternalStore(subscribeStandalone, isStandalone, () => false);

export function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS 13+ presents as a Mac; a Mac has no touch points.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/* ---------- Install prompt ---------- */

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallEvent | null = null;
let installedThisSession = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Idempotent. Registers the service worker (production only) and captures the install prompt. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedThisSession = true;
    emit();
  });

  // In development a cache-first worker would serve stale chunks and hide hot reload.
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    const register = () => workerReady().catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}

/** Registering is idempotent; this also makes push work in development, where startPwa() skips the worker. */
export async function workerReady() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/**
 * installed: already running as an app · prompt: the browser can install it on a tap ·
 * ios: install by hand from the Share sheet · none: this browser can't (say nothing).
 */
export type InstallKind = "installed" | "prompt" | "ios" | "none";

function installKind(): InstallKind {
  if (installedThisSession || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "none";
}

function subscribeInstall(onChange: () => void) {
  listeners.add(onChange);
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onChange);
  };
}

export const useInstallKind = () => useSyncExternalStore<InstallKind>(subscribeInstall, installKind, () => "none");

/** Must run from a tap. "unavailable" means the browser withdrew the prompt. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null; // a prompt can be used once
  emit();
  await event.prompt();
  return (await event.userChoice).outcome;
}

/* ---------- Sign-out ---------- */

/** Everything this device keeps for the learner that must not outlive their session. */
export async function clearDeviceData() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.active?.postMessage({ type: "clear-user-data" });
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {}
  try {
    localStorage.removeItem(TODAY_PLAN_KEY);
  } catch {}
  removeShared(SHARED.push);
  removeShared(SHARED.pushSubscription);
}
