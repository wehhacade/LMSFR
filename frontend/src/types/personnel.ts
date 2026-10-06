export interface PersonnelDashboard {
  date: string;
  total_agents: number;
  present_today: number;
  absent_today: number;
  excused_today: number;
  status_counts: Record<string, number>;
  district_stats: DistrictStat[];
  active_restrictions: number;
  restriction_alerts?: RestrictionAlerts;
}

export interface RestrictionAlerts {
  expired: number;
  expiring_today: number;
  expiring_within_7_days: number;
  items: {
    id: number;
    agent__service_id: string;
    agent__personal_fullname: string;
    end_date: string;
    reason: string;
    status: string;
  }[];
}

export interface ReportResult {
  total: number;
  rows: Record<string, string | number | boolean>[];
}

export interface DistrictManagementRow {
  id: number;
  name: string;
  region_name: string;
  departments: string[];
  total_agents: number;
  active_agents: number;
  restricted_agents: number;
  present_today: number;
  attendance_pct: number;
}

export interface SectionSummaryRow {
  department_id: number;
  department_name: string;
  district_count: number;
  total_agents: number;
  present_today: number;
  attendance_pct: number;
  districts: string[];
}

export interface DistrictStat {
  county_id: number;
  county_name: string;
  total_agents: number;
  present_today: number;
  attendance_pct: number;
}

export interface AttendanceSession {
  id: number;
  county: number;
  county_name: string;
  department: number | null;
  department_name: string | null;
  date: string;
  session: string;
  notes: string;
  record_count?: number;
}

export interface AttendanceAgentRow {
  agent_id: number;
  session_id?: number;
  county_id?: number;
  county_name?: string;
  service_id: string;
  service_id_last4: string;
  name: string;
  phone: string;
  status_name: string;
  attendance: AttendanceRecord | null;
}

export interface AttendanceSectionOpenResult {
  department_id: number;
  department_name: string;
  scope: "section" | "district";
  date: string;
  session: string;
  sessions: AttendanceSession[];
  agents: AttendanceAgentRow[];
}

export interface AttendanceRecord {
  id: number;
  status_code: string;
  status_name: string;
  absence_reason_name?: string;
  absence_reason_code?: string;
  notes?: string;
}

export interface AttendanceSessionAgents {
  session: AttendanceSession;
  agents: AttendanceAgentRow[];
}

export interface ImportMissingPreview {
  service_id: string;
  name: string;
  phone: string;
  nickname: string;
  district: string | null;
  department: string | null;
  action: string;
}

export interface AgentImportSummary {
  dry_run: boolean;
  total_rows: number;
  new_agents?: number;
  existing_agents?: number;
  district_changes?: number;
  duplicate_records?: number;
  invalid_records?: number;
  missing_from_excel?: number;
  additional_in_excel?: number;
  section_db_total?: number;
  matched_in_section?: number;
  matched_outside_section?: number;
  conflicts?: number;
  ready_to_apply?: boolean;
  source_section: string;
  district_breakdown?: Record<string, number>;
  section_hq_count?: number;
  released_from_section?: number;
  preview_total?: number;
  preview_shown?: number;
  preview_truncated?: boolean;
  changes_preview?: ImportChangePreview[];
  missing_preview?: ImportMissingPreview[];
  batch_id?: number;
  created?: number;
  updated?: number;
  transferred?: number;
  released?: number;
}

export interface ImportConflictAgent {
  id: number;
  service_id: string;
  nickname: string;
  phone: string;
  name: string;
  match_method: string;
  district: string | null;
  department: string | null;
}

export interface AgentMergeResult {
  primary_agent: ImportConflictAgent;
  merged_agent_ids: number[];
}

export interface ImportChangePreview {
  service_id: string;
  name: string;
  action: string;
  errors: string[];
  diff: Record<string, unknown>;
}

export interface AgentTransfer {
  id: number;
  agent: number;
  agent_name: string;
  agent_service_id: string;
  from_county_name: string | null;
  to_county_name: string | null;
  reason: string;
  transfer_date: string;
  notes: string;
  created_at: string;
}

export interface AgentRestriction {
  id: number;
  agent: number;
  agent_name: string;
  agent_service_id: string;
  reason: string;
  start_date: string;
  end_date: string;
  id_card_status: string;
  weapon_status: string;
  status: string;
  notes: string;
}

export interface AgentPersonnelSummary {
  agent_id: number;
  service_id: string;
  service_id_last4: string;
  attendance: {
    present_count: number;
    absent_count: number;
    total_records: number;
    attendance_rate: number;
    recent: {
      id: number;
      recorded_at: string;
      status__name: string;
      status__code: string;
      absence_reason__name: string | null;
      county__name: string | null;
      notes: string;
    }[];
  };
  transfers: {
    id: number;
    transfer_date: string;
    reason: string;
    notes: string;
    from_county__name: string | null;
    to_county__name: string | null;
    created_at: string;
  }[];
  restrictions: {
    id: number;
    reason: string;
    start_date: string;
    end_date: string;
    status: string;
    id_card_status: string;
    weapon_status: string;
    notes: string;
  }[];
  status_history: {
    id: number;
    created_at: string;
    reason: string;
    notes: string;
    old_status__name: string | null;
    new_status__name: string | null;
  }[];
}

export interface ReferenceStatus {
  id: number;
  code: string;
  name: string;
  name_so?: string;
}
