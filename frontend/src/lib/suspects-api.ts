import api from "@/lib/axios";
import type {
  PaginatedResponse,
  Suspect,
  SuspectArrest,
  SuspectCase,
  SuspectComment,
  SuspectCommentKind,
  SuspectDetail,
  SuspectGuarantor,
  SuspectStats,
  SuspectType,
} from "@/types/suspect";

const BASE = "/suspect";
export const PAGE_SIZE = 10;

export const suspectKeys = {
  all: ["suspects"] as const,
  list: (page: number, search: string, filters: Record<string, string>, pageSize: number = PAGE_SIZE) =>
    ["suspects", page, search, filters, pageSize] as const,
  detail: (id: number) => ["suspect", id] as const,
  stats: ["suspect-stats"] as const,
  districts: ["suspect-districts"] as const,
  types: ["suspect-types"] as const,
  cases: (id: number) => ["suspect-cases", id] as const,
  guarantors: (id: number) => ["suspect-guarantors", id] as const,
  arrests: (id: number) => ["suspect-arrests", id] as const,
  comments: (id: number) => ["suspect-comments", id] as const,
};

export interface SuspectsParams {
  page: number;
  search: string;
  county?: string;
  suspect_type?: string;
  period?: string;
  pageSize?: number;
}

export interface CreateSuspectPayload {
  name: string;
  alias?: string;
  photo?: string;
  district: string;
  case_ref: string;
  status?: string;
  suspect_type?: number | null;
  last_seen: string;
  offense: string;
  notes?: string;
}

export type UpdateSuspectPayload = Partial<CreateSuspectPayload>;

export async function fetchSuspects({ page, search, county, suspect_type, period, pageSize = PAGE_SIZE }: SuspectsParams) {
  const { data } = await api.get<PaginatedResponse<Suspect>>(`${BASE}/`, {
    params: {
      page,
      search: search || undefined,
      county: county || undefined,
      suspect_type: suspect_type || undefined,
      period: period || undefined,
      page_size: pageSize,
    },
  });
  return data;
}

export async function fetchSuspect(id: number) {
  const { data } = await api.get<SuspectDetail>(`${BASE}/${id}/`);
  return data;
}

export async function fetchSuspectStats() {
  const { data } = await api.get<SuspectStats>(`${BASE}/stats/`);
  return data;
}

export async function fetchSuspectDistricts() {
  const { data } = await api.get<string[]>(`${BASE}/districts/`);
  return data;
}

export async function fetchSuspectTypes() {
  const { data } = await api.get<SuspectType[]>(`${BASE}/status-types/`);
  return data;
}

export async function createSuspect(payload: CreateSuspectPayload, pictureFile?: File) {
  if (pictureFile) {
    const form = new FormData();
    (Object.entries(payload) as [string, string | undefined][]).forEach(([key, value]) => {
      if (value !== undefined && value !== "") form.append(key, value);
    });
    form.append("picture", pictureFile);
    const { data } = await api.post<SuspectDetail>(`${BASE}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<SuspectDetail>(`${BASE}/`, payload);
  return data;
}

export async function updateSuspect(id: number, payload: UpdateSuspectPayload, pictureFile?: File) {
  if (pictureFile) {
    const form = new FormData();
    (Object.entries(payload) as [string, string | undefined][]).forEach(([key, value]) => {
      if (value !== undefined && value !== "") form.append(key, value);
    });
    form.append("picture", pictureFile);
    const { data } = await api.patch<SuspectDetail>(`${BASE}/${id}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch<SuspectDetail>(`${BASE}/${id}/`, payload);
  return data;
}

export async function deleteSuspect(id: number) {
  await api.delete(`${BASE}/${id}/`);
}

export async function releaseSuspect(id: number) {
  const { data } = await api.post<SuspectDetail>(`${BASE}/${id}/release/`);
  return data;
}

export async function fetchSuspectCases(id: number) {
  const { data } = await api.get<SuspectCase[] | PaginatedResponse<SuspectCase>>(`${BASE}/cases/`, { params: { suspect: id } });
  return Array.isArray(data) ? data : data.results;
}

export async function createSuspectCase(
  id: number,
  payload: Partial<Omit<SuspectCase, "id" | "suspect" | "created_at" | "case_code">>,
) {
  const { data } = await api.post(`${BASE}/guarantors/`, { ...payload, suspect_id: id }, { params: { suspect: id } });
  return data;
}

export async function fetchSuspectGuarantors(id: number) {
  const { data } = await api.get<SuspectGuarantor[] | PaginatedResponse<SuspectGuarantor>>(`${BASE}/guarantors/`, { params: { suspect: id } });
  return Array.isArray(data) ? data : data.results;
}

export async function createSuspectGuarantor(
  id: number,
  payload: Record<string, unknown>,
) {
  const { data } = await api.post(`${BASE}/guarantors/`, { ...payload, suspect_id: id }, { params: { suspect: id } });
  return data;
}

export async function updateDamiinPhotos(
  damiinId: number,
  files: { picture?: File; identity_picture?: File },
  suspectId?: number,
) {
  const form = new FormData();
  if (files.picture) form.append("picture", files.picture);
  if (files.identity_picture) form.append("identity_picture", files.identity_picture);
  const { data } = await api.patch<SuspectGuarantor>(`${BASE}/guarantors/${damiinId}/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    params: suspectId ? { suspect: suspectId } : undefined,
  });
  return data;
}

export async function fetchSuspectArrests(id: number) {
  const { data } = await api.get<SuspectArrest[] | PaginatedResponse<SuspectArrest>>(`${BASE}/arrests/`, { params: { suspect: id } });
  return Array.isArray(data) ? data : data.results;
}

export async function createSuspectArrest(id: number, payload: Omit<SuspectArrest, "id" | "suspect" | "created_at">) {
  const { data } = await api.post<SuspectArrest>(`${BASE}/arrests/`, { ...payload, suspect: id });
  return data;
}

export async function fetchSuspectComments(id: number) {
  const { data } = await api.get<SuspectComment[] | PaginatedResponse<SuspectComment>>(`${BASE}/${id}/discussion/`);
  return Array.isArray(data) ? data : data.results;
}

export async function createSuspectComment(
  id: number,
  payload: { body: string; kind?: SuspectCommentKind; target_id?: number | null },
) {
  const { data } = await api.post<SuspectComment>(`${BASE}/${id}/discussion/`, {
    body: payload.body,
    kind: payload.kind ?? "response",
    target_id: payload.target_id ?? null,
  });
  return data;
}
