"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_KEY as KEY } from "@/lib/theme-script";

export type ThemePref = "system" | "light" | "dark";

const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({ pref: "system", setPref: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
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
  }, [apply]);

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      try {
        localStorage.setItem(KEY, p);
      } catch {}
      apply(p);
    },
    [apply],
  );

  return <ThemeContext.Provider value={{ pref, setPref }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
