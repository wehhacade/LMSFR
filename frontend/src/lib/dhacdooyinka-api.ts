import api from "@/lib/axios";
import type { PaginatedResponse } from "@/types/accounts";
import type {
  CreateRequirementPayload,
  CreateUtilityPayload,
  DhacdooyinkaDetail,
  DhacdooyinkaLookups,
  DhacdooyinkaAnalytics,
  DhacdooyinkaRecord,
  DhacdooyinkaRequirement,
  DhacdooyinkaStats,
  DhacdooyinkaUpdate,
  DhacdooyinkaUtility,
  DhacdooyinkaVictim,
  DhacdooyinkaWritePayload,
  UpdateRequirementPayload,
  UpdateUtilityPayload,
} from "@/types/dhacdooyinka";

export const PAGE_SIZE = 10;

export const dhacdooyinkaKeys = {
  all: ["dhacdooyinka"] as const,
  list: (page: number, search: string, filters: Record<string, string>, pageSize: number = PAGE_SIZE) =>
    ["dhacdooyinka", "list", page, search, filters, pageSize] as const,
  detail: (id: number) => ["dhacdooyinka", "detail", id] as const,
  utility: (search = "") => ["dhacdooyinka", "utility", search] as const,
  requirements: (search = "", utility = "") =>
    ["dhacdooyinka", "requirements", search, utility] as const,
  stats: (filters: Record<string, string>) => ["dhacdooyinka", "stats", filters] as const,
  analytics: ["dhacdooyinka", "analytics"] as const,
  lookups: ["dhacdooyinka", "lookups"] as const,
};

const LIST_PAGE_SIZE = 200;

export interface DhacdooyinkaListParams {
  page: number;
  search: string;
  year?: string;
  month?: string;
  page_size?: number;
}

export async function fetchDhacdooyinkaRecords({
  page,
  search,
  year,
  month,
  page_size = PAGE_SIZE,
}: DhacdooyinkaListParams) {
  const { data } = await api.get<PaginatedResponse<DhacdooyinkaRecord>>("/dhacdooyinka/", {
    params: {
      page,
      search: search || undefined,
      year: year || undefined,
      month: month || undefined,
      page_size,
    },
  });
  return data;
}

export async function fetchDhacdooyinkaRecord(id: number) {
  const { data } = await api.get<DhacdooyinkaDetail>(`/dhacdooyinka/${id}/`);
  return data;
}

export async function fetchDhacdooyinkaLookups() {
  const { data } = await api.get<DhacdooyinkaLookups>("/dhacdooyinka/lookups/");
  return data;
}

function appendFormFields(form: FormData, payload: Record<string, unknown>) {
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (key === "victims") {
      form.append(key, JSON.stringify(value));
      return;
    }
    form.append(key, String(value));
  });
}

function appendEventFiles(
  form: FormData,
  eventEvidence?: File[],
  victimDocuments?: File[][],
) {
  eventEvidence?.forEach((file) => form.append("event_evidence", file));
  victimDocuments?.forEach((files, index) => {
    files.forEach((file) => form.append(`victim_document_${index}`, file));
  });
}

export async function createDhacdooyinkaRecord(
  payload: DhacdooyinkaWritePayload,
  eventEvidence?: File[],
  victimDocuments?: File[][],
) {
  const hasFiles = Boolean(eventEvidence?.length) || Boolean(victimDocuments?.some((f) => f.length));
  if (hasFiles) {
    const form = new FormData();
    appendFormFields(form, payload as Record<string, unknown>);
    appendEventFiles(form, eventEvidence, victimDocuments);
    const { data } = await api.post<DhacdooyinkaDetail>("/dhacdooyinka/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<DhacdooyinkaDetail>("/dhacdooyinka/", payload);
  return data;
}

export async function updateDhacdooyinkaRecord(
  id: number,
  payload: DhacdooyinkaWritePayload,
  eventEvidence?: File[],
  victimDocuments?: File[][],
) {
  const hasFiles = Boolean(eventEvidence?.length) || Boolean(victimDocuments?.some((f) => f.length));
  if (hasFiles) {
    const form = new FormData();
    appendFormFields(form, payload as Record<string, unknown>);
    appendEventFiles(form, eventEvidence, victimDocuments);
    const { data } = await api.patch<DhacdooyinkaDetail>(`/dhacdooyinka/${id}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch<DhacdooyinkaDetail>(`/dhacdooyinka/${id}/`, payload);
  return data;
}

export async function deleteDhacdooyinkaRecord(id: number) {
  await api.delete(`/dhacdooyinka/${id}/`);
}

export async function addDhacdooyinkaVictim(
  eventId: number,
  victim: DhacdooyinkaVictim,
  documents?: File[],
) {
  if (documents?.length) {
    const form = new FormData();
    Object.entries(victim).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        form.append(key, String(value));
      }
    });
    documents.forEach((file) => form.append("victim_document", file));
    const { data } = await api.post<DhacdooyinkaVictim>(
      `/dhacdooyinka/${eventId}/add-victim/`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  }
  const { data } = await api.post<DhacdooyinkaVictim>(
    `/dhacdooyinka/${eventId}/add-victim/`,
    victim,
  );
  return data;
}

export async function addDhacdooyinkaUpdate(eventId: number, fahfaahin: string) {
  const { data } = await api.post<DhacdooyinkaUpdate>(`/dhacdooyinka/${eventId}/add-update/`, {
    fahfaahin,
  });
  return data;
}

export async function fetchUtilities(search = "") {
  const { data } = await api.get<PaginatedResponse<DhacdooyinkaUtility>>("/dhacdooyinka/utility/", {
    params: { page_size: LIST_PAGE_SIZE, search: search || undefined },
  });
  return data.results;
}

export async function createUtility(payload: CreateUtilityPayload) {
  const { data } = await api.post<DhacdooyinkaUtility>("/dhacdooyinka/utility/", payload);
  return data;
}

export async function updateUtility(id: number, payload: UpdateUtilityPayload) {
  const { data } = await api.patch<DhacdooyinkaUtility>(`/dhacdooyinka/utility/${id}/`, payload);
  return data;
}

export async function deleteUtility(id: number) {
  await api.delete(`/dhacdooyinka/utility/${id}/`);
}

export async function fetchRequirements(search = "", utility = "") {
  const { data } = await api.get<PaginatedResponse<DhacdooyinkaRequirement>>(
    "/dhacdooyinka/requirements/",
    {
      params: {
        page_size: LIST_PAGE_SIZE,
        search: search || undefined,
        utility: utility || undefined,
      },
    },
  );
  return data.results;
}

export async function createRequirement(payload: CreateRequirementPayload) {
  const { data } = await api.post<DhacdooyinkaRequirement>("/dhacdooyinka/requirements/", payload);
  return data;
}

export async function updateRequirement(id: number, payload: UpdateRequirementPayload) {
  const { data } = await api.patch<DhacdooyinkaRequirement>(
    `/dhacdooyinka/requirements/${id}/`,
    payload,
  );
  return data;
}

export async function deleteRequirement(id: number) {
  await api.delete(`/dhacdooyinka/requirements/${id}/`);
}

export async function fetchDhacdooyinkaStats(filters: Record<string, string> = {}) {
  const { data } = await api.get<DhacdooyinkaStats>("/dhacdooyinka/stats/", {
    params: {
      year: filters.year || undefined,
      month: filters.month || undefined,
      search: filters.search || undefined,
    },
  });
  return data;
}

export async function fetchDhacdooyinkaAnalytics() {
  const { data } = await api.get<DhacdooyinkaAnalytics>("/dhacdooyinka/analytics/");
  return data;
}
