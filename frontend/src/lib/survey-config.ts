import type { Lang, MenuItem } from "./lmsbr/data";
import type { ModuleNavSnapshot } from "./lmsbr/module-nav-persist";

export const SURVEY_ACCENT = "#3fd0b5";
export const SURVEY_GRAD = "linear-gradient(135deg,#46e0c2,#157d6e)";
export const SURVEY_GLOW = "rgba(63,208,181,.4)";

export type SurveyMenuItem = MenuItem & { badge?: string };

/** Current survey sidebar menu ids. */
export const SURVEY_MENU_IDS = new Set([
  "dashboard", "surveys", "responses", "owners", "surveyanalytics", "settings",
]);

/** Map pre-Pulse menu ids (cookie/localStorage) to the current structure. */
const SURVEY_MENU_ALIASES: Record<string, string> = {
  all: "surveys",
  create: "surveys",
  templates: "surveys",
  submissions: "responses",
  distribution: "settings",
  analytics: "surveyanalytics",
};

export function normalizeSurveyMenu(menu: string): string {
  if (SURVEY_MENU_IDS.has(menu)) return menu;
  return SURVEY_MENU_ALIASES[menu] ?? "dashboard";
}

export function normalizeSurveyNav(snap: ModuleNavSnapshot): ModuleNavSnapshot {
  const activeMenu = normalizeSurveyMenu(snap.activeMenu);
  return activeMenu === snap.activeMenu ? snap : { ...snap, activeMenu };
}

export function getSurveyMenu(L: Lang, stats?: { totalSurveys?: number; totalResponses?: number }): SurveyMenuItem[] {
  const so = L === "so";
  const surveyBadge = stats?.totalSurveys != null && stats.totalSurveys > 0
    ? String(stats.totalSurveys)
    : undefined;
  const responseBadge = stats?.totalResponses != null && stats.totalResponses > 0
    ? stats.totalResponses >= 1000
      ? `${(stats.totalResponses / 1000).toFixed(1)}k`
      : String(stats.totalResponses)
    : undefined;
  return [
    { id: "dashboard", icon: "grid", label: so ? "Bogga Hore" : "Dashboard" },
    { id: "surveys", icon: "clipboard", label: so ? "Sahaminta" : "Surveys", badge: surveyBadge },
    { id: "responses", icon: "check", label: so ? "Jawaabaha" : "Responses", badge: responseBadge },
    { id: "owners", icon: "users", label: so ? "Milkiilayaasha" : "Owners" },
    { id: "surveyanalytics", icon: "chart", label: so ? "Falanqayn" : "Analytics" },
    { id: "settings", icon: "users", label: so ? "Ka jawaabayaasha" : "Respondents" },
  ];
}
