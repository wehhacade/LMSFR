import api from "@/lib/axios";
import type {
  AccountUser,
  AccountUserDetail,
  CreateGroupPayload,
  CreateUserPayload,
  GroupDetail,
  GroupSummary,
  LookupItem,
  MobileLoginTestResult,
  BulkMobileLoginTestResult,
  PaginatedResponse,
  PermissionItem,
  StaffCheck,
  UpdateGroupPayload,
  UpdateUserPayload,
  UserDevice,
  UserStats,
  UserControlDashboard,
  UserStatusPayload,
  QeybItem,
  QeybPayload,
} from "@/types/accounts";

export const ACCOUNTS_PAGE_SIZE = 10;

export const accountKeys = {
  all: ["accounts"] as const,
  users: (page: number, search: string, filters: Record<string, string>, pageSize: number = ACCOUNTS_PAGE_SIZE) =>
    ["accounts", "users", page, search, filters, pageSize] as const,
  user: (id: string) => ["accounts", "user", id] as const,
  staffCheck: (id: string) => ["accounts", "staff-check", id] as const,
  devices: (id: string) => ["accounts", "devices", id] as const,
  stats: ["accounts", "stats"] as const,
  dashboard: ["accounts", "dashboard"] as const,
  groups: ["accounts", "groups-all"] as const,
  permissionAssignments: ["accounts", "permission-assignments"] as const,
  permissionHolders: (permissionId: number) => ["accounts", "permission-holders", permissionId] as const,
  usersAll: (search: string) => ["accounts", "users-all", search] as const,
  usersPicker: (search: string) => ["accounts", "users-picker", search] as const,
  group: (id: number) => ["accounts", "group", id] as const,
  permissions: (page: number, search: string) => ["accounts", "permissions", page, search] as const,
  permissionsAll: (search: string) => ["accounts", "permissions-all", search] as const,
  counties: ["accounts", "counties"] as const,
  qeybs: ["accounts", "qeybs"] as const,
  userTypes: ["accounts", "user-types"] as const,
};

export interface UsersParams {
  page: number;
  search: string;
  county?: string;
  role?: string;
  is_staff?: string;
  pageSize?: number;
}

export async function fetchUsers({ page, search, county, role, is_staff, pageSize = ACCOUNTS_PAGE_SIZE }: UsersParams) {
  const { data } = await api.get<PaginatedResponse<AccountUser>>("/accounts/users/", {
    params: {
      page,
      search: search || undefined,
      page_size: pageSize,
      county: county || undefined,
      is_staff: is_staff || undefined,
      is_admin: role === "admin" ? "true" : undefined,
      is_officer: role === "officer" ? "true" : undefined,
      is_agent: role === "agent" ? "true" : undefined,
    },
  });
  return data;
}

export async function fetchUser(id: string) {
  const { data } = await api.get<AccountUserDetail>(`/accounts/users/${id}/`);
  return data;
}

export async function fetchUserStats() {
  const { data } = await api.get<UserStats>("/accounts/users/stats/");
  return data;
}

export async function fetchUserControlDashboard() {
  const { data } = await api.get<UserControlDashboard>("/accounts/users/dashboard/");
  return data;
}

export async function fetchStaffCheck(id: string) {
  const { data } = await api.get<StaffCheck>(`/accounts/users/${id}/check_staff/`);
  return data;
}

export async function fetchUserDevices(id: string) {
  const { data } = await api.get<UserDevice[]>(`/accounts/users/${id}/devices/`);
  return data;
}

export async function testMobileLogin(id: string, password?: string) {
  const { data } = await api.post<MobileLoginTestResult>(`/accounts/users/${id}/test_mobile_login/`, {
    password: password ?? "",
  });
  return data;
}

export async function testMobileLogins(userIds: number[]) {
  const { data } = await api.post<BulkMobileLoginTestResult>(
    "/accounts/users/test_mobile_logins/",
    { user_ids: userIds },
  );
  return data;
}

function appendFormValue(fd: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => fd.append(key, String(item)));
    return;
  }
  if (value instanceof File) {
    fd.append(key, value);
    return;
  }
  fd.append(key, String(value));
}

function toUserFormData(payload: CreateUserPayload | UpdateUserPayload): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (key === "group_ids" && Array.isArray(value)) {
      value.forEach((id) => fd.append("group_ids", String(id)));
    } else if (key === "permission_ids" && Array.isArray(value)) {
      value.forEach((id) => fd.append("permission_ids", String(id)));
    } else {
      appendFormValue(fd, key, value);
    }
  }
  return fd;
}

function hasFilePayload(payload: { profile?: File | null }) {
  return payload.profile instanceof File;
}

export async function createUser(payload: CreateUserPayload) {
  if (hasFilePayload(payload)) {
    const { data } = await api.post<AccountUserDetail>("/accounts/users/", toUserFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<AccountUserDetail>("/accounts/users/", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  if (hasFilePayload(payload)) {
    const { data } = await api.patch<AccountUserDetail>(`/accounts/users/${id}/`, toUserFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch<AccountUserDetail>(`/accounts/users/${id}/`, payload);
  return data;
}

export async function updateUserStatus(id: string, payload: UserStatusPayload) {
  const { data } = await api.post<AccountUserDetail>(`/accounts/users/${id}/status/`, payload);
  return data;
}

export async function deleteUser(id: string) {
  await api.delete(`/accounts/users/${id}/`);
}

export async function assignUserGroups(id: string, group_ids: number[]) {
  const { data } = await api.post<AccountUserDetail>(`/accounts/users/${id}/assign_groups/`, { group_ids });
  return data;
}

export async function adminResetPassword(id: string, new_password: string) {
  const { data } = await api.post<{ detail: string }>(`/accounts/users/${id}/reset_password/`, { new_password });
  return data;
}

export async function adminResetPin(id: string, new_pin: string) {
  const { data } = await api.post<{ detail: string }>(`/accounts/users/${id}/reset_pin/`, { new_pin });
  return data;
}

export async function fetchAllGroups() {
  const { data } = await api.get<PaginatedResponse<GroupSummary>>("/accounts/groups/", {
    params: { page_size: 200 },
  });
  return data.results;
}

export const RECENT_USERS_LIMIT = 5;
export const SEARCH_USERS_LIMIT = 20;

export async function fetchAllUsers(search = "") {
  const { data } = await api.get<PaginatedResponse<AccountUser>>("/accounts/users/", {
    params: { page_size: 200, search: search || undefined },
  });
  return data.results;
}

/** Recent users (5) when search empty; search results when query provided. */
export async function fetchUsersForPicker(search = "") {
  const q = search.trim();
  const { data } = await api.get<PaginatedResponse<AccountUser>>("/accounts/users/", {
    params: {
      page_size: q ? SEARCH_USERS_LIMIT : RECENT_USERS_LIMIT,
      search: q || undefined,
    },
  });
  return data;
}

export interface PermissionAssignmentGroup {
  id: number;
  name: string;
  permission_ids: number[];
  members: { id: string; name: string }[];
}

export interface PermissionAssignmentUser {
  id: string;
  name: string;
  permission_ids: number[];
  group_ids: number[];
}

export interface PermissionHolder {
  id: string;
  name: string;
  via: "group" | "direct";
  group_id?: number;
  group_name?: string;
}

export interface PermissionAssignments {
  groups: PermissionAssignmentGroup[];
  users: PermissionAssignmentUser[];
  /** Legacy full payload — avoid loading in UI. */
  permission_users?: Record<string, PermissionHolder[]>;
  /** Lightweight counts keyed by permission id. */
  permission_holder_counts?: Record<string, number>;
}

export async function fetchPermissionAssignments(options?: { includeHolders?: boolean }) {
  const { data } = await api.get<PermissionAssignments>("/accounts/groups/permission-assignments/", {
    params: options?.includeHolders ? { include_holders: 1 } : undefined,
  });
  return data;
}

export async function fetchPermissionHolders(permissionId: number) {
  const { data } = await api.get<{ holders: PermissionHolder[] }>(
    "/accounts/groups/permission-holders/",
    { params: { permission_id: permissionId } },
  );
  return data.holders;
}

export async function fetchGroup(id: number) {
  const { data } = await api.get<GroupDetail>(`/accounts/groups/${id}/`);
  return data;
}

export async function createGroup(payload: CreateGroupPayload) {
  const { data } = await api.post<GroupDetail>("/accounts/groups/", payload);
  return data;
}

export async function updateGroup(id: number, payload: UpdateGroupPayload) {
  const { data } = await api.patch<GroupDetail>(`/accounts/groups/${id}/`, payload);
  return data;
}

export async function deleteGroup(id: number) {
  await api.delete(`/accounts/groups/${id}/`);
}

export async function fetchAllPermissions(search = "") {
  const { data } = await api.get<PaginatedResponse<PermissionItem>>("/accounts/permissions/", {
    params: { page: 1, page_size: 2000, search: search || undefined },
  });
  return data.results;
}

export async function fetchPermissions(page: number, search: string) {
  const { data } = await api.get<PaginatedResponse<PermissionItem>>("/accounts/permissions/", {
    params: { page, search: search || undefined, page_size: ACCOUNTS_PAGE_SIZE },
  });
  return data;
}

export async function fetchQeybs() {
  const { data } = await api.get<PaginatedResponse<QeybItem>>("/accounts/departments/", {
    params: { page_size: 200 },
  });
  return data.results ?? [];
}

export async function createQeyb(payload: QeybPayload) {
  const { data } = await api.post<QeybItem>("/accounts/departments/", payload);
  return data;
}

export async function updateQeyb(id: number, payload: QeybPayload) {
  const { data } = await api.patch<QeybItem>(`/accounts/departments/${id}/`, payload);
  return data;
}

export async function deleteQeyb(id: number) {
  await api.delete(`/accounts/departments/${id}/`);
}

export interface UserTypeItem {
  id: number;
  name: string;
  code: string;
}

export async function fetchUserTypes() {
  const { data } = await api.get<PaginatedResponse<UserTypeItem>>("/accounts/types/", {
    params: { page_size: 200 },
  });
  return data.results ?? [];
}

export async function fetchCounties() {
  const { data } = await api.get<PaginatedResponse<LookupItem>>("/accounts/counties/", {
    params: { page_size: 500 },
  });
  return data.results;
}

export async function fetchSubCounties(countyId: number) {
  const { data } = await api.get<PaginatedResponse<LookupItem>>("/accounts/sub-counties/", {
    params: { page_size: 500, county: countyId },
  });
  return data.results;
}
