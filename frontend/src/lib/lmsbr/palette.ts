import type { ColorPalette } from "@/components/lmsbr/color-palette-ctx";

export const NAVY_BASE = "#070F26";

/** Light mode design tokens */
export const LIGHT_PAGE_BG = "#F3F4F6";
export const LIGHT_CARD_BG = "#FFFFFF";
export const LIGHT_BORDER = "#E5E7EB";
export const LIGHT_SECONDARY_BG = "#F9FAFB";
export const LIGHT_PAGE_GRADIENT = LIGHT_PAGE_BG;

/** Aliases used by modals / forms */
export const LIGHT_DUSTY_PANEL = LIGHT_CARD_BG;
export const LIGHT_DUSTY_SURFACE = LIGHT_SECONDARY_BG;
export const LIGHT_DUSTY_INPUT = LIGHT_CARD_BG;
export const LIGHT_DUSTY_MODAL_BODY = LIGHT_SECONDARY_BG;
export const LIGHT_DUSTY_MODAL_FOOTER = LIGHT_SECONDARY_BG;

export function lightPageBackground() {
  return {
    backgroundColor: LIGHT_PAGE_BG,
    backgroundImage: "none",
  } as const;
}

/** Override warm-brown dark surfaces with navy while keeping gold accents. */
export function withNavyPalette<T extends Record<string, unknown>>(tokens: T): T {
  return {
    ...tokens,
    sidebarBg: "linear-gradient(180deg,#0c1835,#070F26)",
    sidebarBdr: "rgba(214,176,114,0.14)",
    navBg: "linear-gradient(180deg,rgba(10,18,40,0.97),rgba(7,15,38,0.9))",
    navBdr: "rgba(214,176,114,0.12)",
    headerBg: "linear-gradient(180deg,rgba(8,14,32,0.96),rgba(7,15,38,0.80))",
    headerBdr: "rgba(214,176,114,0.10)",
    cardBg: "linear-gradient(160deg,#0c1835,#070F26)",
    cardBdr: "rgba(214,176,114,0.16)",
    panelBg: "linear-gradient(160deg,#0a1429,#070F26)",
    drawerOverlay: "rgba(7,15,38,0.62)",
    beamGrad: "radial-gradient(ellipse 50% 42% at 50% 50%,rgba(198,144,73,0.08),rgba(7,15,38,0.04) 48%,transparent 72%)",
    topGlowGrad: "radial-gradient(ellipse 60% 55% at 50% 40%,rgba(198,144,73,0.10),rgba(7,15,38,0.03) 46%,transparent 72%)",
  };
}

export function applyPalette<T extends Record<string, unknown>>(
  tokens: T,
  palette: ColorPalette,
  isDark: boolean,
): T {
  if (!isDark || palette === "gold") return tokens;
  return withNavyPalette(tokens);
}

export function dashboardBg(palette: ColorPalette, isDark: boolean): string {
  if (!isDark) return LIGHT_PAGE_BG;
  if (palette === "navy") {
    return "radial-gradient(ellipse 80% 52% at 50% -12%,#0f1d3d,transparent 58%),#070F26";
  }
  return "radial-gradient(ellipse 80% 52% at 50% -12%,#130d07,transparent 58%),#070504";
}

export function launcherBarBg(palette: ColorPalette, isDark: boolean): string {
  if (!isDark) return LIGHT_SECONDARY_BG;
  if (palette === "navy") return "linear-gradient(180deg,rgba(10,18,40,0.97),rgba(7,15,38,0.75))";
  return "linear-gradient(180deg,rgba(15,11,7,0.97),rgba(15,11,7,0.75))";
}

export function sidebarSurfaceStyle(isDark: boolean, sidebarBg: string) {
  return { background: sidebarBg } as const;
}

export function loginPageTokens(
  gold: Record<string, string>,
  palette: ColorPalette,
  isDark: boolean,
): Record<string, string> {
  if (!isDark || palette === "gold") return gold;
  return {
    ...gold,
    page: NAVY_BASE,
    pageGrad:
      "radial-gradient(ellipse 90% 60% at 50% -5%,#0f1d3d,transparent 55%)," +
      "radial-gradient(ellipse 60% 45% at 88% 10%,rgba(198,144,73,.06),transparent 55%)," +
      "radial-gradient(ellipse 60% 50% at 8% 92%,rgba(198,144,73,.04),transparent 55%)," +
      NAVY_BASE,
    cardBg: "linear-gradient(160deg,rgba(10,18,40,.95),rgba(7,15,38,.95))",
    orb1: "radial-gradient(circle,rgba(198,144,73,.18),rgba(7,15,38,.1) 60%,transparent)",
    orb2: "radial-gradient(circle,rgba(198,144,73,.10),rgba(7,15,38,.06) 60%,transparent)",
    orb3: "radial-gradient(circle,rgba(15,30,70,.35),rgba(7,15,38,.08) 60%,transparent)",
  };
}
