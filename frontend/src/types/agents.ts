import type { PaginatedResponse } from "@/types/accounts";

export interface AgentSummary {
  id: string;
  user_id: number | null;
  user_email: string | null;
  user_username: string | null;
  user_is_active: boolean;
  user_role: string;
  profile_url: string | null;
  service_id: string | null;
  personal_number: string | null;
  personal_fullname: string;
  first_name: string;
  father_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: string;
  present: string;
  county: string | null;
  county_name: string | null;
  directorate: string | null;
  directorate_name: string | null;
  created_at: string;
}

export interface AgentAppUser extends AgentSummary {
  nickname: string | null;
  full_name: string;
  password_changed: boolean;
  has_app_pin: boolean;
  app_pin_changed: boolean;
  last_login: string | null;
  last_login_relative: string;
  days_since_login: number | null;
  activity_status: "active" | "warning" | "inactive" | "never";
  inactive_days: number | null;
  groups: { id: number; name: string }[];
  user_suspend: boolean;
  user_type_name: string | null;
  department_name: string | null;
  app_installed: boolean;
  installation_status: "not_installed" | "completed" | "iphone";
  installation_label: "Loogu shubay" | "iPhone" | "Looguma shubin";
  not_installed_reason: string;
  not_installed_reason_label: string;
  not_installed_reason_detail: string;
  installed_at: string | null;
}

export interface AgentLoginActivityEntry {
  id: number;
  created_at: string;
  relative: string;
  device: string;
  operating_system: string;
  ip_address: string;
  network: string;
}

export interface AgentLoginActivity {
  agent_id: string;
  user_id: number;
  name: string;
  county: string;
  results: AgentLoginActivityEntry[];
}

export interface AgentStaffSearchHit {
  id: string;
  service_id: string;
  name: string;
  nickname: string;
  employee_id: string;
  phone: string;
  email: string;
  county_name: string;
  county_id?: string | null;
  user_id: number | null;
  username?: string | null;
  user_is_active: boolean;
  user_status?: string;
  groups?: { id: number; name: string }[];
  has_user?: boolean;
}

export interface StaffPayrollHit {
  id: number;
  employee_id: string;
  name: string;
  grade: string;
  directorate: string;
  position: string;
  bank?: string;
  account?: string;
  number: string;
  has_agent: boolean;
}

export interface HrmEmployeeHit {
  employee_id: string;
  name: string;
  phone: string;
  status: string;
  position: string;
  department: string;
  is_active: boolean;
}

export interface AgentStaffSearchResult {
  exists: boolean;
  message: string;
  staff_data?: StaffPayrollHit[];
  agents_data?: AgentStaffSearchHit[];
  has_staff?: boolean;
  has_agents?: boolean;
  not_found_terms?: string[];
  agents_only_terms?: { term: string; agents: unknown[] }[];
  staff_needing_agent?: StaffPayrollHit[];
  searched_count?: number;
  found_terms_count?: number;
  staff_terms_matched?: number;
  agents_terms_matched?: number;
  staff_without_agent_count?: number;
  missing_from_staff_count?: number;
  debug?: Record<string, unknown>;
}

export interface AgentHrmSearchResult extends AgentStaffSearchResult {
  configured?: boolean;
  hrm_data?: HrmEmployeeHit[];
  hrm_error?: string | null;
}

export interface CreateFromStaffResult {
  success: boolean;
  message: string;
  id: string;
  service_id: string | null;
  username: string;
  user_id: number;
  email: string;
  phone: string;
}

export interface BulkResetPasswordsResult {
  success: boolean;
  reset_count: number;
  skipped: { username: string; reason: string }[];
  county_name: string;
  message: string;
}

export interface AgentEligibleUser {
  id: number;
  email: string;
  username: string;
  full_name: string;
  phone: string;
}

export interface CreateAgentPayload {
  user?: number;
  password?: string;
  username?: string;
  first_name: string;
  father_name: string;
  last_name: string;
  fourth_name: string;
  mother_name: string;
  phone: string;
  date_of_birth: string;
  email?: string;
  county?: number | null;
  user_type?: number | null;
  department?: number | null;
}

export interface AgentUserLocation {
  latitude: string;
  longitude: string;
  location: string;
  county_name: string | null;
}

export interface AgentDetail extends AgentSummary {
  fourth_name: string;
  mother_name: string;
  nickname: string | null;
  date_of_birth: string;
  gender: string | null;
  biography: string | null;
  weapon_name: string | null;
  serial_number: string | null;
  tribe_name: string | null;
  region_name: string | null;
  sub_county_name: string | null;
  section_name: string | null;
  profile_url: string | null;
  user_location: AgentUserLocation;
  access_count: number;
  relatives_count: number;
  files_count: number;
  captured_suspects_count: number;
  updated_at: string;
  user_type: number | null;
  user_type_name: string | null;
  department: number | null;
  department_name: string | null;
}

export interface AgentCapturedSuspect {
  id: number;
  name: string;
  alias: string;
  photo: string;
  district: string;
  case_ref: string;
  status: string;
  risk: string;
  suspect_type_name?: string | null;
  last_seen: string;
  offense: string;
}

export interface AgentAccessRecord {
  id: string;
  reference_number: string;
  access_location: string;
  relationship_type: string;
  joined_at: string;
  training: string;
  training_location: string;
  role_held: string;
  occupation: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_email: string;
  referrer_role: string;
  notes: string;
  created_at: string;
}

export interface AgentRelative {
  id: string;
  full_name: string;
  relationship: string;
  district: string;
  phone: string;
  description: string;
  created_at: string;
}

export interface AgentFile {
  id: string;
  file_name: string;
  file_code: string;
  file_url: string | null;
  created_at: string;
}

export type { PaginatedResponse };
