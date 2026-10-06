export type BaarisStats = {
  total_citizens: number;
  registered_today: number;
  active_records: number;
  wanted_total: number;
  this_month: number;
  deltas: Record<string, { pct: number; up: boolean } | null>;
};

export type BaarisAnalytics = {
  weekly_trend: { date: string; label: string; count: number }[];
  daily_trend: { date: string; label: string; count: number }[];
  breakdown: { key: string; label: string; pct: number }[];
  status_breakdown: { label: string; count: number; pct: number; color: string }[];
  counties_chart: { name: string; citizens: number; wanted?: number }[];
  top_registrars: { id: number; name: string; phone: string; county_name: string; total: number }[];
  recent_activity: {
    id: number;
    kind: string;
    name: string;
    zone: string;
    unit: string;
    status: string;
    color: string;
  }[];
  summary: {
    total_citizens: number;
    wanted_total: number;
    registered_today: number;
  };
};

export type BaarisCitizenRow = {
  id: number;
  name: string;
  mother?: string;
  tnumber?: string;
  degmada?: string;
  waaxda?: string;
  xaafadda?: string;
  photo?: string;
  source?: string;
  registered_by?: string;
  created_ago?: string;
  created_at?: string;
  case_ref?: string;
  status?: string;
  gender?: string;
  occupation?: string;
  N_tuhunka?: string;
};

export type WantedRow = {
  id: number;
  full_name: string;
  gender?: string;
  phone?: string;
  mother_name?: string;
  citizenship?: string | null;
  wanted_type?: string | null;
  wanted_status?: string;
  priority?: string;
  details?: string;
  photo_url?: string | null;
  date_recorded?: string | null;
};
