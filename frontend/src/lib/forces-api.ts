import api from "@/lib/axios";
import type { PaginatedResponse } from "@/types/suspect";
import type { Force, ForceStats } from "@/types/forces";

export const FORCES_PAGE_SIZE = 10;

export interface ForcesParams {
  page:     number;
  search:   string;
  district: string;
  pageSize?: number;
}

export async function fetchForces({ page, search, district, pageSize = FORCES_PAGE_SIZE }: ForcesParams) {
  const { data } = await api.get<PaginatedResponse<Force>>("/forces/", {
    params: {
      page,
      page_size: pageSize,
      search:   search   || undefined,
      district: district || undefined,
    },
  });
  return data;
}

export async function fetchForceDistricts(): Promise<string[]> {
  const { data } = await api.get<string[]>("/forces/districts/");
  return data;
}

export async function fetchForceStats(): Promise<ForceStats> {
  const { data } = await api.get<ForceStats>("/forces/stats/");
  return data;
}

