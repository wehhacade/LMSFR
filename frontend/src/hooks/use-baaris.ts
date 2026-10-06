"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  baarisKeys,
  createWanted,
  deleteWanted,
  fetchBaarisAnalytics,
  fetchBaarisCitizenDetail,
  fetchBaarisCitizens,
  fetchBaarisStats,
  fetchWantedList,
  fetchWantedTypes,
  BAARIS_PAGE_SIZE,
} from "@/lib/baaris-api";
import { STALE_LIST_MS, STALE_STATS_MS } from "@/lib/query-config";

export function useBaarisStats(enabled = true) {
  return useQuery({
    queryKey: baarisKeys.stats,
    queryFn: fetchBaarisStats,
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useBaarisAnalytics(range = "7d", enabled = true) {
  return useQuery({
    queryKey: baarisKeys.analytics(range),
    queryFn: () => fetchBaarisAnalytics(range),
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useBaarisCitizens(
  params: { page: number; search?: string; county?: string; pageSize?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: baarisKeys.citizens(params.page, params.search ?? "", params.county ?? "", params.pageSize ?? BAARIS_PAGE_SIZE),
    queryFn: () => fetchBaarisCitizens(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
    enabled,
  });
}

export function useBaarisCitizenDetail(id: number | null, enabled = true) {
  return useQuery({
    queryKey: baarisKeys.citizen(id ?? 0),
    queryFn: () => fetchBaarisCitizenDetail(id!),
    enabled: enabled && id != null,
  });
}

export function useWantedList(params: { page: number; search?: string; pageSize?: number }, enabled = true) {
  return useQuery({
    queryKey: baarisKeys.wanted(params.page, params.search ?? "", params.pageSize ?? BAARIS_PAGE_SIZE),
    queryFn: () => fetchWantedList(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
    enabled,
  });
}

export function useWantedTypes(enabled = true) {
  return useQuery({
    queryKey: baarisKeys.wantedTypes,
    queryFn: fetchWantedTypes,
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useCreateWanted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWanted,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: baarisKeys.all });
    },
  });
}

export function useDeleteWanted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWanted,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: baarisKeys.all });
    },
  });
}
