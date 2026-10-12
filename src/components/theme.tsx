"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_KEY as KEY } from "@/lib/theme-script";

export type ThemePref = "system" | "light" | "dark";

const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({ pref: "system", setPref: () => {} });

/**
 * `serverPref` is the account's saved theme (BE-2.7). It wins over this device's stored value so
 * the choice follows the person; the stored value stays because the inline script needs it to
 * paint the right theme before React loads. `persist` saves changes to the account.
 */
export function ThemeProvider({ children, serverPref, persist }: { children: ReactNode; serverPref?: ThemePref; persist?: (p: ThemePref) => void }) {
  const [pref, setPrefState] = useState<ThemePref>("system");

  const apply = useCallback((p: ThemePref) => {
    const dark = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  useEffect(() => {
    let stored: ThemePref = "system";
    try {
      stored = (localStorage.getItem(KEY) as ThemePref) || "system";
    } catch {}
    if (serverPref && serverPref !== stored) {
      stored = serverPref;
      try {
        localStorage.setItem(KEY, serverPref);
      } catch {}
      apply(serverPref);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only preference after mount
    setPrefState(stored);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: ThemePref = "system";
      try {
        current = (localStorage.getItem(KEY) as ThemePref) || "system";
      } catch {}
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [apply, serverPref]);

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      try {
        localStorage.setItem(KEY, p);
      } catch {}
      apply(p);
      persist?.(p);
    },
    [apply, persist],
  );

  return <ThemeContext.Provider value={{ pref, setPref }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
