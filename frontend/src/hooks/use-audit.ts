"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  auditKeys,
  deleteErrorLog,
  fetchAPITraffic,
  fetchAuditStats,
  fetchAuditTrails,
  fetchAuditTrail,
  fetchErrorLog,
  fetchErrorLogs,
  AUDIT_PAGE_SIZE,
} from "@/lib/audit-api";
import { STALE_LIST_MS } from "@/lib/query-config";
import { toast } from "@/components/ui/use-toast";

export function useAuditStats() {
  return useQuery({
    queryKey: auditKeys.stats,
    queryFn: fetchAuditStats,
    staleTime: STALE_LIST_MS,
  });
}

export function useAuditTrails(page: number, search: string, today = false, eventType = "", pageSize = AUDIT_PAGE_SIZE) {
  return useQuery({
    queryKey: auditKeys.trails(page, search, today, eventType, pageSize),
    queryFn: () => fetchAuditTrails(page, search, today, eventType, pageSize),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useAuditTrail(id: string | null) {
  return useQuery({
    queryKey: auditKeys.trail(id ?? ""),
    queryFn: () => fetchAuditTrail(id!),
    enabled: !!id,
  });
}

export function useErrorLogs(page: number, search: string, today = false, pageSize = AUDIT_PAGE_SIZE) {
  return useQuery({
    queryKey: auditKeys.errors(page, search, today, pageSize),
    queryFn: () => fetchErrorLogs(page, search, today, pageSize),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useErrorLog(id: string | null) {
  return useQuery({
    queryKey: auditKeys.error(id ?? ""),
    queryFn: () => fetchErrorLog(id!),
    enabled: !!id,
  });
}

export function useDeleteErrorLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteErrorLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all });
      toast({ title: "Error log deleted" });
    },
  });
}

export function useAPITraffic(page: number, path: string, pageSize = AUDIT_PAGE_SIZE) {
  return useQuery({
    queryKey: auditKeys.traffic(page, path, pageSize),
    queryFn: () => fetchAPITraffic(page, path, pageSize),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
