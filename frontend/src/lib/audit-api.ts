import api from "@/lib/axios";
import type {
  APITrafficItem,
  AuditStats,
  AuditTrail,
  ErrorLogDetail,
  ErrorLogItem,
  PaginatedResponse,
} from "@/types/audit";

export const AUDIT_PAGE_SIZE = 10;

export const auditKeys = {
  all: ["audit"] as const,
  trails: (page: number, search: string, today: boolean, eventType: string, pageSize: number = AUDIT_PAGE_SIZE) =>
    ["audit", "trails", page, search, today, eventType, pageSize] as const,
  trail: (id: string) => ["audit", "trail", id] as const,
  errors: (page: number, search: string, today: boolean, pageSize: number = AUDIT_PAGE_SIZE) =>
    ["audit", "errors", page, search, today, pageSize] as const,
  error: (id: string) => ["audit", "error", id] as const,
  traffic: (page: number, path: string, pageSize: number = AUDIT_PAGE_SIZE) =>
    ["audit", "traffic", page, path, pageSize] as const,
  stats: ["audit", "stats"] as const,
};

export async function fetchAuditTrails(
  page: number,
  search: string,
  today = false,
  eventType = "",
  pageSize = AUDIT_PAGE_SIZE,
) {
  const { data } = await api.get<PaginatedResponse<AuditTrail>>("/audit-trails/", {
    params: {
      page,
      search: search || undefined,
      today: today ? "true" : undefined,
      event_type: eventType || undefined,
      page_size: pageSize,
    },
  });
  return data;
}

export async function fetchAuditTrail(id: string) {
  const { data } = await api.get<AuditTrail>(`/audit-trails/${id}/`);
  return data;
}

export async function fetchErrorLogs(page: number, search: string, today = false, pageSize = AUDIT_PAGE_SIZE) {
  const { data } = await api.get<PaginatedResponse<ErrorLogItem>>("/error-logs/", {
    params: { page, search: search || undefined, today: today ? "true" : undefined, page_size: pageSize },
  });
  return data;
}

export async function fetchErrorLog(id: string) {
  const { data } = await api.get<ErrorLogDetail>(`/error-logs/${id}/`);
  return data;
}

export async function deleteErrorLog(id: string) {
  await api.delete(`/error-logs/${id}/`);
}

export async function fetchAPITraffic(page: number, path = "", pageSize = AUDIT_PAGE_SIZE) {
  const { data } = await api.get<PaginatedResponse<APITrafficItem>>("/api-traffic/", {
    params: { page, path: path || undefined, page_size: pageSize },
  });
  return data;
}

export async function fetchAuditStats() {
  const { data } = await api.get<AuditStats>("/audit-stats/");
  return data;
}
