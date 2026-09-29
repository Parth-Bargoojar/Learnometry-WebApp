"use client";

import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";

/** Root layout, every route: registers the service worker (production) and captures the install prompt. */
export function PwaBoot() {
  useEffect(() => {
    // In development, clear any legacy service worker and cached HTML on localhost
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
      return;
    }
    startPwa();
  }, []);
  return null;
}
