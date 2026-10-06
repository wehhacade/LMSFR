import api from "@/lib/axios";
import type {
  CreateDisarmamentPayload,
  DisarmamentDetail,
  DisarmamentImage,
  DisarmamentRecord,
  DisarmamentStats,
  HubkadhigisAnalytics,
  HubkadhigisLookups,
  PaginatedResponse,
  PersonHistoryResult,
  UpdateDisarmamentPayload,
} from "@/types/hubkadhigis";

const BASE = "/hubkadhigis";
export const PAGE_SIZE = 10;
export const GALLERY_PAGE_SIZE = 10;

export const hubkadhigisKeys = {
  all: ["hubkadhigis"] as const,
  list: (page: number, search: string, filters: Record<string, string>, pageSize: number = PAGE_SIZE) =>
    ["hubkadhigis", page, search, filters, pageSize] as const,
  detail: (id: number) => ["hubkadhigis-record", id] as const,
  stats: ["hubkadhigis", "stats"] as const,
  analytics: ["hubkadhigis", "analytics"] as const,
  lookups: ["hubkadhigis-lookups"] as const,
  images: (recordId: number) => ["hubkadhigis-images", recordId] as const,
  galleryImages: (page: number, search: string, pageSize: number = GALLERY_PAGE_SIZE) =>
    ["hubkadhigis-gallery-images", page, search, pageSize] as const,
  personHistory: (phone: string, name: string) =>
    ["hubkadhigis-person-history", phone, name] as const,
};

export interface HubkadhigisParams {
  page: number;
  search: string;
  county?: string;
  weapon_type?: string;
  force_unit?: string;
  has_images?: boolean;
  status?: "handed_over" | "registered" | "";
  pageSize?: number;
}

function appendFormFields(form: FormData, payload: Record<string, unknown>) {
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, String(value));
  });
}

export async function fetchDisarmamentRecords({
  page,
  search,
  county,
  weapon_type,
  force_unit,
  has_images,
  status,
  pageSize = PAGE_SIZE,
}: HubkadhigisParams) {
  const { data } = await api.get<PaginatedResponse<DisarmamentRecord>>(`${BASE}/`, {
    params: {
      page,
      search: search || undefined,
      county: county || undefined,
      weapon_type: weapon_type || undefined,
      force_unit: force_unit || undefined,
      has_images: has_images ? "1" : undefined,
      status: status || undefined,
      page_size: pageSize,
    },
  });
  return data;
}

export async function fetchDisarmamentRecord(id: number) {
  const { data } = await api.get<DisarmamentDetail>(`${BASE}/${id}/`);
  return data;
}

export async function fetchDisarmamentStats() {
  const { data } = await api.get<DisarmamentStats>(`${BASE}/stats/`);
  return data;
}

export async function fetchHubkadhigisAnalytics() {
  const { data } = await api.get<HubkadhigisAnalytics>(`${BASE}/analytics/`);
  return data;
}

export async function fetchHubkadhigisLookups() {
  const { data } = await api.get<HubkadhigisLookups>(`${BASE}/lookups/`);
  return data;
}

function appendRecordFiles(
  form: FormData,
  payload: Record<string, unknown>,
  files?: { personFile?: File; coverFile?: File },
) {
  appendFormFields(form, payload);
  if (files?.personFile) form.append("person_image", files.personFile);
  if (files?.coverFile) form.append("cover_image", files.coverFile);
}

export async function createDisarmamentRecord(
  payload: CreateDisarmamentPayload,
  files?: { personFile?: File; coverFile?: File },
) {
  if (files?.personFile || files?.coverFile) {
    const form = new FormData();
    appendRecordFiles(form, payload as unknown as Record<string, unknown>, files);
    const { data } = await api.post<DisarmamentDetail>(`${BASE}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<DisarmamentDetail>(`${BASE}/`, payload);
  return data;
}

export async function updateDisarmamentRecord(
  id: number,
  payload: UpdateDisarmamentPayload,
  files?: { personFile?: File; coverFile?: File },
) {
  if (files?.personFile || files?.coverFile) {
    const form = new FormData();
    appendRecordFiles(form, payload as unknown as Record<string, unknown>, files);
    const { data } = await api.patch<DisarmamentDetail>(`${BASE}/${id}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch<DisarmamentDetail>(`${BASE}/${id}/`, payload);
  return data;
}

export async function deleteDisarmamentRecord(id: number) {
  await api.delete(`${BASE}/${id}/`);
}

export async function uploadDisarmamentImage(
  recordId: number,
  file: File,
  options: { caption?: string; image_type?: "weapon" | "evidence" } = {},
) {
  const form = new FormData();
  form.append("record", String(recordId));
  form.append("file", file);
  if (options.caption) form.append("caption", options.caption);
  if (options.image_type) form.append("image_type", options.image_type);
  const { data } = await api.post<DisarmamentImage>(`${BASE}/images/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteDisarmamentImage(id: number) {
  await api.delete(`${BASE}/images/${id}/`);
}

export async function fetchDisarmamentGalleryImages(page: number, search = "", pageSize = GALLERY_PAGE_SIZE) {
  const { data } = await api.get<PaginatedResponse<DisarmamentImage>>(`${BASE}/images/`, {
    params: {
      page,
      search: search || undefined,
      page_size: pageSize,
    },
  });
  return data;
}

export async function fetchPersonHistory(
  query: string,
  mode: "phone" | "name" = "phone",
): Promise<PersonHistoryResult> {
  const params =
    mode === "phone"
      ? { phone: query.trim() }
      : { person_name: query.trim() };
  const { data } = await api.get<PersonHistoryResult>(`${BASE}/person-history/`, { params });
  return data;
}
