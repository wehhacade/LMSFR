"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVisitor,
  deleteVisitor,
  fetchVisitAllegations,
  fetchVisitDestinations,
  fetchVisitor,
  fetchVisitors,
  fetchVisitorsAnalytics,
  fetchVisitorsStats,
  updateVisitor,
  visitorsKeys,
  VISITORS_PAGE_SIZE,
  type VisitorsListParams,
} from "@/lib/visitors-api";
import type { VisitorWritePayload } from "@/types/visitors";
import { toast } from "@/components/ui/use-toast";
import { STALE_LIST_MS, STALE_LOOKUP_MS, STALE_STATS_MS } from "@/lib/query-config";

function filtersKey(params: VisitorsListParams) {
  return {
    verified: params.verified ?? "",
    date_from: params.date_from ?? "",
    date_to: params.date_to ?? "",
  };
}

export function useVisitors(params: VisitorsListParams) {
  return useQuery({
    queryKey: visitorsKeys.list(
      params.page,
      params.search ?? "",
      filtersKey(params),
      params.pageSize ?? VISITORS_PAGE_SIZE,
    ),
    queryFn: () => fetchVisitors(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useVisitor(id: number | null) {
  return useQuery({
    queryKey: visitorsKeys.detail(id ?? 0),
    queryFn: () => fetchVisitor(id!),
    enabled: id !== null,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useVisitDestinations(enabled = true) {
  return useQuery({
    queryKey: visitorsKeys.destinations,
    queryFn: fetchVisitDestinations,
    enabled,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useVisitAllegations(enabled = true) {
  return useQuery({
    queryKey: visitorsKeys.allegations,
    queryFn: fetchVisitAllegations,
    enabled,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useVisitorsStats(enabled = true) {
  return useQuery({
    queryKey: visitorsKeys.stats,
    queryFn: fetchVisitorsStats,
    enabled,
    staleTime: STALE_STATS_MS,
  });
}

export function useVisitorsAnalytics(range = "7d", date?: string, enabled = true) {
  return useQuery({
    queryKey: visitorsKeys.analytics(range, date),
    queryFn: () => fetchVisitorsAnalytics(range, date),
    enabled,
    staleTime: STALE_STATS_MS,
  });
}

export function useCreateVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createVisitor,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: visitorsKeys.all });
      const returning = !!(data as { is_returning?: boolean; visit_count?: number })?.is_returning
        || ((data as { visit_count?: number })?.visit_count ?? 0) > 1;
      toast({
        title: returning ? "Wuu soo booqday — visit cusub waa la kaydiyay" : "Visitor saved",
      });
    },
    onError: () => toast({ title: "Could not save visitor", variant: "destructive" }),
  });
}

export function useUpdateVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: VisitorWritePayload }) =>
      updateVisitor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: visitorsKeys.all });
      toast({ title: "Visitor updated" });
    },
    onError: () => toast({ title: "Could not update visitor", variant: "destructive" }),
  });
}

export function useDeleteVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteVisitor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: visitorsKeys.all });
      toast({ title: "Visitor deleted" });
    },
    onError: () => toast({ title: "Could not delete visitor", variant: "destructive" }),
  });
}
