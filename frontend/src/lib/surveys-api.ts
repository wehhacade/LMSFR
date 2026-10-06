import api from "@/lib/axios";
import type {
  AnalyticsPeriodSummary,
  CompletionBreakdownItem,
  CompletionTrendDay,
  CreateSurveyPayload,
  DailyTrendItem,
  DistrictBreakdownItem,
  HourlyActivityItem,
  PaginatedResponse,
  ResponsesBySurveyItem,
  Survey,
  SurveyDetail,
  SurveyOwnersPage,
  SurveyResponse,
  SurveyResponseDetail,
  SurveyRespondent,
  SurveyRespondentMapPinItem,
  SurveyRespondentMapTrail,
  SurveyRespondentSummary,
  SurveyStats,
  SurveyXlsxImportSummary,
  SubmitSurveyResponsePayload,
  TopRespondentItem,
  UpdateSurveyPayload,
} from "@/types/surveys";

export type { CreateSurveyPayload, UpdateSurveyPayload };

const BASE = "/survey";
export const SURVEY_PAGE_SIZE = 10;

export const surveyKeys = {
  all: ["surveys"] as const,
  list: (page: number, search: string, status: string, pageSize: number = SURVEY_PAGE_SIZE) =>
    ["surveys", "list", page, search, status, pageSize] as const,
  detail: (id: number) => ["surveys", "detail", id] as const,
  stats: ["surveys", "stats"] as const,
  options: ["surveys", "options"] as const,
  analyticsBySurvey: (range: string) =>
    ["surveys", "analytics", "by-survey", range] as const,
  analyticsCompletion: (range: string) =>
    ["surveys", "analytics", "completion", range] as const,
  analyticsTrend: (range: string) =>
    ["surveys", "analytics", "trend", range] as const,
  analyticsPeriodSummary: (range: string, search: string) =>
    ["surveys", "analytics", "period-summary", range, search] as const,
  analyticsHourly: (range: string, search: string) =>
    ["surveys", "analytics", "hourly", range, search] as const,
  analyticsDistrict: (range: string, search: string) =>
    ["surveys", "analytics", "district", range, search] as const,
  analyticsCompletionTrend: (range: string, search: string) =>
    ["surveys", "analytics", "completion-trend", range, search] as const,
  analyticsTopRespondents: (range: string, search: string) =>
    ["surveys", "analytics", "top-respondents", range, search] as const,
  responses: {
    all: ["survey-responses"] as const,
    list: (page: number, search: string, surveyId: string, dateFrom: string, dateTo: string, completionStatus: string, pageSize: number, countyId: string, deadlineStatus: string = "") =>
      ["survey-responses", "list", page, search, surveyId, dateFrom, dateTo, completionStatus, pageSize, countyId, deadlineStatus] as const,
    detail: (id: number) => ["survey-responses", "detail", id] as const,
  },
  owners: {
    all: ["survey-owners"] as const,
    list: (page: number, search: string, surveyId: string, pageSize: number, camera: string, countyId: string, deadlineStatus: string = "") =>
      ["survey-owners", "list", page, search, surveyId, pageSize, camera, countyId, deadlineStatus] as const,
  },
  respondents: {
    all: ["survey-respondents"] as const,
    list: (page: number, search: string, surveyId: string, dateFrom: string, dateTo: string, activityStatus: string) =>
      ["survey-respondents", "list", page, search, surveyId, dateFrom, dateTo, activityStatus] as const,
    summary: (search: string, surveyId: string, dateFrom: string, dateTo: string) =>
      ["survey-respondents", "summary", search, surveyId, dateFrom, dateTo] as const,
    detail: (key: string) => ["survey-respondents", "detail", key] as const,
    activity: (key: string, page: number, pageSize: number, surveyId: string, dateFrom: string, dateTo: string, completionStatus: string) =>
      ["survey-respondents", "activity", key, page, pageSize, surveyId, dateFrom, dateTo, completionStatus] as const,
    map: (search: string, surveyId: string, dateFrom: string, dateTo: string, activityStatus: string) =>
      ["survey-respondents", "map", search, surveyId, dateFrom, dateTo, activityStatus] as const,
  },
};

export interface SurveysParams {
  page: number;
  search: string;
  status?: string;
  pageSize?: number;
}

export interface ResponsesParams {
  page: number;
  search: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  completionStatus?: string;
  pageSize?: number;
  countyId?: string;
  deadlineStatus?: string;
}

export interface OwnersParams {
  page: number;
  search: string;
  surveyId?: string;
  camera?: string;
  countyId?: string;
  pageSize?: number;
  deadlineStatus?: string;
}

export interface RespondentsParams {
  page: number;
  search: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  activityStatus?: string;
}

export interface RespondentActivityParams {
  key: string;
  page: number;
  pageSize?: number;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  completionStatus?: string;
}

export async function fetchSurveys({ page, search, status, pageSize = SURVEY_PAGE_SIZE }: SurveysParams) {
  const { data } = await api.get<PaginatedResponse<Survey>>(
    `${BASE}/surveys/`,
    {
      params: {
        page,
        search: search || undefined,
        status: status || undefined,
        page_size: pageSize,
      },
    },
  );
  return data;
}

export async function fetchSurvey(id: number) {
  const { data } = await api.get<SurveyDetail>(`${BASE}/surveys/${id}/`);
  return data;
}

export async function fetchSurveyStats() {
  const { data } = await api.get<SurveyStats>(`${BASE}/surveys/stats/`);
  return data;
}

export async function fetchSurveyOptions() {
  const { data } = await api.get<{ id: number; name: string }[]>(`${BASE}/surveys/options/`);
  return data;
}

export async function importSurveyXlsx(id: number, file: File, dryRun: boolean) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("dry_run", dryRun ? "true" : "false");
  const { data } = await api.post<SurveyXlsxImportSummary>(
    `${BASE}/surveys/${id}/import-xlsx/`,
    fd,
  );
  return data;
}

export async function createSurvey(payload: CreateSurveyPayload) {
  const { data } = await api.post<SurveyDetail>(`${BASE}/surveys/`, payload);
  return data;
}

export async function updateSurvey(id: number, payload: UpdateSurveyPayload) {
  const { data } = await api.patch<SurveyDetail>(
    `${BASE}/surveys/${id}/`,
    payload,
  );
  return data;
}

export async function fetchResponses({
  page,
  search,
  surveyId,
  dateFrom,
  dateTo,
  completionStatus,
  pageSize = SURVEY_PAGE_SIZE,
  countyId,
  deadlineStatus,
}: ResponsesParams) {
  const { data } = await api.get<PaginatedResponse<SurveyResponse>>(
    `${BASE}/responses/`,
    {
      params: {
        page,
        search: search || undefined,
        survey: surveyId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        completion_status: completionStatus || undefined,
        page_size: pageSize,
        county: countyId || undefined,
        deadline: deadlineStatus || undefined,
      },
    },
  );
  return data;
}

export async function fetchResponse(id: number) {
  const { data } = await api.get<SurveyResponseDetail>(
    `${BASE}/responses/${id}/`,
  );
  return data;
}

export async function deleteSurveyResponse(id: number) {
  await api.delete(`${BASE}/responses/${id}/`);
}

export async function fetchOwners({
  page,
  search,
  surveyId,
  camera,
  countyId,
  pageSize = SURVEY_PAGE_SIZE,
  deadlineStatus,
}: OwnersParams) {
  const { data } = await api.get<SurveyOwnersPage>(
    `${BASE}/responses/owners/`,
    {
      params: {
        page,
        search: search || undefined,
        survey: surveyId || undefined,
        camera: camera || undefined,
        county: countyId || undefined,
        page_size: pageSize,
        deadline: deadlineStatus || undefined,
      },
    },
  );
  return data;
}

export async function fetchRespondents(params: RespondentsParams) {
  const { data } = await api.get<PaginatedResponse<SurveyRespondent>>(
    `${BASE}/respondents/`,
    {
      params: {
        page: params.page,
        search: params.search || undefined,
        survey: params.surveyId || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        activity_status: params.activityStatus || undefined,
        page_size: SURVEY_PAGE_SIZE,
      },
    },
  );
  return data;
}

export async function fetchRespondentSummary(params: {
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { data } = await api.get<SurveyRespondentSummary>(
    `${BASE}/respondents/summary/`,
    {
      params: {
        search: params.search || undefined,
        survey: params.surveyId || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
      },
    },
  );
  return data;
}

export async function fetchRespondent(key: string) {
  const { data } = await api.get<SurveyRespondent>(
    `${BASE}/respondents/${encodeURIComponent(key)}/`,
  );
  return data;
}

export async function fetchRespondentActivity(params: RespondentActivityParams) {
  const { data } = await api.get<PaginatedResponse<SurveyResponse>>(
    `${BASE}/respondents/${encodeURIComponent(params.key)}/activity/`,
    {
      params: {
        page: params.page,
        survey: params.surveyId || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        completion_status: params.completionStatus || undefined,
        page_size: params.pageSize ?? SURVEY_PAGE_SIZE,
      },
    },
  );
  return data;
}

export async function fetchRespondentMap(params: {
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  activityStatus?: string;
}) {
  const { data } = await api.get<SurveyRespondentMapPinItem[]>(
    `${BASE}/respondents/map/`,
    {
      params: {
        search: params.search || undefined,
        survey: params.surveyId || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        activity_status: params.activityStatus || undefined,
      },
    },
  );
  return data;
}

export async function fetchRespondentMapTrail(params: {
  key: string;
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  activityStatus?: string;
}) {
  const { data } = await api.get<SurveyRespondentMapTrail>(
    `${BASE}/respondents/${encodeURIComponent(params.key)}/map-trail/`,
    {
      params: {
        search: params.search || undefined,
        survey: params.surveyId || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        activity_status: params.activityStatus || undefined,
      },
    },
  );
  return data;
}

function hasUploadFiles(payload: SubmitSurveyResponsePayload): boolean {
  return Boolean(
    payload.identity_file ||
    payload.photo ||
    payload.sawirka_guriga ||
    payload.documentiga_guriga,
  );
}

function buildSubmitResponseFormData(payload: SubmitSurveyResponsePayload): FormData {
  const fd = new FormData();
  fd.append("survey", String(payload.survey));
  if (payload.county) fd.append("county", String(payload.county));
  if (payload.sub_county) fd.append("sub_county", String(payload.sub_county));
  if (payload.guri_number) fd.append("guri_number", payload.guri_number);
  if (payload.phone_number) fd.append("phone_number", payload.phone_number);
  if (payload.deadline_days != null && payload.deadline_days > 0) {
    fd.append("deadline_days", String(payload.deadline_days));
  }
  if (payload.latitude) fd.append("latitude", payload.latitude);
  if (payload.longitude) fd.append("longitude", payload.longitude);
  if (payload.context_object) fd.append("context_object", payload.context_object);
  if (payload.context_id) fd.append("context_id", payload.context_id);
  fd.append("answers", JSON.stringify(payload.answers));
  if (payload.identity_file) fd.append("identity_file", payload.identity_file);
  if (payload.photo) fd.append("photo", payload.photo);
  if (payload.sawirka_guriga) fd.append("sawirka_guriga", payload.sawirka_guriga);
  if (payload.documentiga_guriga) fd.append("documentiga_guriga", payload.documentiga_guriga);
  return fd;
}

export async function submitSurveyResponse(payload: SubmitSurveyResponsePayload) {
  if (hasUploadFiles(payload)) {
    const { data } = await api.post<SurveyResponseDetail>(
      `${BASE}/responses/`,
      buildSubmitResponseFormData(payload),
    );
    return data;
  }
  const { data } = await api.post<SurveyResponseDetail>(`${BASE}/responses/`, payload);
  return data;
}

export async function fetchAnalyticsResponsesBySurvey(range: string) {
  const { data } = await api.get<ResponsesBySurveyItem[]>(
    `${BASE}/analytics/responses-by-survey/`,
    { params: { range } },
  );
  return data;
}

export async function fetchAnalyticsCompletionBreakdown(range: string) {
  const { data } = await api.get<CompletionBreakdownItem[]>(
    `${BASE}/analytics/completion-breakdown/`,
    { params: { range } },
  );
  return data;
}

export async function fetchAnalyticsDailyTrend(range: string) {
  const { data } = await api.get<DailyTrendItem[]>(
    `${BASE}/analytics/daily-trend/`,
    { params: { range } },
  );
  return data;
}

function analyticsParams(range: string, search?: string) {
  return { range, search: search || undefined };
}

export async function fetchAnalyticsPeriodSummary(range: string, search?: string) {
  const { data } = await api.get<AnalyticsPeriodSummary>(
    `${BASE}/analytics/period-summary/`,
    { params: analyticsParams(range, search) },
  );
  return data;
}

export async function fetchAnalyticsHourlyActivity(range: string, search?: string) {
  const { data } = await api.get<HourlyActivityItem[]>(
    `${BASE}/analytics/hourly-activity/`,
    { params: analyticsParams(range, search) },
  );
  return data;
}

export async function fetchAnalyticsByDistrict(range: string, search?: string) {
  const { data } = await api.get<DistrictBreakdownItem[]>(
    `${BASE}/analytics/by-district/`,
    { params: analyticsParams(range, search) },
  );
  return data;
}

export async function fetchAnalyticsCompletionTrend(range: string, search?: string) {
  const { data } = await api.get<CompletionTrendDay[]>(
    `${BASE}/analytics/completion-trend/`,
    { params: analyticsParams(range, search) },
  );
  return data;
}

export async function fetchAnalyticsTopRespondents(range: string, search?: string) {
  const { data } = await api.get<TopRespondentItem[]>(
    `${BASE}/analytics/top-respondents/`,
    { params: analyticsParams(range, search) },
  );
  return data;
}
