import api from "@/lib/axios";
import type { AppUsageReport } from "@/types/app-usage-report";
import type {
  AgentAccessRecord,
  AgentAppUser,
  AgentCapturedSuspect,
  AgentDetail,
  AgentEligibleUser,
  AgentFile,
  AgentHrmSearchResult,
  AgentLoginActivity,
  AgentRelative,
  AgentStaffSearchResult,
  AgentSummary,
  BulkResetPasswordsResult,
  CreateAgentPayload,
  CreateFromStaffResult,
  PaginatedResponse,
} from "@/types/agents";

export const AGENTS_PAGE_SIZE = 10;
export const APP_USERS_PAGE_SIZE = 10;

export type AgentsListParams = {
  page: number;
  search?: string;
  county?: string;
  present?: string;
  active?: string;
  pageSize?: number;
};

export type AppUsersListParams = {
  page: number;
  search?: string;
  county?: string;
  department?: string;
  activityStatus?: string;
  installationStatus?: string;
  notInstalledReason?: string;
  active?: string;
  pageSize?: number;
};

export const agentKeys = {
  all: ["agents"] as const,
  list: (params: AgentsListParams) =>
    ["agents", "list", params.page, params.search ?? "", params.county ?? "", params.present ?? "", params.active ?? "", params.pageSize ?? AGENTS_PAGE_SIZE] as const,
  appUsers: (params: AppUsersListParams) =>
    ["agents", "app-users", params.page, params.search ?? "", params.county ?? "", params.department ?? "", params.activityStatus ?? "", params.installationStatus ?? "", params.notInstalledReason ?? "", params.active ?? "", params.pageSize ?? APP_USERS_PAGE_SIZE] as const,
  appUsageReport: (params?: { county?: string; department?: string; dateFrom?: string; dateTo?: string }) =>
    ["agents", "app-usage-report", params?.county ?? "", params?.department ?? "", params?.dateFrom ?? "", params?.dateTo ?? ""] as const,
  loginActivity: (id: string) => ["agents", "login-activity", id] as const,
  detail: (id: string) => ["agents", "detail", id] as const,
  access: (id: string) => ["agents", "access", id] as const,
  relatives: (id: string) => ["agents", "relatives", id] as const,
  files: (id: string) => ["agents", "files", id] as const,
  capturedSuspects: (id: string, page: number, pageSize: number = 10) =>
    ["agents", "captured-suspects", id, page, pageSize] as const,
  eligibleUsers: (search: string) => ["agents", "eligible-users", search] as const,
};

export async function fetchAgents(params: AgentsListParams) {
  const { data } = await api.get<PaginatedResponse<AgentSummary>>("/accounts/agents/", {
    params: {
      page: params.page,
      search: params.search || undefined,
      county: params.county || undefined,
      present: params.present || undefined,
      active: params.active || undefined,
      page_size: params.pageSize ?? AGENTS_PAGE_SIZE,
    },
  });
  return data;
}

export async function fetchAppUsers(params: AppUsersListParams) {
  const { data } = await api.get<PaginatedResponse<AgentAppUser>>("/accounts/agents/app-users/", {
    params: {
      page: params.page,
      search: params.search || undefined,
      county: params.county || undefined,
      department: params.department || undefined,
      activity_status: params.activityStatus || undefined,
      installation_status: params.installationStatus || undefined,
      not_installed_reason: params.notInstalledReason || undefined,
      active: params.active || undefined,
      page_size: params.pageSize ?? APP_USERS_PAGE_SIZE,
    },
  });
  return data;
}

export async function fetchAppUsageReport(params?: {
  county?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  installedOnly?: boolean;
}) {
  const { data } = await api.get<AppUsageReport>("/accounts/agents/app-usage-report/", {
    params: {
      county: params?.county || undefined,
      department: params?.department || undefined,
      date_from: params?.dateFrom || undefined,
      date_to: params?.dateTo || undefined,
      installed_only: params?.installedOnly === false ? "0" : "1",
    },
  });
  return data;
}

export async function fetchAppUsersReport(params: Omit<AppUsersListParams, "page" | "pageSize">) {
  const { data } = await api.get<AgentAppUser[]>("/accounts/agents/app-users/", {
    params: {
      report: "true",
      search: params.search || undefined,
      county: params.county || undefined,
      department: params.department || undefined,
      activity_status: params.activityStatus || undefined,
      installation_status: params.installationStatus || undefined,
      not_installed_reason: params.notInstalledReason || undefined,
      active: params.active || undefined,
    },
  });
  return data;
}

export async function fetchAgentLoginActivity(id: string) {
  const { data } = await api.get<AgentLoginActivity>(`/accounts/agents/${id}/login-activity/`);
  return data;
}

export async function bulkResetAgentPasswords(payload: {
  county_id: string;
  user_ids?: number[];
  select_all_in_county?: boolean;
}) {
  const { data } = await api.post<BulkResetPasswordsResult>(
    "/accounts/agents/bulk-reset-passwords/",
    payload,
  );
  return data;
}

export async function resetAgentPasswordToPhone(agentId: string) {
  const { data } = await api.post<{ detail: string; phone_hint?: string }>(
    `/accounts/agents/${agentId}/reset-password-to-phone/`,
  );
  return data;
}

export async function searchAgentStaff(search: string) {
  const { data } = await api.get<AgentStaffSearchResult>("/accounts/agents/search-staff/", {
    params: { search },
  });
  return data;
}

export async function searchAgentHrm(search: string) {
  const { data } = await api.get<AgentHrmSearchResult>("/accounts/agents/search-hrm/", {
    params: { search },
  });
  return data;
}

export async function createAgentFromStaff(payload: {
  employee_id: string;
  gender: string;
  county_id: string;
  profile: File;
}) {
  const fd = new FormData();
  fd.append("employee_id", payload.employee_id);
  fd.append("gender", payload.gender);
  fd.append("county_id", payload.county_id);
  fd.append("profile", payload.profile);
  const { data } = await api.post<CreateFromStaffResult>(
    "/accounts/agents/create-from-staff/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export type ChangeAgentCountyResult = {
  success: boolean;
  message: string;
  agent_id: string;
  service_id: string | null;
  county_id: string;
  county_name: string;
  user_updated: boolean;
};

export async function changeAgentCounty(payload: {
  county_id: string;
  service_id?: string;
  agent_id?: string;
}) {
  const { data } = await api.post<ChangeAgentCountyResult>(
    "/accounts/agents/change-county/",
    payload,
  );
  return data;
}

export async function fetchAgent(id: string) {
  const { data } = await api.get<AgentDetail>(`/accounts/agents/${id}/`);
  return data;
}

export async function createAgent(payload: CreateAgentPayload) {
  const { data } = await api.post<AgentDetail>("/accounts/agents/", payload);
  return data;
}

export async function updateAgent(id: string, payload: FormData | Record<string, unknown>) {
  const isForm = payload instanceof FormData;
  const { data } = await api.patch<AgentDetail>(`/accounts/agents/${id}/`, payload, {
    headers: isForm ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return data;
}

export async function updateAgentRelative(
  agentId: string,
  relativeId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch<AgentRelative>(
    `/accounts/agents/${agentId}/relatives/${relativeId}/`,
    payload,
  );
  return data;
}

export async function fetchAgentEligibleUsers(search = "") {
  const { data } = await api.get<AgentEligibleUser[]>("/accounts/agents/eligible-users/", {
    params: { search: search || undefined },
  });
  return data;
}

export async function fetchAgentAccess(id: string) {
  const { data } = await api.get<AgentAccessRecord[]>(`/accounts/agents/${id}/access/`);
  return data;
}

export async function addAgentAccess(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post<AgentAccessRecord>(`/accounts/agents/${id}/access/`, payload);
  return data;
}

export async function fetchAgentRelatives(id: string) {
  const { data } = await api.get<AgentRelative[]>(`/accounts/agents/${id}/relatives/`);
  return data;
}

export async function addAgentRelative(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post<AgentRelative>(`/accounts/agents/${id}/relatives/`, payload);
  return data;
}

export async function fetchAgentFiles(id: string) {
  const { data } = await api.get<AgentFile[]>(`/accounts/agents/${id}/files/`);
  return data;
}

export async function addAgentFile(id: string, form: FormData) {
  const { data } = await api.post<AgentFile>(`/accounts/agents/${id}/files/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchAgentCapturedSuspects(id: string, page = 1, pageSize = 10) {
  const { data } = await api.get<PaginatedResponse<AgentCapturedSuspect>>(
    `/accounts/agents/${id}/captured-suspects/`,
    { params: { page, page_size: pageSize } },
  );
  return data;
}
