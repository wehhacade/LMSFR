import type { SurveyStatus, TimeRange } from "@/types/surveys";

const STORAGE_KEY = "lmsbr-survey-module-settings";

export interface SurveyModuleSettings {
  defaultStatus: SurveyStatus;
  defaultAllowMultiple: boolean;
  requirePhone: boolean;
  requireGuriNumber: boolean;
  requireLocation: boolean;
  requireIdentityPhoto: boolean;
  requireRespondentPhoto: boolean;
  allowAnonymousSubmit: boolean;
  showPublicSubmitLink: boolean;
  defaultAnalyticsRange: TimeRange;
}

export const DEFAULT_SURVEY_MODULE_SETTINGS: SurveyModuleSettings = {
  defaultStatus: "draft",
  defaultAllowMultiple: false,
  requirePhone: true,
  requireGuriNumber: false,
  requireLocation: true,
  requireIdentityPhoto: false,
  requireRespondentPhoto: false,
  allowAnonymousSubmit: true,
  showPublicSubmitLink: true,
  defaultAnalyticsRange: "90d",
};

export function loadSurveyModuleSettings(): SurveyModuleSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SURVEY_MODULE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SURVEY_MODULE_SETTINGS };
    return { ...DEFAULT_SURVEY_MODULE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SURVEY_MODULE_SETTINGS };
  }
}

export function saveSurveyModuleSettings(settings: SurveyModuleSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
