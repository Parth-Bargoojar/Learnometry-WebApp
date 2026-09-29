"use client";

import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";

/** Root layout, every route: registers the service worker (production) and captures the install prompt. */
export function PwaBoot() {
  useEffect(() => {
    startPwa();
  }, []);
  return null;
}
