import type { PaginatedResponse } from "@/types/accounts";

export type AuditEventType =
  | "click"
  | "visit"
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "other";

export interface AuditUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
}

export interface AuditTrail {
  id: string;
  user: AuditUser | null;
  event_type: AuditEventType;
  action: string;
  submodule: string;
  module: string;
  page: string;
  click_target: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  operating_system: string;
  browser: string;
  network: string;
  path: string;
  method: string;
  created_at: string;
}

export interface ErrorLogItem {
  id: string;
  user_email: string | null;
  expected_error: string;
  field_error: string;
  line_number: string;
  ip_address: string | null;
  path: string;
  method: string;
  status_code: number | null;
  created_at: string;
}

export interface ErrorLogDetail extends ErrorLogItem {
  trace_back: string;
  user_agent: string;
}

export interface APITrafficItem {
  id: string;
  user_email: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip_address: string | null;
  created_at: string;
}

export interface AuditStats {
  audits_today: number;
  errors_today: number;
  traffic_today: number;
  total_audits: number;
}

export type { PaginatedResponse };
