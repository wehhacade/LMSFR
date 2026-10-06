import api from "@/lib/axios";
import type {
  AgentImportSummary,
  AgentMergeResult,
  AgentPersonnelSummary,
  AgentRestriction,
  AgentTransfer,
  AttendanceSession,
  AttendanceSessionAgents,
  AttendanceSectionOpenResult,
  DistrictManagementRow,
  PersonnelDashboard,
  ReferenceStatus,
  ReportResult,
  RestrictionAlerts,
  SectionSummaryRow,
} from "@/types/personnel";

export const personnelKeys = {
  all: ["personnel"] as const,
  dashboard: () => ["personnel", "dashboard"] as const,
  attendanceSession: (id: number) => ["personnel", "attendance-session", id] as const,
  attendanceSessions: (county?: string, date?: string) =>
    ["personnel", "attendance-sessions", county ?? "", date ?? ""] as const,
  transfers: (agent?: string) => ["personnel", "transfers", agent ?? ""] as const,
  restrictions: (agent?: string) => ["personnel", "restrictions", agent ?? ""] as const,
  agentStatuses: () => ["personnel", "agent-statuses"] as const,
  agentSummary: (agentId: string) => ["personnel", "agent-summary", agentId] as const,
  attendanceStatuses: () => ["personnel", "attendance-statuses"] as const,
  absenceReasons: () => ["personnel", "absence-reasons"] as const,
  reports: (type: string, params: string) => ["personnel", "reports", type, params] as const,
  districts: (page: number) => ["personnel", "districts", page] as const,
  sections: (page: number) => ["personnel", "sections", page] as const,
  restrictionAlerts: () => ["personnel", "restriction-alerts"] as const,
};

export async function fetchPersonnelDashboard() {
  const { data } = await api.get<PersonnelDashboard>("/personnel/dashboard/");
  return data;
}

export async function fetchAgentPersonnelSummary(agentId: string) {
  const { data } = await api.get<AgentPersonnelSummary>(`/personnel/agents/${agentId}/summary/`);
  return data;
}

export async function fetchAgentStatuses() {
  const { data } = await api.get<ReferenceStatus[]>("/personnel/reference/agent-statuses/");
  return data;
}

export async function fetchAttendanceStatuses() {
  const { data } = await api.get<ReferenceStatus[]>("/personnel/reference/attendance-statuses/");
  return data;
}

export async function fetchAbsenceReasons() {
  const { data } = await api.get<ReferenceStatus[]>("/personnel/reference/absence-reasons/");
  return data;
}

export async function openAttendanceSession(payload: {
  county_id: number;
  department_id?: number | null;
  date: string;
  session: string;
  notes?: string;
}) {
  const { data } = await api.post<AttendanceSession>("/personnel/attendance/sessions/", payload);
  return data;
}

export async function openAttendanceSection(payload: {
  department_id: number;
  county_id?: number | null;
  date: string;
  session: string;
  notes?: string;
}) {
  const { data } = await api.post<AttendanceSectionOpenResult>(
    "/personnel/attendance/sessions/open-section/",
    payload,
  );
  return data;
}

export async function fetchAttendanceSessionAgents(sessionId: number, search?: string) {
  const { data } = await api.get<AttendanceSessionAgents>(
    `/personnel/attendance/sessions/${sessionId}/agents/`,
    { params: search ? { search } : undefined },
  );
  return data;
}

export async function bulkRecordAttendance(
  sessionId: number,
  records: { agent_id: number; status_code: string; absence_reason_code?: string; notes?: string }[],
) {
  const { data } = await api.post(`/personnel/attendance/sessions/${sessionId}/bulk-record/`, { records });
  return data;
}

export async function createTransfer(payload: {
  agent_id: number;
  to_county_id: number;
  to_department_id?: number | null;
  reason: string;
  transfer_date: string;
  notes?: string;
}) {
  const { data } = await api.post<AgentTransfer>("/personnel/transfers/transfer/", payload);
  return data;
}

export async function fetchTransfers(agentId?: string) {
  const { data } = await api.get<{ results: AgentTransfer[] }>("/personnel/transfers/", {
    params: agentId ? { agent: agentId } : undefined,
  });
  return data.results ?? data;
}

export async function fetchRestrictions(agentId?: string) {
  const { data } = await api.get<{ results: AgentRestriction[] }>("/personnel/restrictions/", {
    params: agentId ? { agent: agentId } : undefined,
  });
  return data.results ?? data;
}

export async function createRestriction(payload: {
  agent_id: number;
  reason: string;
  start_date: string;
  end_date: string;
  id_card_withheld?: boolean;
  weapon_withheld?: boolean;
  notes?: string;
}) {
  const { data } = await api.post<AgentRestriction>("/personnel/restrictions/", payload);
  return data;
}

export async function releaseRestriction(id: number, notes?: string) {
  const { data } = await api.post<AgentRestriction>(`/personnel/restrictions/${id}/release/`, { notes });
  return data;
}

export async function importAgentRoster(file: File, dryRun: boolean, departmentScope?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("dry_run", dryRun ? "true" : "false");
  if (departmentScope) form.append("department_scope", departmentScope);
  const { data } = await api.post<AgentImportSummary>("/personnel/import/upload/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function mergeImportConflictAgents(payload: {
  agent_ids: number[];
  excel_service_id?: string;
  preferred_phone?: string;
}) {
  const { data } = await api.post<AgentMergeResult>("/personnel/import/merge-conflict/", payload);
  return data;
}

type ReportParams = Record<string, string | undefined>;

async function fetchReport(type: string, params: ReportParams = {}) {
  const { data } = await api.get<ReportResult>(`/personnel/reports/${type}/`, { params });
  return data;
}

export async function fetchAgentReport(params: ReportParams) {
  return fetchReport("agents", params);
}

export async function fetchAttendanceReport(params: ReportParams) {
  return fetchReport("attendance", params);
}

export async function fetchTransferReport(params: ReportParams) {
  return fetchReport("transfers", params);
}

export async function fetchRestrictionReport(params: ReportParams) {
  return fetchReport("restrictions", params);
}

export async function fetchDistrictSummaryReport() {
  return fetchReport("district-summary");
}

export async function fetchSectionSummaryReport() {
  const { data } = await api.get<ReportResult>("/personnel/reports/section-summary/");
  return data;
}

export async function fetchRestrictionAlerts() {
  const { data } = await api.get<RestrictionAlerts>("/personnel/reports/restriction-alerts/");
  return data;
}

export async function exportReportXlsx(type: string, params: ReportParams = {}) {
  const response = await api.get(`/personnel/reports/${type}/`, {
    params: { ...params, export: "xlsx" },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${type}-report.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchDistrictManagement(page = 1) {
  const { data } = await api.get<{ results: DistrictManagementRow[]; count: number }>("/personnel/districts/", {
    params: { page },
  });
  return data;
}

export interface SectionManagementRow {
  id: number;
  name: string;
  district_count: number;
  districts: string[];
  total_agents: number;
  active_agents: number;
  restricted_agents: number;
  present_today: number;
  attendance_pct: number;
}

export async function fetchSectionManagement(page = 1) {
  const { data } = await api.get<{ results: SectionManagementRow[]; count: number }>("/personnel/sections/", {
    params: { page },
  });
  return data;
}
