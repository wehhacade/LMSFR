"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createSurvey,
  deleteSurveyResponse,
  fetchAnalyticsCompletionBreakdown,
  fetchAnalyticsCompletionTrend,
  fetchAnalyticsByDistrict,
  fetchAnalyticsDailyTrend,
  fetchAnalyticsHourlyActivity,
  fetchAnalyticsPeriodSummary,
  fetchAnalyticsResponsesBySurvey,
  fetchAnalyticsTopRespondents,
  fetchOwners,
  fetchRespondent,
  fetchRespondentActivity,
  fetchRespondentMap,
  fetchRespondentMapTrail,
  fetchRespondentSummary,
  fetchRespondents,
  fetchResponse,
  fetchResponses,
  fetchSurvey,
  fetchSurveys,
  fetchSurveyOptions,
  fetchSurveyStats,
  submitSurveyResponse,
  SURVEY_PAGE_SIZE,
  surveyKeys,
  updateSurvey,
  type CreateSurveyPayload,
  type OwnersParams,
  type RespondentActivityParams,
  type RespondentsParams,
  type ResponsesParams,
  type SurveysParams,
  type UpdateSurveyPayload,
} from "@/lib/surveys-api";
import type { SubmitSurveyResponsePayload } from "@/types/surveys";
import { toast } from "@/components/ui/use-toast";
import {
  STALE_LIST_MS,
  STALE_LOOKUP_MS,
  STALE_STATS_MS,
} from "@/lib/query-config";

export function useSurveys(params: SurveysParams) {
  return useQuery({
    queryKey: surveyKeys.list(params.page, params.search, params.status ?? "", params.pageSize ?? SURVEY_PAGE_SIZE),
    queryFn: () => fetchSurveys(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSurvey(id: number | null) {
  return useQuery({
    queryKey: surveyKeys.detail(id ?? 0),
    queryFn: () => fetchSurvey(id!),
    enabled: id !== null && id > 0,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useSurveyStats() {
  return useQuery({
    queryKey: surveyKeys.stats,
    queryFn: fetchSurveyStats,
    staleTime: STALE_STATS_MS,
  });
}

export function useSurveyOptions() {
  return useQuery({
    queryKey: surveyKeys.options,
    queryFn: fetchSurveyOptions,
    staleTime: STALE_STATS_MS,
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSurveyPayload) => createSurvey(payload),
    onSuccess: (data) => {
      if (data?.id) qc.setQueryData(surveyKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: surveyKeys.all });
      toast({ title: "Survey created" });
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });
}

export function useUpdateSurvey(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSurveyPayload) => updateSurvey(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(surveyKeys.detail(id), data);
      void qc.invalidateQueries({ queryKey: surveyKeys.all });
      toast({ title: "Survey updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
}

export function useSubmitSurveyResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitSurveyResponsePayload) => submitSurveyResponse(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: surveyKeys.responses.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.owners.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.respondents.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.stats });
      void qc.invalidateQueries({ queryKey: surveyKeys.all });
      toast({ title: "Response submitted" });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: Record<string, unknown> } };
      const answers = e?.response?.data?.answers;
      if (Array.isArray(answers) && answers.length > 0) {
        toast({ title: String(answers[0]), variant: "destructive" });
        return;
      }
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        toast({ title: detail, variant: "destructive" });
        return;
      }
      toast({ title: "Submission failed", variant: "destructive" });
    },
  });
}

export function useDeleteSurveyResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSurveyResponse(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: surveyKeys.responses.detail(id) });
      void qc.invalidateQueries({ queryKey: surveyKeys.responses.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.owners.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.respondents.all });
      void qc.invalidateQueries({ queryKey: surveyKeys.stats });
      void qc.invalidateQueries({ queryKey: surveyKeys.all });
      toast({ title: "Response deleted" });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      toast({
        title: "Delete failed",
        description:
          e.response?.data?.message
          ?? e.response?.data?.detail
          ?? "You do not have permission to delete this response.",
        variant: "destructive",
      });
    },
  });
}

export function useSurveyResponses(params: ResponsesParams) {
  return useQuery({
    queryKey: surveyKeys.responses.list(
      params.page,
      params.search,
      params.surveyId ?? "",
      params.dateFrom ?? "",
      params.dateTo ?? "",
      params.completionStatus ?? "",
      params.pageSize ?? SURVEY_PAGE_SIZE,
      params.countyId ?? "",
      params.deadlineStatus ?? "",
    ),
    queryFn: () => fetchResponses(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSurveyResponse(id: number | null) {
  return useQuery({
    queryKey: surveyKeys.responses.detail(id ?? 0),
    queryFn: () => fetchResponse(id!),
    enabled: id !== null && id > 0,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useSurveyOwners(params: OwnersParams) {
  return useQuery({
    queryKey: surveyKeys.owners.list(
      params.page,
      params.search,
      params.surveyId ?? "",
      params.pageSize ?? SURVEY_PAGE_SIZE,
      params.camera ?? "",
      params.countyId ?? "",
      params.deadlineStatus ?? "",
    ),
    queryFn: () => fetchOwners(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSurveyRespondents(params: RespondentsParams) {
  return useQuery({
    queryKey: surveyKeys.respondents.list(
      params.page,
      params.search,
      params.surveyId ?? "",
      params.dateFrom ?? "",
      params.dateTo ?? "",
      params.activityStatus ?? "",
    ),
    queryFn: () => fetchRespondents(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSurveyRespondentSummary(params: {
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: surveyKeys.respondents.summary(
      params.search ?? "",
      params.surveyId ?? "",
      params.dateFrom ?? "",
      params.dateTo ?? "",
    ),
    queryFn: () => fetchRespondentSummary(params),
    staleTime: STALE_STATS_MS,
  });
}

export function useSurveyRespondent(key: string | null) {
  return useQuery({
    queryKey: surveyKeys.respondents.detail(key ?? ""),
    queryFn: () => fetchRespondent(key!),
    enabled: !!key,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useSurveyRespondentActivity(params: RespondentActivityParams | null) {
  return useQuery({
    queryKey: params
      ? surveyKeys.respondents.activity(
          params.key,
          params.page,
          params.pageSize ?? SURVEY_PAGE_SIZE,
          params.surveyId ?? "",
          params.dateFrom ?? "",
          params.dateTo ?? "",
          params.completionStatus ?? "",
        )
      : ["survey-respondents", "activity", "idle"],
    queryFn: () => fetchRespondentActivity(params!),
    enabled: !!params?.key,
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSurveyRespondentMap(params: {
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  activityStatus?: string;
}) {
  return useQuery({
    queryKey: surveyKeys.respondents.map(
      params.search ?? "",
      params.surveyId ?? "",
      params.dateFrom ?? "",
      params.dateTo ?? "",
      params.activityStatus ?? "",
    ),
    queryFn: () => fetchRespondentMap(params),
    staleTime: STALE_LIST_MS,
  });
}

export function useSurveyRespondentMapTrail(params: {
  key: string | null;
  search?: string;
  surveyId?: string;
  dateFrom?: string;
  dateTo?: string;
  activityStatus?: string;
}) {
  return useQuery({
    queryKey: params.key
      ? [
          "survey-respondents",
          "map-trail",
          params.key,
          params.search ?? "",
          params.surveyId ?? "",
          params.dateFrom ?? "",
          params.dateTo ?? "",
          params.activityStatus ?? "",
        ]
      : ["survey-respondents", "map-trail", "idle"],
    queryFn: () =>
      fetchRespondentMapTrail({
        key: params.key!,
        search: params.search,
        surveyId: params.surveyId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        activityStatus: params.activityStatus,
      }),
    enabled: !!params.key,
    staleTime: STALE_LIST_MS,
  });
}

export function useAnalyticsResponsesBySurvey(range: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsBySurvey(range),
    queryFn: () => fetchAnalyticsResponsesBySurvey(range),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsCompletionBreakdown(range: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsCompletion(range),
    queryFn: () => fetchAnalyticsCompletionBreakdown(range),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsDailyTrend(range: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsTrend(range),
    queryFn: () => fetchAnalyticsDailyTrend(range),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsPeriodSummary(range: string, search?: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsPeriodSummary(range, search ?? ""),
    queryFn: () => fetchAnalyticsPeriodSummary(range, search),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsHourlyActivity(range: string, search?: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsHourly(range, search ?? ""),
    queryFn: () => fetchAnalyticsHourlyActivity(range, search),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsByDistrict(range: string, search?: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsDistrict(range, search ?? ""),
    queryFn: () => fetchAnalyticsByDistrict(range, search),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsCompletionTrend(range: string, search?: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsCompletionTrend(range, search ?? ""),
    queryFn: () => fetchAnalyticsCompletionTrend(range, search),
    staleTime: STALE_STATS_MS,
  });
}

export function useAnalyticsTopRespondents(range: string, search?: string) {
  return useQuery({
    queryKey: surveyKeys.analyticsTopRespondents(range, search ?? ""),
    queryFn: () => fetchAnalyticsTopRespondents(range, search),
    staleTime: STALE_STATS_MS,
  });
}
