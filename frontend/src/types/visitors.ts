export interface VisitDestination {
  id: number;
  name: string;
}

export interface VisitAllegation {
  id: number;
  name: string;
}

export interface VisitHistoryItem {
  id: number;
  visiting: string;
  contact_name: string;
  relationship: string;
  allegation_id: number | null;
  allegation_name: string | null;
  sentence: string;
  visited_at: string;
  verified: boolean;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface Visitor {
  id: number;
  full_name: string;
  mother_name: string;
  gender: string;
  phone: string;
  nira: string;
  visited_at: string;
  verified: boolean;
  visiting?: string | null;
  contact_name?: string | null;
  relationship?: string | null;
  allegation_id?: number | null;
  allegation_name?: string | null;
  sentence?: string | null;
  visit_count?: number;
  is_returning?: boolean;
  message?: string | null;
  image_url: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  visits?: VisitHistoryItem[];
}

export interface VisitorWritePayload {
  full_name: string;
  mother_name?: string;
  gender?: string;
  phone?: string;
  nira?: string;
  visited_at?: string;
  verified?: boolean;
  visiting: string;
  contact_name?: string;
  relationship?: string;
  allegation_id?: number | null;
  sentence?: string;
  notes?: string;
  image?: File | null;
}

export interface PaginatedVisitors {
  count: number;
  next: string | null;
  previous: string | null;
  results: Visitor[];
}

export interface VisitorsStats {
  total: number;
  today: number;
  this_week: number;
  verified: number;
  with_photo: number;
  with_nira: number;
  deltas: {
    today?: { pct: number; up: boolean };
  };
}

export interface VisitorsAnalytics {
  weekly_trend: { date: string; label: string; count: number }[];
  status_breakdown: { label: string; count: number; pct: number; color: string }[];
  breakdown: { key: string; label: string; pct: number }[];
  top_registrars: { id: number; name: string; count: number }[];
  top_visitors: { id: number; name: string; count: number }[];
  top_destinations: { name: string; count: number }[];
  recent_activity: {
    id: number;
    name: string;
    phone: string;
    nira: string;
    verified: boolean;
    visited_at: string | null;
    registered_by: string | null;
    color: string;
  }[];
}
