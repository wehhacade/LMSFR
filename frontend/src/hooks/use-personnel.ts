"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_LIST_MS } from "@/lib/query-config";
import {
  bulkRecordAttendance,
  createRestriction,
  createTransfer,
  fetchAbsenceReasons,
  fetchAgentPersonnelSummary,
  fetchAgentStatuses,
  fetchAttendanceSessionAgents,
  fetchAttendanceStatuses,
  fetchPersonnelDashboard,
  fetchRestrictions,
  fetchDistrictManagement,
  fetchSectionManagement,
  fetchDistrictSummaryReport,
  fetchRestrictionAlerts,
  fetchSectionSummaryReport,
  importAgentRoster,
  mergeImportConflictAgents,
  fetchTransfers,
  exportReportXlsx,
  fetchAgentReport,
  fetchAttendanceReport,
  fetchTransferReport,
  fetchRestrictionReport,
  openAttendanceSession,
  openAttendanceSection,
  personnelKeys,
  releaseRestriction,
} from "@/lib/personnel-api";
import { agentKeys } from "@/lib/agents-api";
import type { ReportResult } from "@/types/personnel";
import { toast } from "@/components/ui/use-toast";

export function usePersonnelDashboard() {
  return useQuery({
    queryKey: personnelKeys.dashboard(),
    queryFn: fetchPersonnelDashboard,
    staleTime: STALE_LIST_MS,
  });
}

export function useAgentStatuses() {
  return useQuery({
    queryKey: personnelKeys.agentStatuses(),
    queryFn: fetchAgentStatuses,
    staleTime: 60_000,
  });
}

export function useAttendanceStatuses() {
  return useQuery({
    queryKey: personnelKeys.attendanceStatuses(),
    queryFn: fetchAttendanceStatuses,
    staleTime: 60_000,
  });
}

export function useAbsenceReasons() {
  return useQuery({
    queryKey: personnelKeys.absenceReasons(),
    queryFn: fetchAbsenceReasons,
    staleTime: 60_000,
  });
}

export function useAttendanceSessionAgents(sessionId: number | null, search?: string) {
  return useQuery({
    queryKey: [...personnelKeys.attendanceSession(sessionId ?? 0), search ?? ""],
    queryFn: () => fetchAttendanceSessionAgents(sessionId!, search),
    enabled: !!sessionId,
    staleTime: 5_000,
  });
}

export function useAgentTransfers(agentId?: string) {
  return useQuery({
    queryKey: personnelKeys.transfers(agentId),
    queryFn: () => fetchTransfers(agentId),
    staleTime: STALE_LIST_MS,
  });
}

export function useAgentRestrictions(agentId?: string) {
  return useQuery({
    queryKey: personnelKeys.restrictions(agentId),
    queryFn: () => fetchRestrictions(agentId),
    staleTime: STALE_LIST_MS,
  });
}

export function useAgentPersonnelSummary(agentId: string | null) {
  return useQuery({
    queryKey: personnelKeys.agentSummary(agentId ?? ""),
    queryFn: () => fetchAgentPersonnelSummary(agentId!),
    enabled: !!agentId,
    staleTime: STALE_LIST_MS,
  });
}

export function useOpenAttendanceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: openAttendanceSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personnelKeys.all });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Failed to open session", variant: "destructive" });
    },
  });
}

export function useOpenAttendanceSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: openAttendanceSection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personnelKeys.all });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Failed to open section attendance", variant: "destructive" });
    },
  });
}

export function useBulkRecordAttendance(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: { agent_id: number; status_code: string; absence_reason_code?: string; notes?: string }[]) =>
      bulkRecordAttendance(sessionId, records),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personnelKeys.attendanceSession(sessionId) });
      qc.invalidateQueries({ queryKey: personnelKeys.dashboard() });
      toast({ title: "Attendance saved" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Failed to save attendance", variant: "destructive" });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: personnelKeys.transfers() });
      qc.invalidateQueries({ queryKey: personnelKeys.agentSummary(String(variables.agent_id)) });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Transfer recorded" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Transfer failed", variant: "destructive" });
    },
  });
}

export function useCreateRestriction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRestriction,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: personnelKeys.restrictions() });
      qc.invalidateQueries({ queryKey: personnelKeys.agentSummary(String(variables.agent_id)) });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Restriction created" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Failed to create restriction", variant: "destructive" });
    },
  });
}

export function useReleaseRestriction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => releaseRestriction(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personnelKeys.restrictions() });
      qc.invalidateQueries({ queryKey: personnelKeys.all });
      qc.invalidateQueries({ queryKey: agentKeys.all });
      toast({ title: "Restriction released" });
    },
  });
}

export function useImportAgentRoster() {
  return useMutation({
    mutationFn: ({ file, dryRun, departmentScope }: { file: File; dryRun: boolean; departmentScope?: string }) =>
      importAgentRoster(file, dryRun, departmentScope),
  });
}

export function useMergeImportConflict() {
  return useMutation({
    mutationFn: mergeImportConflictAgents,
  });
}

export function usePersonnelReport(type: string, params: Record<string, string | undefined>, enabled = true) {
  const key = JSON.stringify(params);
  const fetchers: Record<string, () => Promise<ReportResult>> = {
    agents: () => fetchAgentReport(params),
    attendance: () => fetchAttendanceReport(params),
    transfers: () => fetchTransferReport(params),
    restrictions: () => fetchRestrictionReport(params),
    "district-summary": () => fetchDistrictSummaryReport(),
    "section-summary": () => fetchSectionSummaryReport(),
  };
  return useQuery<ReportResult>({
    queryKey: personnelKeys.reports(type, key),
    queryFn: fetchers[type],
    enabled: enabled && !!fetchers[type],
    staleTime: STALE_LIST_MS,
  });
}

export function useDistrictManagement(page = 1) {
  return useQuery({
    queryKey: personnelKeys.districts(page),
    queryFn: () => fetchDistrictManagement(page),
    staleTime: STALE_LIST_MS,
  });
}

export function useSectionManagement(page = 1) {
  return useQuery({
    queryKey: personnelKeys.sections(page),
    queryFn: () => fetchSectionManagement(page),
    staleTime: STALE_LIST_MS,
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: ({ type, params }: { type: string; params?: Record<string, string | undefined> }) =>
      exportReportXlsx(type, params),
    onSuccess: () => toast({ title: "Report downloaded" }),
    onError: () => toast({ title: "Export failed", variant: "destructive" }),
  });
}
