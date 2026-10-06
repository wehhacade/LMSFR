/**
 * Suspect API client for mobile apps (React Native / Flutter / native).
 * Optimised endpoints under /api/v1/suspect/mobile/
 *
 * Auth: Bearer token from POST /api/v1/auth/login/
 * Session: mobile uses JWT refresh only — no idle lockout (see MOBILE_SESSION_POLICY).
 */

import api from "@/lib/axios";
export { MOBILE_SESSION_POLICY } from "@/lib/session-policy";

const BASE = "/suspect/mobile";

export interface MobileSuspect {
  id: number;
  fullname: string;
  nickname: string;
  photo: string;
  district: string;
  status: string;
  risk: string;
  last_seen: string;
  offense: string;
  case_ref: string;
  is_released: boolean;
  bail_count: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MobileGuarantor {
  id: number;
  suspect: number;
  name: string;
  full_name: string;
  phone: string;
  relationship: string;
  amount: string | null;
  description: string;
  notes: string;
  created_at: string;
}

export interface MobileLookups {
  status_types: { id: string; name: string }[];
  risk_levels: { id: string; name: string }[];
  regions?: { id: string; legacy_id: number | null; name: string; code: string }[];
  districts: { id: string | number; name: string; legacy_id?: number | null; code?: string; region_id?: string | null }[];
  sub_counties?: { id: string; legacy_id: number | null; cid: string; name: string; code?: string }[];
  relationships?: { id: number; name: string }[];
}

export interface MobileSuspectPage {
  count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  results: MobileSuspect[];
}

export interface CreateSuspectMobilePayload {
  fullname: string;
  nickname?: string;
  district: string;
  offense: string;
  description?: string;
  photo?: string;
  status?: string;
  risk?: string;
  last_seen?: string;
  case_ref?: string;
}

export interface CreateGuarantorMobilePayload {
  name: string;
  phone?: string;
  relationship?: string;
  description?: string;
  amount?: string;
}

/** One round-trip for all dropdowns — cache on device after first load. */
export async function fetchMobileLookups(): Promise<MobileLookups> {
  const { data } = await api.get<MobileLookups>(`${BASE}/lookups/`);
  return data;
}

/** Paginated active suspects — use page_size=40 default for fast scroll. */
export async function fetchMobileSuspects(params: {
  page?: number;
  page_size?: number;
  county_name?: string;
  district?: string;
  search?: string;
} = {}): Promise<MobileSuspectPage> {
  const { data } = await api.get<MobileSuspectPage>(`${BASE}/suspects/`, {
    params: {
      page: params.page ?? 1,
      page_size: params.page_size ?? 40,
      county_name: params.county_name || params.district || undefined,
      search: params.search || undefined,
    },
  });
  return data;
}

export async function fetchMobileSuspect(id: number): Promise<MobileSuspect> {
  const { data } = await api.get<MobileSuspect>(`${BASE}/suspects/${id}/`);
  return data;
}

export async function createMobileSuspect(payload: CreateSuspectMobilePayload) {
  const { data } = await api.post<{ message: string; id: number; case_ref: string }>(
    `${BASE}/suspects/`,
    payload,
  );
  return data;
}

export async function fetchMobileGuarantors(suspectId: number): Promise<MobileGuarantor[]> {
  const { data } = await api.get<MobileGuarantor[]>(`${BASE}/guarantors/${suspectId}/`);
  return data;
}

export async function createMobileGuarantor(suspectId: number, payload: CreateGuarantorMobilePayload) {
  const { data } = await api.post<MobileGuarantor>(`${BASE}/guarantors/${suspectId}/`, payload);
  return data;
}

export async function registerSuspectComplete(payload: FormData) {
  const { data } = await api.post<{
    Message: string;
    isError: boolean;
    suspect_id: number;
    case_id: number;
    case_code: string;
    damiin_id: number;
  }>("/suspect/register-complete", payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** Legacy paths — still supported for older mobile builds. */
export const legacyMobile = {
  createSuspect: (payload: CreateSuspectMobilePayload) =>
    api.post("/suspect/suspects-create", payload),
  listSuspects: (county_name?: string) =>
    api.get<MobileSuspect[]>(
      county_name ? "/suspect/suspects_list_temp" : "/suspect/suspects/",
      { params: county_name ? { county_name } : undefined },
    ),
  createDamiin: (payload: CreateGuarantorMobilePayload & { suspect: number }) =>
    api.post("/suspect/damiinka/create", payload),
  listDamiin: (suspectId: number) =>
    api.get<MobileGuarantor[]>(`/suspect/damiinka/view/${suspectId}`),
};
