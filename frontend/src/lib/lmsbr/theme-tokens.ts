/**
 * LMSBR design tokens — shared dark/light surfaces.
 * Gold dark mode + navy palette override (see palette.ts).
 */

import type { CSSProperties } from "react";

/** Shared dark primitives — hub-kadhigis gold dark theme */
export const DARK_CORE = {
  page: "#070504",
  pageAlt: "#080603",
  elevated: "#0a0704",
  overlay: "#110c07",
  dropdown: "linear-gradient(160deg,#120d08,#0a0704)",
  border: "rgba(214,176,114,0.14)",
  borderHover: "rgba(214,176,114,0.32)",
  borderFocus: "rgba(198,144,73,0.55)",
  inputBg: "rgba(255,255,255,0.03)",
  inputBorder: "rgba(214,176,114,0.16)",
  inputFocusBorder: "rgba(214,176,114,0.55)",
  inputPlaceholder: "#6a5a3c",
  textPrimary: "#f3ead9",
  textSecondary: "#b6a589",
  textMuted: "#9a8a6f",
  textAccent: "#e2b667",
  modalOverlay: "rgba(8,6,3,0.62)",
  drawerOverlay: "rgba(8,6,3,0.62)",
  ringColor: "rgba(214,176,114,",
} as const;

/** Dashboard / workspace dark tokens */
export const DASHBOARD_DARK = {
  sidebarBg: "linear-gradient(180deg,#120c07,#080603)",
  sidebarBdr: DARK_CORE.border,
  sidebarShadow: "1px 0 0 rgba(248,228,180,0.04),14px 0 50px -26px rgba(0,0,0,0.75)",
  navBg: "linear-gradient(180deg,rgba(17,11,6,0.97),rgba(10,7,4,0.9))",
  navBdr: "rgba(214,176,114,0.12)",
  headerBg: "linear-gradient(180deg,rgba(13,10,6,0.96),rgba(13,10,6,0.80))",
  headerBdr: "rgba(214,176,114,0.10)",
  cardBg: "linear-gradient(160deg,#120d08,#0a0704)",
  cardBdr: "rgba(214,176,114,0.16)",
  cardBdrHov: DARK_CORE.borderHover,
  cardShadow: "0 20px 46px -28px rgba(0,0,0,.78),inset 0 1px 0 rgba(248,228,180,0.06)",
  panelBg: "linear-gradient(160deg,#110c07,#090603)",
  panelShadow: "0 24px 54px -32px rgba(0,0,0,.8),inset 0 1px 0 rgba(248,228,180,0.05)",
  tableSep: "rgba(214,176,114,0.08)",
  tableHead: "rgba(255,255,255,0.015)",
  tableHov: "rgba(198,144,73,0.05)",
  barTrack: "rgba(255,255,255,0.05)",
  inputBg: DARK_CORE.inputBg,
  inputBdr: DARK_CORE.inputBorder,
  inputFocusBdr: DARK_CORE.inputFocusBorder,
  txtPrimary: DARK_CORE.textPrimary,
  txtSecondary: DARK_CORE.textSecondary,
  txtMuted: DARK_CORE.textMuted,
  txtAccentHd: DARK_CORE.textAccent,
  menuActive: "#f9efd9",
  menuInactive: "#bfb097",
  menuSubActive: "#f3ead9",
  menuSubInact: "#b6a589",
  notifBorder: "#0d0a06",
  btnBg: "rgba(255,255,255,0.03)",
  btnBdr: "rgba(214,176,114,0.18)",
  btnColor: "#b89a6a",
  logoutHovBg: "rgba(224,101,90,.06)",
  logoutHovBdr: "rgba(224,101,90,.34)",
  logoutHovC: "#e0655a",
  footerBdr: "rgba(214,176,114,0.10)",
  footerTxt: "#5a4a2c",
  footerTxtMd: "#6a5a3c",
  emblemGrad: "radial-gradient(circle at 46% 40%,#fbeebc,#eccd7a 52%,#c89238 88%)",
  emblemBlend: "screen" as const,
  emblemOp: 0.13,
  beamGrad: "radial-gradient(ellipse 50% 42% at 50% 50%,rgba(245,222,170,0.13),rgba(214,176,114,0.04) 48%,transparent 72%)",
  topGlowGrad: "radial-gradient(ellipse 60% 55% at 50% 40%,rgba(250,232,180,0.18),rgba(236,205,122,0.05) 46%,transparent 72%)",
  drawerOverlay: DARK_CORE.drawerOverlay,
  pageBg: "transparent",
  headerShadow: "none",
  dropdownBg: DARK_CORE.dropdown,
  modalOverlay: DARK_CORE.modalOverlay,
} as const;

export type DashboardThemeColors = {
  [K in keyof typeof DASHBOARD_DARK]: K extends "emblemOp"
    ? number
    : K extends "emblemBlend"
      ? CSSProperties["mixBlendMode"]
      : string;
};

/** Login page dark tokens */
export const LOGIN_DARK = {
  page: DARK_CORE.page,
  pageGrad:
    "radial-gradient(ellipse 90% 60% at 50% -5%,#1a0e05,transparent 55%)," +
    "radial-gradient(ellipse 60% 45% at 88% 10%,rgba(176,124,52,.08),transparent 55%)," +
    "radial-gradient(ellipse 60% 50% at 8% 92%,rgba(150,106,46,.06),transparent 55%)," +
    DARK_CORE.page,
  text: "#efe6d6",
  sub: "#b89a6a",
  muted: "#9c8d72",
  cardBg: "linear-gradient(160deg,rgba(22,15,8,.95),rgba(12,8,4,.95))",
  cardBorder: "rgba(214,176,114,0.18)",
  cardShadow: "0 48px 96px -48px rgba(0,0,0,.9),0 0 0 1px rgba(214,176,114,.08)",
  inputBg: DARK_CORE.inputBg,
  inputBorder: DARK_CORE.inputBorder,
  inputFocus: DARK_CORE.inputFocusBorder,
  inputText: "#efe6d6",
  inputPlaceholder: DARK_CORE.inputPlaceholder,
  divider: "rgba(214,176,114,0.12)",
  langBg: "rgba(255,255,255,0.04)",
  btnGrad: "linear-gradient(120deg,#6a3f10,#c69049 52%,#8f5c20)",
  btnShadow: "0 16px 40px -16px rgba(198,144,73,.75)",
  orb1: "radial-gradient(circle,rgba(198,144,73,.28),rgba(150,90,20,.1) 60%,transparent)",
  orb2: "radial-gradient(circle,rgba(230,200,130,.18),rgba(176,124,52,.06) 60%,transparent)",
  orb3: "radial-gradient(circle,rgba(176,100,30,.22),rgba(120,70,15,.08) 60%,transparent)",
  starColor: "#f5dca6",
  ringColor: DARK_CORE.ringColor,
  titleGrad: "linear-gradient(180deg,#fff7e6,#f0cf86 50%,#b07a2e)",
} as const;
