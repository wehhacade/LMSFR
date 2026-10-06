import api from "@/lib/axios";
import type {
  PaginatedVisitors,
  VisitAllegation,
  VisitDestination,
  Visitor,
  VisitorsAnalytics,
  VisitorsStats,
  VisitorWritePayload,
} from "@/types/visitors";

const BASE = "/visitors";
export const VISITORS_PAGE_SIZE = 12;

export const visitorsKeys = {
  all: ["visitors"] as const,
  list: (page: number, search: string, filters: Record<string, string>, pageSize: number) =>
    ["visitors", page, search, filters, pageSize] as const,
  detail: (id: number) => ["visitors", id] as const,
  stats: ["visitors", "stats"] as const,
  destinations: ["visitors", "destinations"] as const,
  allegations: ["visitors", "allegations"] as const,
  analytics: (range: string, date?: string) => ["visitors", "analytics", range, date ?? ""] as const,
};

export interface VisitorsListParams {
  page: number;
  search?: string;
  verified?: "" | "1" | "0";
  date_from?: string;
  date_to?: string;
  pageSize?: number;
}

function toFormData(payload: VisitorWritePayload): FormData {
  const form = new FormData();
  form.append("full_name", payload.full_name);
  if (payload.mother_name != null) form.append("mother_name", payload.mother_name);
  if (payload.gender != null) form.append("gender", payload.gender);
  if (payload.phone != null) form.append("phone", payload.phone);
  if (payload.nira != null) form.append("nira", payload.nira);
  form.append("visiting", payload.visiting);
  if (payload.contact_name != null) form.append("contact_name", payload.contact_name);
  if (payload.relationship != null) form.append("relationship", payload.relationship);
  if (payload.allegation_id != null) form.append("allegation_id", String(payload.allegation_id));
  if (payload.sentence != null) form.append("sentence", payload.sentence);
  if (payload.notes != null) form.append("notes", payload.notes);
  if (payload.visited_at) form.append("visited_at", payload.visited_at);
  if (payload.verified != null) form.append("verified", payload.verified ? "true" : "false");
  if (payload.image instanceof File) form.append("image", payload.image);
  return form;
}

export async function fetchVisitors(params: VisitorsListParams) {
  const { data } = await api.get<PaginatedVisitors>(`${BASE}/`, {
    params: {
      page: params.page,
      search: params.search || undefined,
      verified: params.verified || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
      page_size: params.pageSize ?? VISITORS_PAGE_SIZE,
    },
  });
  return data;
}

export async function fetchVisitor(id: number) {
  const { data } = await api.get<Visitor>(`${BASE}/${id}/`);
  return data;
}

export async function createVisitor(payload: VisitorWritePayload) {
  const { data } = await api.post<Visitor>(`${BASE}/`, toFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateVisitor(id: number, payload: VisitorWritePayload) {
  const { data } = await api.patch<Visitor>(`${BASE}/${id}/`, toFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteVisitor(id: number) {
  await api.delete(`${BASE}/${id}/`);
}

export async function fetchVisitDestinations() {
  const { data } = await api.get<VisitDestination[]>(`${BASE}/destinations/`);
  return data;
}

export async function fetchVisitAllegations() {
  const { data } = await api.get<VisitAllegation[]>(`${BASE}/allegations/`);
  return data;
}

export async function fetchVisitorsStats() {
  const { data } = await api.get<VisitorsStats>(`${BASE}/stats/`);
  return data;
}

export async function fetchVisitorsAnalytics(range = "7d", date?: string) {
  const { data } = await api.get<VisitorsAnalytics>(`${BASE}/analytics/`, {
    params: { range, date: date || undefined },
  });
  return data;
}
