export type SuspectStatus = "active" | "watching" | "cleared" | "detained";
export type SuspectRisk = "high" | "medium" | "low";

export interface SuspectType {
  id: number;
  name: string;
}

export interface Suspect {
  id: number;
  name: string;
  alias: string;
  photo: string;
  district: string;
  capture_county_name?: string | null;
  case_ref: string;
  status: SuspectStatus;
  risk: SuspectRisk;
  suspect_type?: number | null;
  suspect_type_name?: string | null;
  bail_count?: number;
  last_seen: string;
  created_at?: string;
  offense: string;
}

export interface SuspectDetail extends Suspect {
  notes: string;
  is_released?: boolean;
  capture_sub_county?: string;
  created_at: string;
  updated_at: string;
  bail_count?: number;
  registered_officer: RegisteredOfficer | null;
}

export interface RegisteredOfficer {
  id: string;
  full_name: string;
  username: string;
  profile_url: string | null;
}

export interface SuspectCase {
  id: number;
  case_code: string;
  suspect: number;
  damiin: number | null;
  damiin_name: string | null;
  tuhunka: number | null;
  tuhunka_name: string | null;
  capture_county: string | null;
  capture_county_name: string | null;
  capture_sub_county: string | null;
  capture_sub_county_name?: string | null;
  description: string;
  created_at: string;
}

export interface SuspectGuarantorCase {
  id?: number;
  case_code?: string;
  Tuhunka?: string | null;
  d_qabashada?: string | null;
  w_qabashada?: string | null;
  description?: string;
}

export interface SuspectGuarantor {
  id: number;
  code?: string;
  name: string;
  full_name: string;
  phone: string;
  relationship: string;
  relationship_name?: string | null;
  county?: string | null;
  county_name?: string | null;
  occupation?: string;
  workplace?: string;
  description: string;
  notes?: string;
  picture?: string | null;
  identity_picture?: string | null;
  created_at: string;
  cases?: SuspectGuarantorCase[];
}

export interface SuspectArrest {
  id: number;
  suspect: number;
  officer_name: string;
  officer_badge: string;
  unit: string;
  arrested_at: string;
  location: string;
  notes: string;
  created_at: string;
}

export type SuspectCommentKind = "response" | "comment" | "reply";

export interface SuspectComment {
  id: number;
  kind: SuspectCommentKind;
  parent: number | null;
  author_name: string;
  body: string;
  created_at: string;
  image?: string | null;
  audio?: string | null;
  replies?: SuspectComment[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SuspectStats {
  total: number;
  active: number;
  tuhunka_typed: number;
  this_month: number;
  today_registered: number;
}
