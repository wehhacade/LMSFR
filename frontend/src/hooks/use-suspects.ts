"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSuspect,
  createSuspectComment,
  deleteSuspect,
  fetchSuspect,
  fetchSuspectCases,
  fetchSuspectComments,
  fetchSuspectDistricts,
  fetchSuspectGuarantors,
  fetchSuspects,
  fetchSuspectStats,
  fetchSuspectTypes,
  releaseSuspect,
  suspectKeys,
  updateDamiinPhotos,
  updateSuspect,
  PAGE_SIZE,
  type CreateSuspectPayload,
  type SuspectsParams,
  type UpdateSuspectPayload,
} from "@/lib/suspects-api";
import { toast } from "@/components/ui/use-toast";
import { STALE_LIST_MS, STALE_LOOKUP_MS, STALE_STATS_MS } from "@/lib/query-config";
import type { SuspectCommentKind } from "@/types/suspect";

function filtersKey(params: Pick<SuspectsParams, "county" | "suspect_type" | "period">) {
  return {
    county: params.county ?? "",
    suspect_type: params.suspect_type ?? "",
    period: params.period ?? "",
  };
}

export function useSuspects(params: SuspectsParams) {
  return useQuery({
    queryKey: suspectKeys.list(params.page, params.search, filtersKey(params), params.pageSize ?? PAGE_SIZE),
    queryFn: () => fetchSuspects(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useSuspect(id: number | null) {
  return useQuery({
    queryKey: suspectKeys.detail(id ?? 0),
    queryFn: () => fetchSuspect(id!),
    enabled: id !== null,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useSuspectStats() {
  return useQuery({
    queryKey: suspectKeys.stats,
    queryFn: fetchSuspectStats,
    staleTime: STALE_STATS_MS,
  });
}

export function useSuspectDistricts() {
  return useQuery({
    queryKey: suspectKeys.districts,
    queryFn: fetchSuspectDistricts,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useSuspectTypes() {
  return useQuery({
    queryKey: suspectKeys.types,
    queryFn: fetchSuspectTypes,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useCreateSuspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pictureFile, ...payload }: CreateSuspectPayload & { pictureFile?: File }) =>
      createSuspect(payload, pictureFile),
    onSuccess: (data) => {
      if (data?.id) {
        qc.setQueryData(suspectKeys.detail(data.id), data);
      }
      void qc.invalidateQueries({ queryKey: suspectKeys.all });
      toast({ title: "Suspect created" });
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });
}

export function useUpdateSuspect(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pictureFile, ...payload }: UpdateSuspectPayload & { pictureFile?: File }) =>
      updateSuspect(id, payload, pictureFile),
    onSuccess: async () => {
      try {
        const fresh = await fetchSuspect(id);
        qc.setQueryData(suspectKeys.detail(id), fresh);
      } catch {
        void qc.invalidateQueries({ queryKey: suspectKeys.detail(id) });
      }
      void qc.invalidateQueries({ queryKey: suspectKeys.all });
      toast({ title: "Suspect updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
}

export function useDeleteSuspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSuspect(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suspectKeys.all });
      toast({ title: "Suspect deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });
}

export function useSuspectCases(id: number | null, enabled = true) {
  return useQuery({
    queryKey: suspectKeys.cases(id ?? 0),
    queryFn: () => fetchSuspectCases(id!),
    enabled: id !== null && enabled,
    staleTime: 120_000,
  });
}

export function useSuspectGuarantors(id: number | null, enabled = true) {
  return useQuery({
    queryKey: suspectKeys.guarantors(id ?? 0),
    queryFn: () => fetchSuspectGuarantors(id!),
    enabled: id !== null && enabled,
    staleTime: 120_000,
  });
}

export function useUpdateDamiinPhotos(suspectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      damiinId,
      picture,
      identity_picture,
    }: {
      damiinId: number;
      picture?: File;
      identity_picture?: File;
    }) => updateDamiinPhotos(damiinId, { picture, identity_picture }, suspectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suspectKeys.guarantors(suspectId) });
    },
  });
}

export function useSuspectComments(id: number | null, enabled = true) {
  return useQuery({
    queryKey: suspectKeys.comments(id ?? 0),
    queryFn: () => fetchSuspectComments(id!),
    enabled: id !== null && enabled,
    staleTime: 60_000,
  });
}

export function useReleaseSuspect(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => releaseSuspect(id),
    onSuccess: (data) => {
      qc.setQueryData(suspectKeys.detail(id), data);
      void qc.invalidateQueries({ queryKey: suspectKeys.all });
      toast({ title: "Suspect status updated" });
    },
    onError: () => toast({ title: "Release failed", variant: "destructive" }),
  });
}

export function useCreateSuspectComment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; kind?: SuspectCommentKind; target_id?: number | null }) =>
      createSuspectComment(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suspectKeys.comments(id) });
    },
  });
}
