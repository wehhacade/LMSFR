"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { STALE_LIST_MS, STALE_LOOKUP_MS, STALE_STATS_MS } from "@/lib/query-config";
import { fetchForceDistricts, fetchForces, fetchForceStats, FORCES_PAGE_SIZE, type ForcesParams } from "@/lib/forces-api";

export function useForces(params: ForcesParams) {
  return useQuery({
    queryKey: ["forces", params.page, params.search, params.district, params.pageSize ?? FORCES_PAGE_SIZE],
    queryFn:  () => fetchForces(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useForceStats() {
  return useQuery({
    queryKey: ["force-stats"],
    queryFn:  fetchForceStats,
    staleTime: STALE_STATS_MS,
  });
}

export function useForceDistricts() {
  return useQuery({
    queryKey: ["force-districts"],
    queryFn:  fetchForceDistricts,
    staleTime: STALE_LOOKUP_MS,
  });
}
