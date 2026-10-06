export interface AmnigaDelta {
  pct: number;
  up: boolean;
}

export interface AmnigaStats {
  active_patrols: number;
  incidents_today: number;
  guards_on_duty: number;
  daily_reports: number;
  deltas: {
    active_patrols: AmnigaDelta | null;
    incidents_today: AmnigaDelta | null;
    guards_on_duty: AmnigaDelta | null;
    daily_reports: AmnigaDelta | null;
  };
}

export interface AmnigaTrendPoint {
  date: string;
  label: string;
  count: number;
}

export interface AmnigaBreakdownItem {
  key: string;
  label: string;
  pct: number;
}

export interface AmnigaStatusSegment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface AmnigaNamedTotal {
  name: string;
  total: number;
}

export interface AmnigaRecentActivity {
  id: number;
  kind: "force" | "suspect" | "agent" | "app_login" | "web_login";
  unit: string;
  zone: string;
  name: string;
  status: string;
  color: string;
  created_at?: string | null;
  profile_url?: string | null;
  device?: string | null;
  os_name?: string | null;
  client?: "mobile" | "web" | string | null;
  user_id?: number | null;
}

export interface AmnigaCountyChartRow {
  name: string;
  suspects: number;
  agents: number;
  users: number;
}

export interface AmnigaTopRegistrar {
  id: number;
  name: string;
  phone: string;
  county_name: string;
  total: number;
}

export interface AmnigaUserActivitySummary {
  total_users: number;
  active_users: number;
  logged_today: number;
  never_login: number;
  total_suspects: number;
}

export interface AmnigaAnalytics {
  weekly_trend: AmnigaTrendPoint[];
  daily_trend: AmnigaTrendPoint[];
  breakdown: AmnigaBreakdownItem[];
  force_status_breakdown: AmnigaStatusSegment[];
  suspect_status_breakdown: AmnigaStatusSegment[];
  suspects_by_district: AmnigaNamedTotal[];
  forces_by_unit: AmnigaNamedTotal[];
  counties_chart: AmnigaCountyChartRow[];
  top_registrars: AmnigaTopRegistrar[];
  user_activity_summary: AmnigaUserActivitySummary;
  recent_activity: AmnigaRecentActivity[];
}

export interface AmnigaDailyReportSummary {
  suspects_registered: number;
  damiin_created: number;
  capture_districts: number;
}

export interface AmnigaRegistrarRow {
  id: number;
  name: string;
  phone: string;
  total: number;
}

export interface AmnigaFeedItem {
  id: number;
  author_name: string;
  body?: string;
  details?: string;
  suspect_id: number;
  suspect_name: string;
  created_at: string;
}

export interface AmnigaRepeatOffender {
  id: number;
  name: string;
  mother_name: string;
  phone: string;
  district: string;
  status: string;
  tuhunka: string;
  case_count: number;
  bail_count: number;
}

export interface AmnigaDistrictActivityRow {
  id: number;
  name: string;
  region: string;
  suspects: number;
  capture: number;
  residence: number;
  share_pct: number;
  active_users: number;
  total_users: number;
}

export interface AmnigaDailyReport {
  date: string;
  date_from?: string;
  date_to?: string;
  district: string;
  summary: AmnigaDailyReportSummary;
  district_activity?: AmnigaDistrictActivityRow[];
  capture_by_district: AmnigaNamedTotal[];
  residence_by_district: AmnigaNamedTotal[];
  top_registrars: AmnigaRegistrarRow[];
  latest_comments: AmnigaFeedItem[];
  latest_responses: AmnigaFeedItem[];
  repeat_offenders: AmnigaRepeatOffender[];
}

export interface AmnigaDistrictProfileRegistrar {
  id: number;
  name: string;
  phone: string;
  county_name: string;
  total: number;
  last_login: string | null;
  is_active: boolean;
}

export interface AmnigaDistrictOfficer {
  id: number;
  name: string;
  phone: string;
  last_login: string | null;
  is_active: boolean;
  period_registrations: number;
  district_registrations: number;
}

export interface AmnigaDistrictStatusSlice {
  key: string;
  label: string;
  total: number;
  pct: number;
  color: string;
}

export interface AmnigaDistrictTrendPoint {
  date: string;
  total: number;
}

export interface AmnigaDistrictRecentSuspect {
  id: number;
  name: string;
  mother_name: string;
  phone: string;
  status: string;
  tuhunka: string;
  created_at: string;
  registrar_name: string;
}

export interface AmnigaDistrictProfile {
  date_from: string;
  date_to: string;
  district: {
    id: number;
    name: string;
    region: string;
  };
  summary: {
    suspects_registered: number;
    capture_count: number;
    residence_count: number;
    damiin_created: number;
    share_pct: number;
    registrar_count: number;
    active_users: number;
    total_users: number;
  };
  status_breakdown: AmnigaDistrictStatusSlice[];
  trend: AmnigaDistrictTrendPoint[];
  trend_grain: "day" | "month";
  top_registrars: AmnigaDistrictProfileRegistrar[];
  assigned_officers: AmnigaDistrictOfficer[];
  recent_suspects: AmnigaDistrictRecentSuspect[];
}

export interface AmnigaUserReportRow {
  no: number;
  id: number;
  name: string;
  email: string;
  gender: string;
  phone: string;
  county_name: string;
  mobile_type: string;
  suspects_registered: number;
  last_login: string | null;
  today_login: number;
  is_active: boolean;
}

export interface AmnigaUserReports {
  count: number;
  page: number;
  page_size: number;
  total_users: number;
  total_suspects: number;
  mobile_breakdown: AmnigaNamedTotal[];
  status_breakdown: AmnigaNamedTotal[];
  activity_breakdown: AmnigaNamedTotal[];
  results: AmnigaUserReportRow[];
}

export interface AmnigaDistrictTaskRow {
  no: number;
  id: number;
  name: string;
  region?: string;
  suspects: number;
  capture?: number;
  residence?: number;
  share_pct?: number;
  active_users: number;
  inactive_users: number;
  total_users: number;
}

export interface AmnigaDistrictTasks {
  count: number;
  page: number;
  page_size: number;
  date_from?: string;
  date_to?: string;
  total_suspects: number;
  total_users: number;
  active_users: number;
  results: AmnigaDistrictTaskRow[];
}

export interface AmnigaTrackUser {
  id: number;
  user_code: string;
  id_last4: string;
  name: string;
  phone: string;
  county_name: string;
  has_track: boolean;
  track_count?: number;
  has_gps?: boolean;
  on_duty?: boolean;
  in_field?: boolean;
  present?: string;
  last_seen?: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
}

export interface AmnigaTrackMarker {
  id: number;
  user_code: string;
  id_last4?: string;
  name: string;
  county_name: string;
  on_duty: boolean;
  in_field: boolean;
  track_count?: number;
  last_seen: string | null;
  latitude: number;
  longitude: number;
}

export interface AmnigaTrackPoint {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface AmnigaUserTrackMap {
  hours: number;
  selected_user_id: number | null;
  selected_user_ref?: string | null;
  selected_denied?: boolean;
  search_denied?: boolean;
  users: AmnigaTrackUser[];
  markers?: AmnigaTrackMarker[];
  points: AmnigaTrackPoint[];
  summary: {
    point_count: number;
    latest_at: string | null;
    agents_total?: number;
    agents_on_duty?: number;
    agents_with_gps?: number;
    agents_in_field?: number;
  };
}
