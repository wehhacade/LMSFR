import api from "@/lib/axios";
import type {
  BaarisAnalytics,
  BaarisCitizenRow,
  BaarisStats,
  WantedRow,
} from "@/types/baaris";

const BASE = "/baaris";

export const BAARIS_PAGE_SIZE = 10;

export const baarisKeys = {
  all: ["baaris"] as const,
  stats: ["baaris", "stats"] as const,
  analytics: (range: string) => ["baaris", "analytics", range] as const,
  citizens: (page: number, search: string, county: string, pageSize: number = BAARIS_PAGE_SIZE) =>
    ["baaris", "citizens", page, search, county, pageSize] as const,
  citizen: (id: number) => ["baaris", "citizen", id] as const,
  wanted: (page: number, search: string, pageSize: number = BAARIS_PAGE_SIZE) =>
    ["baaris", "wanted", page, search, pageSize] as const,
  wantedTypes: ["baaris", "wanted-types"] as const,
};

export async function fetchBaarisStats() {
  const { data } = await api.get<BaarisStats>(`${BASE}/stats`);
  return data;
}

export async function fetchBaarisAnalytics(range = "7d") {
  const { data } = await api.get<BaarisAnalytics>(`${BASE}/analytics`, {
    params: { range },
  });
  return data;
}

export async function fetchBaarisCitizens(params: {
  page: number;
  search?: string;
  county?: string;
  pageSize?: number;
}) {
  const { data } = await api.get<{
    Message: BaarisCitizenRow[];
    current_page: number;
    total_pages: number;
  }>(`${BASE}/citizens`, {
    params: {
      page: params.page,
      search: params.search || undefined,
      county: params.county || undefined,
      page_size: params.pageSize ?? BAARIS_PAGE_SIZE,
    },
  });
  return {
    rows: Array.isArray(data.Message) ? data.Message : [],
    page: data.current_page ?? params.page,
    totalPages: Math.max(1, data.total_pages ?? 1),
  };
}

export async function fetchBaarisCitizenDetail(id: number) {
  const { data } = await api.get(`${BASE}/citizens/${id}`);
  return data as {
    identity: BaarisCitizenRow;
    profile: Record<string, unknown> | null;
    dossier_available: boolean;
  };
}

export async function fetchWantedList(params: { page: number; search?: string; pageSize?: number }) {
  const { data } = await api.get<{
    results: WantedRow[];
    count: number;
    page: number;
    total_pages: number;
  }>(`${BASE}/wanted`, {
    params: {
      page: params.page,
      search: params.search || undefined,
      page_size: params.pageSize ?? BAARIS_PAGE_SIZE,
    },
  });
  return data;
}

export async function createWanted(form: FormData) {
  const { data } = await api.post<WantedRow>(`${BASE}/wanted`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteWanted(id: number) {
  await api.delete(`${BASE}/wanted/${id}`);
}

export async function fetchWantedTypes() {
  const { data } = await api.get<{ results: { id: number; name: string }[] }>(`${BASE}/wanted/types`);
  return data.results ?? [];
}
