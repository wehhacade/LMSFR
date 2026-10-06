"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDisarmamentRecord,
  deleteDisarmamentImage,
  deleteDisarmamentRecord,
  fetchDisarmamentRecord,
  fetchDisarmamentRecords,
  fetchDisarmamentStats,
  fetchDisarmamentGalleryImages,
  fetchHubkadhigisAnalytics,
  fetchPersonHistory,
  fetchHubkadhigisLookups,
  hubkadhigisKeys,
  updateDisarmamentRecord,
  uploadDisarmamentImage,
  PAGE_SIZE,
  GALLERY_PAGE_SIZE,
  type HubkadhigisParams,
} from "@/lib/hubkadhigis-api";
import type { CreateDisarmamentPayload, DisarmamentDetail, UpdateDisarmamentPayload } from "@/types/hubkadhigis";
import { toast } from "@/components/ui/use-toast";
import { STALE_LIST_MS, STALE_LOOKUP_MS, STALE_STATS_MS } from "@/lib/query-config";

function filtersKey(params: Pick<HubkadhigisParams, "county" | "weapon_type" | "force_unit" | "has_images" | "status">) {
  return {
    county: params.county ?? "",
    weapon_type: params.weapon_type ?? "",
    force_unit: params.force_unit ?? "",
    has_images: params.has_images ? "1" : "",
    status: params.status ?? "",
  };
}

export function useDisarmamentRecords(params: HubkadhigisParams) {
  return useQuery({
    queryKey: hubkadhigisKeys.list(params.page, params.search, filtersKey(params), params.pageSize ?? PAGE_SIZE),
    queryFn: () => fetchDisarmamentRecords(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useDisarmamentRecord(id: number | null) {
  return useQuery({
    queryKey: hubkadhigisKeys.detail(id ?? 0),
    queryFn: () => fetchDisarmamentRecord(id!),
    enabled: id !== null,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useDisarmamentStats() {
  return useQuery({
    queryKey: hubkadhigisKeys.stats,
    queryFn: fetchDisarmamentStats,
    staleTime: STALE_STATS_MS,
  });
}

export function useHubkadhigisAnalytics() {
  return useQuery({
    queryKey: hubkadhigisKeys.analytics,
    queryFn: fetchHubkadhigisAnalytics,
    staleTime: STALE_STATS_MS,
  });
}

export function useHubkadhigisLookups() {
  return useQuery({
    queryKey: hubkadhigisKeys.lookups,
    queryFn: fetchHubkadhigisLookups,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useDisarmamentGalleryImages(page: number, search = "", pageSize = GALLERY_PAGE_SIZE) {
  return useQuery({
    queryKey: hubkadhigisKeys.galleryImages(page, search, pageSize),
    queryFn: () => fetchDisarmamentGalleryImages(page, search, pageSize),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function usePersonHistory(record: DisarmamentDetail | null | undefined) {
  const phone = record?.phone_number?.trim() ?? "";
  const name = record?.person_name?.trim() ?? "";
  const query = phone || name;
  const mode = phone ? "phone" : "name";
  return useQuery({
    queryKey: hubkadhigisKeys.personHistory(phone, name),
    queryFn: () => fetchPersonHistory(query, mode as "phone" | "name"),
    enabled: query.length >= 2,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useCreateDisarmamentRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      personFile,
      coverFile,
      ...payload
    }: CreateDisarmamentPayload & { personFile?: File; coverFile?: File }) =>
      createDisarmamentRecord(payload, { personFile, coverFile }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.all });
      toast({ title: "Record created", description: "Disarmament record saved." });
    },
    onError: () => {
      toast({ title: "Create failed", variant: "destructive" });
    },
  });
}

export function useUpdateDisarmamentRecord(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      personFile,
      coverFile,
      ...payload
    }: UpdateDisarmamentPayload & { personFile?: File; coverFile?: File }) =>
      updateDisarmamentRecord(id, payload, { personFile, coverFile }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.all });
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.detail(id) });
      toast({ title: "Record updated" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });
}

export function useDeleteDisarmamentRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDisarmamentRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.all });
      toast({ title: "Record deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });
}

export function useUploadDisarmamentImage(recordId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      caption,
      image_type,
    }: {
      file: File;
      caption?: string;
      image_type?: "weapon" | "evidence";
    }) => uploadDisarmamentImage(recordId, file, { caption, image_type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.detail(recordId) });
      toast({ title: "Image uploaded" });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });
}

export function useDeleteDisarmamentImage(recordId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDisarmamentImage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hubkadhigisKeys.detail(recordId) });
      toast({ title: "Image removed" });
    },
  });
}
