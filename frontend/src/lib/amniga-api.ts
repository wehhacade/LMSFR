import api from "@/lib/axios";
import type {
  AmnigaAnalytics,
  AmnigaDailyReport,
  AmnigaDistrictProfile,
  AmnigaDistrictTasks,
  AmnigaStats,
  AmnigaUserTrackMap,
  AmnigaUserReports,
} from "@/types/amniga";

const BASE = "/amniga";

export const amnigaKeys = {
  all: ["amniga"] as const,
  stats: ["amniga", "stats"] as const,
  analytics: (range: string) => ["amniga", "analytics", range] as const,
  dailyReport: (dateFrom: string, dateTo: string, district: string) =>
    ["amniga", "daily-report", dateFrom, dateTo, district] as const,
  districtProfile: (district: string, dateFrom: string, dateTo: string) =>
    ["amniga", "district-profile", district, dateFrom, dateTo] as const,
  userReports: (params: Record<string, string | number>) =>
    ["amniga", "user-reports", params] as const,
  districtTasks: (params: Record<string, string | number>) =>
    ["amniga", "district-tasks", params] as const,
  userTrackMap: (userId: string, hours: number, search = "") =>
    ["amniga", "user-track-map", userId, hours, search] as const,
};

export async function fetchAmnigaStats() {
  const { data } = await api.get<AmnigaStats>(`${BASE}/stats/`);
  return data;
}

export async function fetchAmnigaAnalytics(range = "7d") {
  const { data } = await api.get<AmnigaAnalytics>(`${BASE}/analytics/`, {
    params: { range },
  });
  return data;
}

export async function fetchAmnigaDailyReport(
  dateFrom: string,
  district = "",
  dateTo = "",
) {
  const end = dateTo || dateFrom;
  const { data } = await api.get<AmnigaDailyReport>(`${BASE}/daily-report/`, {
    params: {
      date_from: dateFrom,
      date_to: end,
      ...(dateFrom === end ? { date: dateFrom } : {}),
      ...(district ? { district } : {}),
    },
  });
  return data;
}

export async function fetchAmnigaDistrictProfile(
  district: string,
  dateFrom: string,
  dateTo = "",
) {
  const end = dateTo || dateFrom;
  const { data } = await api.get<AmnigaDistrictProfile>(`${BASE}/daily-report/district-profile/`, {
    params: {
      district,
      date_from: dateFrom,
      date_to: end,
      ...(dateFrom === end ? { date: dateFrom } : {}),
    },
  });
  return data;
}

export async function fetchAmnigaUserReports(params: {
  page: number;
  pageSize: number;
  search?: string;
  county?: string;
  activeOnly?: boolean;
  topUsers?: boolean;
}) {
  const { data } = await api.get<AmnigaUserReports>(`${BASE}/user-reports/`, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      search: params.search || undefined,
      county: params.county || undefined,
      active_only: params.activeOnly ? "true" : undefined,
      top_users: params.topUsers ? "true" : undefined,
    },
  });
  return data;
}

export async function fetchAmnigaDistrictTasks(params: {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { data } = await api.get<AmnigaDistrictTasks>(`${BASE}/district-tasks/`, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      search: params.search || undefined,
      date_from: params.dateFrom || undefined,
      date_to: params.dateTo || undefined,
    },
  });
  return data;
}

export async function fetchAmnigaUserTrackMap(params: {
  userId?: string;
  hours?: number;
  search?: string;
}) {
  const { data } = await api.get<AmnigaUserTrackMap>(`${BASE}/user-track-map/`, {
    params: {
      user_id: params.userId || undefined,
      hours: params.hours ?? 0,
      search: params.search || undefined,
    },
  });
  return data;
}
