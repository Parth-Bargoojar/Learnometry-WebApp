"use client";

/**
 * Browser-held stand-in for server state that two people or two tabs share:
 * guardian consent and purchase approvals. It fires across tabs through the
 * `storage` event, which is how the learner's waiting screen "hears" consent the
 * way the production realtime subscription will (Web App Structure §8.2).
 *
 * Replace each `useShared` key with the matching API + realtime channel
 * (CONTEXT §7.8); callers keep the same shape.
 */
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "lm-shared:";
const EVENT = "lm-shared-change";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// useSyncExternalStore needs a stable snapshot per raw value.
const cache = new Map<string, { raw: string | null; value: unknown }>();

function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {}
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  const value = raw ? read(key, fallback) : fallback;
  cache.set(key, { raw, value });
  return value;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Direct read for effects that must not act on the pre-hydration fallback. */
export const readShared = <T,>(key: string, fallback: T): T => read(key, fallback);

export function writeShared<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function removeShared(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

const serverCache = new Map<string, unknown>();

function serverSnapshot<T>(key: string, fallback: T): T {
  if (!serverCache.has(key)) serverCache.set(key, fallback);
  return serverCache.get(key) as T;
}

/** `[value, set]`, where the server render always sees `fallback`. */
export function useShared<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot(key, fallback),
    () => serverSnapshot(key, fallback),
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback);
      writeShared(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    // fallback is data, not identity; key fully determines the slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/* ---------- Keys ---------- */

export const SHARED = {
  /** Purchase requests created or decided in this browser, merged over the sample list. */
  requests: "purchase-requests",
  /** The pending consent request from onboarding, read by /consent/[token]. */
  consent: "consent-request",
  /** Consent state changes made in the guardian portal. */
  guardianConsent: "guardian-consent",
  /** Highest plan version whose change banner was dismissed. */
  planChangeSeen: "plan-change-seen",
  /** Notification ids marked read. */
  readNotifications: "read-notifications",
  /* Phase L (PWA and push). `push` and `pushSubscription` stand in for the subscription row the API will hold. */
  installDismissed: "install-dismissed",
  notificationPrefs: "notification-prefs",
  push: "push",
  pushSubscription: "push-subscription",
  /* Admin console (phase K): overrides over the sample tables in admin-data.ts. */
  adminAudit: "admin-audit",
  adminQuestions: "admin-questions",
  adminFlags: "admin-flags",
  adminRefunds: "admin-refunds",
  adminAbuse: "admin-abuse",
  adminCredits: "admin-credits",
  adminLearners: "admin-learners",
  adminCurriculum: "admin-curriculum",
  adminWebhooks: "admin-webhooks",
  adminCoupons: "admin-coupons",
} as const;
