"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_LIST_MS } from "@/lib/query-config";
import {
  addAgentAccess,
  addAgentFile,
  addAgentRelative,
  agentKeys,
  bulkResetAgentPasswords,
  createAgent,
  fetchAgent,
  fetchAgentAccess,
  fetchAgentCapturedSuspects,
  fetchAgentEligibleUsers,
  fetchAgentFiles,
  fetchAgentLoginActivity,
  fetchAgentRelatives,
  fetchAgents,
  fetchAppUsers,
  fetchAppUsageReport,
  resetAgentPasswordToPhone,
  searchAgentHrm,
  searchAgentStaff,
  changeAgentCounty,
  createAgentFromStaff,
  updateAgent,
  updateAgentRelative,
  type AgentsListParams,
  type AppUsersListParams,
} from "@/lib/agents-api";
import type { CreateAgentPayload } from "@/types/agents";
import { toast } from "@/components/ui/use-toast";

export function useAgents(params: AgentsListParams) {
  return useQuery({
    queryKey: agentKeys.list(params),
    queryFn: () => fetchAgents(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useAppUsers(params: AppUsersListParams) {
  return useQuery({
    queryKey: agentKeys.appUsers(params),
    queryFn: () => fetchAppUsers(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useAppUsageReport(params?: {
  county?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: agentKeys.appUsageReport(params),
    queryFn: () => fetchAppUsageReport(params),
    staleTime: STALE_LIST_MS,
  });
}

export function useAgentLoginActivity(id: string | null) {
  return useQuery({
    queryKey: agentKeys.loginActivity(id ?? ""),
    queryFn: () => fetchAgentLoginActivity(id!),
    enabled: !!id,
    staleTime: STALE_LIST_MS,
  });
}

export function useBulkResetAgentPasswords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkResetAgentPasswords,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: res.message || "Passwords reset" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Bulk reset failed", variant: "destructive" });
    },
  });
}

export function useResetAgentPasswordToPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => resetAgentPasswordToPhone(agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Password reset to phone" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Reset failed", variant: "destructive" });
    },
  });
}

export function useSearchAgentStaff() {
  return useMutation({ mutationFn: searchAgentStaff });
}

export function useSearchAgentHrm() {
  return useMutation({ mutationFn: searchAgentHrm });
}

export function useCreateAgentFromStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAgentFromStaff,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: res.message || "Agent created" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Create agent failed", variant: "destructive" });
    },
  });
}

export function useChangeAgentCounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: changeAgentCounty,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: res.message || "County updated" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Change county failed", variant: "destructive" });
    },
  });
}

export function useAgent(id: string | null) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? ""),
    queryFn: () => fetchAgent(id!),
    enabled: !!id,
  });
}

export function useAgentAccess(id: string | null) {
  return useQuery({
    queryKey: agentKeys.access(id ?? ""),
    queryFn: () => fetchAgentAccess(id!),
    enabled: !!id,
  });
}

export function useAgentRelatives(id: string | null) {
  return useQuery({
    queryKey: agentKeys.relatives(id ?? ""),
    queryFn: () => fetchAgentRelatives(id!),
    enabled: !!id,
  });
}

export function useAgentFiles(id: string | null) {
  return useQuery({
    queryKey: agentKeys.files(id ?? ""),
    queryFn: () => fetchAgentFiles(id!),
    enabled: !!id,
  });
}

export function useAgentCapturedSuspects(id: string | null, page = 1, enabled = true, pageSize = 10) {
  return useQuery({
    queryKey: agentKeys.capturedSuspects(id ?? "", page, pageSize),
    queryFn: () => fetchAgentCapturedSuspects(id!, page, pageSize),
    enabled: enabled && !!id,
    placeholderData: keepPreviousData,
    staleTime: STALE_LIST_MS,
  });
}

export function useAgentEligibleUsers(search: string, enabled = true) {
  return useQuery({
    queryKey: agentKeys.eligibleUsers(search),
    queryFn: () => fetchAgentEligibleUsers(search),
    enabled,
    staleTime: STALE_LIST_MS,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => createAgent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Agent created" });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const first =
        detail && typeof detail === "object"
          ? Object.values(detail).flat().find((v) => typeof v === "string")
          : null;
      toast({
        title: typeof first === "string" ? first : "Create failed",
        variant: "destructive",
      });
    },
  });
}

export function useAddAgentAccess(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => addAgentAccess(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: agentKeys.access(id) });
      toast({ title: "Access record added" });
    },
  });
}

export function useAddAgentRelative(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => addAgentRelative(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: agentKeys.relatives(id) });
      toast({ title: "Relative added" });
    },
  });
}

export function useUpdateAgentRelative(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      relativeId,
      payload,
    }: {
      relativeId: string;
      payload: Record<string, unknown>;
    }) => updateAgentRelative(agentId, relativeId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
      qc.invalidateQueries({ queryKey: agentKeys.relatives(agentId) });
      toast({ title: "Relative updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
}

export function useUpdateAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData | Record<string, unknown>) => updateAgent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Agent updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
}

export function useAddAgentFile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => addAgentFile(id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: agentKeys.files(id) });
      toast({ title: "File uploaded" });
    },
  });
}
