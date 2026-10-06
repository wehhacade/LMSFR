import type { PaginatedResponse } from "@/types/suspect";

export type UserRole = "admin" | "officer" | "agent" | "user";

export interface AccountUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  county: string | null;
  county_name: string | null;
  profile_url?: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_mobile: boolean;
  is_admin: boolean;
  is_officer: boolean;
  is_agent: boolean;
  suspend: boolean;
  role: UserRole;
  date_joined: string;
}

export interface AccountUserDetail extends AccountUser {
  gender: string | null;
  bio: string | null;
  profile_url: string | null;
  is_superuser: boolean;
  password_changed: boolean;
  app_pin_changed: boolean;
  directorate: string | null;
  directorate_name: string | null;
  department: string | number | null;
  department_name: string | null;
  user_type: string | number | null;
  user_type_name: string | null;
  mobile_type: string | null;
  last_login_device: string | null;
  groups: { id: number; name: string }[];
  permissions: { id: number; name: string; codename: string; app_label: string; model: string }[];
  last_login: string | null;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  admins: number;
  staff: number;
  mobile: number;
}

export interface UserControlDashboard {
  users: {
    total: number;
    active: number;
    suspended: number;
    admins: number;
    officers: number;
    agents: number;
    staff: number;
    mobile: number;
    never_login: number;
    joined_today: number;
    joined_week: number;
  };
  groups_total: number;
  agents_profiles: number;
  audit: {
    audits_today: number;
    errors_today: number;
    traffic_today: number;
    total_audits: number;
    logins_today: number;
    logins_week: number;
  };
  weekly_logins: { date: string; label: string; count: number }[];
  role_breakdown: { key: string; label: string; count: number; pct: number; color: string }[];
  event_breakdown: { key: string; label: string; count: number; pct: number; color: string }[];
  recent_logins: {
    id: number;
    user: string;
    email: string | null;
    county: string | null;
    channel: "mobile" | "web" | string;
    os: string;
    browser: string;
    ip: string | null;
    created_at: string | null;
  }[];
  recent_audits: {
    id: number;
    user: string;
    action: string;
    event_type: string;
    module: string;
    created_at: string | null;
  }[];
  recent_errors: {
    id: number;
    user: string;
    expected_error: string;
    path: string;
    status_code: number | null;
    created_at: string | null;
  }[];
  top_active_users: { id: number; email: string | null; name: string; count: number }[];
  quick_stats: {
    active_pct: number;
    mobile_pct: number;
    staff_pct: number;
    suspended_pct: number;
  };
}

export interface StaffCheck {
  is_staff: boolean;
  is_superuser: boolean;
  is_admin: boolean;
  is_officer: boolean;
  is_agent: boolean;
  is_active: boolean;
  suspend: boolean;
  can_access_admin: boolean;
  role: UserRole;
}

export interface MobileLoginTestResult {
  eligible: boolean;
  is_mobile: boolean;
  password_ok: boolean;
  is_active: boolean;
  suspend: boolean;
  locked: boolean;
  login_attempts: number;
  can_login: boolean;
  detail?: string;
  tested_with?: {
    email: string;
    password: string;
  };
}

export interface BulkMobileLoginTestRow {
  user_id: number;
  name: string;
  email: string;
  last4: string;
  nickname?: string;
  password: string;
  password_is_phone: boolean;
  last4_ok: boolean;
  email_ok: boolean;
  can_login: boolean;
  detail: string;
}

export interface BulkMobileLoginTestResult {
  results: BulkMobileLoginTestRow[];
  ok: number;
  total: number;
}

export interface UserDevice {
  id: string;
  device: string | null;
  action: string | null;
  ip_address: string | null;
  operating_system: string | null;
  browser: string | null;
  created_at: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  permission_count?: number;
}

export interface GroupDetail extends GroupSummary {
  permissions: PermissionItem[];
}

export interface PermissionItem {
  id: number;
  name: string;
  codename: string;
  app_label: string;
  model: string;
}

export interface LookupItem {
  id: string;
  name: string;
}

export interface QeybCounty {
  id: number;
  name: string;
}

export interface QeybTaliye {
  id: number;
  name: string;
  username: string;
  phone: string;
}

export interface QeybItem {
  id: number;
  name: string;
  county_ids: number[];
  counties: QeybCounty[];
  taliye: QeybTaliye | null;
}

export interface QeybPayload {
  name: string;
  county_ids: number[];
  taliye_user_id?: number | null;
}

export interface CreateUserPayload {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  county?: string | null;
  user_type?: number | null;
  department?: number | null;
  profile?: File | null;
  is_admin?: boolean;
  is_officer?: boolean;
  is_agent?: boolean;
  is_active?: boolean;
  is_staff?: boolean;
  is_mobile?: boolean;
  group_ids?: number[];
}

export interface CreateGroupPayload {
  name: string;
  permission_ids?: number[];
}

export interface UpdateGroupPayload {
  name?: string;
  permission_ids?: number[];
}

export interface UpdateUserPayload {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: string;
  bio?: string;
  profile?: File | null;
  county?: string | null;
  user_type?: number | null;
  department?: number | null;
  is_active?: boolean;
  suspend?: boolean;
  is_admin?: boolean;
  is_officer?: boolean;
  is_agent?: boolean;
  is_staff?: boolean;
  is_mobile?: boolean;
  group_ids?: number[];
  permission_ids?: number[];
}

export interface UserStatusPayload {
  is_active?: boolean;
  suspend?: boolean;
}

export type { PaginatedResponse };
