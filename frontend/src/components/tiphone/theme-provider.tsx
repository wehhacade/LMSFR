"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  themes,
  THEME_STORAGE_KEY,
  type AppColors,
  type ThemeMode,
} from "@/lib/tiphone/theme";

type ThemeCtx = {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function TipThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    return saved && themes[saved] ? saved : "light";
  });

  useEffect(() => {
    const root = document.querySelector(".tiphone-root") as HTMLElement | null;
    if (!root) return;
    root.setAttribute("data-tip-theme", mode);
    root.style.colorScheme = mode === "light" ? "light" : "dark";
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(THEME_STORAGE_KEY, m);
  }, []);

  const value = useMemo(
    () => ({ mode, colors: themes[mode], setMode }),
    [mode, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTipTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTipTheme must be used within TipThemeProvider");
  return ctx;
}
