"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/lib/auth-api";
import type { User } from "@/types";
import {
  accountKeys,
  adminResetPassword,
  adminResetPin,
  assignUserGroups,
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  fetchAllGroups,
  fetchAllPermissions,
  fetchAllUsers,
  fetchCounties,
  fetchUserTypes,
  fetchQeybs,
  createQeyb,
  updateQeyb,
  deleteQeyb,
  fetchGroup,
  fetchPermissionAssignments,
  fetchPermissionHolders,
  fetchStaffCheck,
  fetchUsersForPicker,
  fetchUser,
  fetchUserDevices,
  fetchUsers,
  fetchUserStats,
  fetchUserControlDashboard,
  testMobileLogin,
  updateGroup,
  updateUser,
  updateUserStatus,
  ACCOUNTS_PAGE_SIZE,
  type PermissionAssignments,
  type UsersParams,
} from "@/lib/accounts-api";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/components/ui/use-toast";
import { STALE_LIST_MS, STALE_LOOKUP_MS, STALE_PERMISSIONS_MS, STALE_STATS_MS } from "@/lib/query-config";
import type { CreateGroupPayload, CreateUserPayload, QeybPayload, UpdateGroupPayload, UpdateUserPayload, UserStatusPayload } from "@/types/accounts";

function filtersKey(params: UsersParams) {
  return {
    county: params.county ?? "",
    role: params.role ?? "",
    is_staff: params.is_staff ?? "",
  };
}

export function useUsers(params: UsersParams) {
  return useQuery({
    queryKey: accountKeys.users(params.page, params.search, filtersKey(params), params.pageSize ?? ACCOUNTS_PAGE_SIZE),
    queryFn: () => fetchUsers(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: accountKeys.user(id ?? ""),
    queryFn: () => fetchUser(id!),
    enabled: !!id,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useStaffCheck(id: string | null) {
  return useQuery({
    queryKey: accountKeys.staffCheck(id ?? ""),
    queryFn: () => fetchStaffCheck(id!),
    enabled: !!id,
    staleTime: STALE_LIST_MS,
  });
}

export function useUserDevices(id: string | null) {
  return useQuery({
    queryKey: accountKeys.devices(id ?? ""),
    queryFn: () => fetchUserDevices(id!),
    enabled: !!id,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: accountKeys.stats,
    queryFn: fetchUserStats,
    staleTime: STALE_STATS_MS,
  });
}

export function useUserControlDashboard(enabled = true) {
  return useQuery({
    queryKey: accountKeys.dashboard,
    queryFn: fetchUserControlDashboard,
    staleTime: STALE_STATS_MS,
    enabled,
  });
}

export function useCounties() {
  return useQuery({
    queryKey: accountKeys.counties,
    queryFn: fetchCounties,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useUserTypes() {
  return useQuery({
    queryKey: accountKeys.userTypes,
    queryFn: fetchUserTypes,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useQeybs() {
  return useQuery({
    queryKey: accountKeys.qeybs,
    queryFn: fetchQeybs,
    staleTime: STALE_LIST_MS,
  });
}

export function useCreateQeyb() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QeybPayload) => createQeyb(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.qeybs });
      toast({ title: "Qeebta waa la abuuray" });
    },
    onError: () => toast({ title: "Qeebta lama abuurin", variant: "destructive" }),
  });
}

export function useUpdateQeyb() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: QeybPayload }) => updateQeyb(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.qeybs });
      toast({ title: "Qeebta waa la cusbooneysiiyay" });
    },
    onError: () => toast({ title: "Qeebta lama kaydin", variant: "destructive" }),
  });
}

export function useDeleteQeyb() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteQeyb(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.qeybs });
      toast({ title: "Qeebta waa la tirtiray" });
    },
    onError: () => toast({ title: "Qeebta lama tirtirin", variant: "destructive" }),
  });
}

export function useAllGroups() {
  return useQuery({
    queryKey: accountKeys.groups,
    queryFn: fetchAllGroups,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function usePermissionAssignments() {
  return useQuery<PermissionAssignments>({
    queryKey: accountKeys.permissionAssignments,
    queryFn: () => fetchPermissionAssignments(),
    staleTime: STALE_PERMISSIONS_MS,
  });
}

export function usePermissionHolders(permissionId: number | null) {
  return useQuery({
    queryKey: accountKeys.permissionHolders(permissionId ?? 0),
    queryFn: () => fetchPermissionHolders(permissionId!),
    enabled: permissionId != null,
    staleTime: STALE_PERMISSIONS_MS,
  });
}

export function useAllUsers(search = "") {
  return useQuery({
    queryKey: accountKeys.usersAll(search),
    queryFn: () => fetchAllUsers(search),
    staleTime: STALE_LIST_MS,
  });
}

export function useUsersForPicker(search = "") {
  return useQuery({
    queryKey: accountKeys.usersPicker(search),
    queryFn: () => fetchUsersForPicker(search),
    staleTime: STALE_LIST_MS,
  });
}

export function useAllPermissions(search = "") {
  return useQuery({
    queryKey: accountKeys.permissionsAll(search),
    queryFn: () => fetchAllPermissions(search),
    staleTime: STALE_PERMISSIONS_MS,
  });
}

export function useGroup(id: number | null) {
  return useQuery({
    queryKey: accountKeys.group(id ?? 0),
    queryFn: () => fetchGroup(id!),
    enabled: id !== null,
    staleTime: STALE_LOOKUP_MS,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => createGroup(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "Group created" });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { name?: string[]; detail?: string } } };
      toast({
        title: "Create failed",
        description: err.response?.data?.name?.[0] ?? err.response?.data?.detail ?? "Could not create group.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateGroup(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateGroupPayload) => updateGroup(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "Group updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "Group deleted" });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "User created" });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: Record<string, string[] | string>; status?: number } };
      const data = err.response?.data;
      const detail = typeof data?.detail === "string" ? data.detail : undefined;
      const fieldMsg = data
        ? Object.entries(data)
            .filter(([k]) => k !== "detail")
            .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
            .find(Boolean)
        : undefined;
      toast({
        title: err.response?.status === 403 ? "Permission denied" : "Create failed",
        description:
          detail ??
          fieldMsg ??
          (err.response?.status === 403
            ? "Only administrators can create users."
            : "Could not create user."),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      if (variables.profile instanceof File || data.profile_url) {
        queryClient.setQueryData<User>(authKeys.me, (old) => {
          if (!old || old.id !== data.id) return old;
          return { ...old, profile_url: data.profile_url ?? old.profile_url };
        });
        queryClient.invalidateQueries({ queryKey: authKeys.me });
      }
      toast({ title: "User updated" });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast({
        title: "Update failed",
        description: err.response?.data?.detail ?? "Could not update user.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UserStatusPayload & { id: string }) => updateUserStatus(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "Status updated" });
    },
  });
}

export function useAssignGroups(id: string) {
  const queryClient = useQueryClient();
  const { user: me, sync } = usePermissions();
  return useMutation({
    mutationFn: (group_ids: number[]) => assignUserGroups(id, group_ids),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.permissionAssignments });
      if (id === me?.id && sync) await sync();
      toast({ title: "Groups updated" });
    },
  });
}

export function useAdminResetPassword(id: string) {
  return useMutation({
    mutationFn: (new_password: string) => adminResetPassword(id, new_password),
    onSuccess: () => toast({ title: "Password reset" }),
    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
  });
}

export function useAdminResetPin(id: string) {
  return useMutation({
    mutationFn: (new_pin: string) => adminResetPin(id, new_pin),
    onSuccess: () => toast({ title: "PIN reset" }),
    onError: () => toast({ title: "PIN reset failed", variant: "destructive" }),
  });
}

/** Isticmalaayasha / v2 parity: reset app PIN to hashed 0000. */
export function useResetAppPinToDefault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminResetPin(userId, "0000"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: "App PIN reset to 0000" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "PIN reset failed", variant: "destructive" });
    },
  });
}

export function useTestMobileLogin(id: string) {
  return useMutation({
    mutationFn: (password?: string) => testMobileLogin(id, password),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast({ title: "User deleted" });
    },
  });
}
