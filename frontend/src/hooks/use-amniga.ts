"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  amnigaKeys,
  fetchAmnigaAnalytics,
  fetchAmnigaDailyReport,
  fetchAmnigaDistrictProfile,
  fetchAmnigaDistrictTasks,
  fetchAmnigaStats,
  fetchAmnigaUserTrackMap,
  fetchAmnigaUserReports,
} from "@/lib/amniga-api";
import { STALE_LIST_MS, STALE_STATS_MS } from "@/lib/query-config";

export function useAmnigaStatsEnabled(enabled = true) {
  return useQuery({
    queryKey: amnigaKeys.stats,
    queryFn: fetchAmnigaStats,
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useAmnigaAnalytics(range = "7d", enabled = true) {
  return useQuery({
    queryKey: amnigaKeys.analytics(range),
    queryFn: () => fetchAmnigaAnalytics(range),
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useAmnigaDailyReport(
  dateFrom: string,
  district = "",
  dateTo = "",
  enabled = true,
) {
  const end = dateTo || dateFrom;
  return useQuery({
    queryKey: amnigaKeys.dailyReport(dateFrom, end, district),
    queryFn: () => fetchAmnigaDailyReport(dateFrom, district, end),
    staleTime: STALE_STATS_MS,
    enabled: enabled && !!dateFrom,
  });
}

export function useAmnigaDistrictProfile(
  district: string,
  dateFrom: string,
  dateTo = "",
  enabled = true,
) {
  const end = dateTo || dateFrom;
  return useQuery({
    queryKey: amnigaKeys.districtProfile(district, dateFrom, end),
    queryFn: () => fetchAmnigaDistrictProfile(district, dateFrom, end),
    staleTime: STALE_STATS_MS,
    enabled: enabled && !!district && !!dateFrom,
  });
}

export function useAmnigaUserReports(
  params: {
    page: number;
    pageSize: number;
    search?: string;
    county?: string;
    activeOnly?: boolean;
    topUsers?: boolean;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: amnigaKeys.userReports(params as unknown as Record<string, string | number>),
    queryFn: () => fetchAmnigaUserReports(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
    enabled,
  });
}

export function useAmnigaDistrictTasks(
  params: { page: number; pageSize: number; search?: string; dateFrom?: string; dateTo?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: amnigaKeys.districtTasks(params as unknown as Record<string, string | number>),
    queryFn: () => fetchAmnigaDistrictTasks(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
    enabled,
  });
}

export function useAmnigaUserTrackMap(
  params: { userId?: string; hours?: number; search?: string },
  enabled = true,
) {
  const userId = params.userId ?? "";
  const hours = params.hours ?? 0;
  const search = params.search ?? "";
  return useQuery({
    queryKey: amnigaKeys.userTrackMap(userId, hours, search),
    queryFn: () => fetchAmnigaUserTrackMap({ userId, hours, search }),
    staleTime: STALE_LIST_MS,
    enabled,
  });
}
