"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { hexA } from "@/lib/lmsbr/data";

export type SurveyThemeColors = {
  cardBg: string; cardBdr: string; cardShadow: string;
  panelBg: string; panelShadow: string;
  tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string;
  inputBg: string; inputBdr: string;
  barTrack: string;
};

export type SurveyTheme = {
  card: string;
  cardBdr: string;
  cardShadow: string;
  text: string;
  muted: string;
  dim: string;
  accent: string;
  accentSoft: string;
  track: string;
  tableHead: string;
  tableHov: string;
  tableSep: string;
  inputBg: string;
  inputBdr: string;
  green: string;
  isDark: boolean;
};

export function buildSurveyTheme(C: SurveyThemeColors, accent: string, isDark: boolean): SurveyTheme {
  return {
    card: isDark ? C.panelBg : C.cardBg,
    cardBdr: C.cardBdr,
    cardShadow: isDark ? C.panelShadow : C.cardShadow,
    text: C.txtPrimary,
    muted: C.txtSecondary,
    dim: C.txtMuted,
    accent,
    accentSoft: hexA(accent, isDark ? 0.14 : 0.1),
    track: C.barTrack,
    tableHead: C.tableHead,
    tableHov: C.tableHov,
    tableSep: C.tableSep,
    inputBg: C.inputBg,
    inputBdr: C.inputBdr,
    green: isDark ? "#10b981" : "#059669",
    isDark,
  };
}

const SurveyThemeCtx = createContext<SurveyTheme | null>(null);

export function SurveyThemeProvider({
  C, accent, isDark, children,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  children: ReactNode;
}) {
  const theme = useMemo(
    () => buildSurveyTheme(C, accent, isDark),
    [
      C.cardBg, C.cardBdr, C.cardShadow, C.panelBg, C.panelShadow,
      C.tableSep, C.tableHead, C.tableHov, C.txtPrimary, C.txtSecondary,
      C.txtMuted, C.inputBg, C.inputBdr, C.barTrack, accent, isDark,
    ],
  );
  return <SurveyThemeCtx.Provider value={theme}>{children}</SurveyThemeCtx.Provider>;
}

export function useSurveyTheme(): SurveyTheme {
  const t = useContext(SurveyThemeCtx);
  if (!t) throw new Error("useSurveyTheme must be used within SurveyThemeProvider");
  return t;
}
