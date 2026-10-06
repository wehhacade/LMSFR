export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LookupItem {
  id: number;
  name: string;
}

export interface HubkadhigisLookups {
  ranks: LookupItem[];
  force_units: LookupItem[];
  weapon_types: LookupItem[];
  surrender_locations: LookupItem[];
}

export interface PersonHistoryResult {
  count: number;
  person_name: string;
  phone_number: string;
  records: DisarmamentRecord[];
}

export interface DisarmamentImage {
  id: number;
  record: number;
  record_reference?: string | null;
  record_person_name?: string | null;
  file_url: string | null;
  image_type: "weapon" | "evidence";
  caption: string;
  weapon_type: number | null;
  weapon_type_name: string | null;
  weapon_serial: string;
  county: number | null;
  county_name: string | null;
  surrender_location: number | null;
  surrender_location_name: string | null;
  surrender_date: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface DisarmamentRecord {
  id: number;
  reference_number: string;
  person_name: string;
  police_station: string;
  phone_number: string;
  force_unit: number | null;
  force_unit_name: string | null;
  force_number: string;
  rank: number | null;
  rank_name: string | null;
  weapon_type: number | null;
  weapon_type_name: string | null;
  weapon_serial: string;
  county: number | null;
  county_name: string | null;
  surrender_location: number | null;
  surrender_location_name: string | null;
  surrender_date: string | null;
  cover_image_url: string | null;
  weapon_image_url?: string | null;
  person_image_url?: string | null;
  year: string;
  month: string;
  created_at: string;
  image_count?: number;
}

export interface RegisteredOfficer {
  id: string;
  full_name: string;
  email: string;
}

export interface DisarmamentDetail extends DisarmamentRecord {
  details: string;
  latitude: string;
  longitude: string;
  updated_at: string;
  registered_officer: RegisteredOfficer | null;
  images: DisarmamentImage[];
}

export interface DisarmamentStats {
  total: number;
  this_month: number;
  with_weapon: number;
  with_images: number;
}

export interface HubkadhigisTrendPoint {
  date: string;
  label: string;
  count: number;
}

export interface HubkadhigisBreakdownItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface HubkadhigisNamedTotal {
  name: string;
  total: number;
}

export interface HubkadhigisAnalytics {
  weekly_trend: HubkadhigisTrendPoint[];
  status_breakdown: HubkadhigisBreakdownItem[];
  by_weapon_type: HubkadhigisNamedTotal[];
  by_force_unit: HubkadhigisNamedTotal[];
}

export interface CreateDisarmamentPayload {
  person_name: string;
  police_station?: string;
  phone_number?: string;
  force_unit?: number | null;
  force_number?: string;
  details?: string;
  rank?: number | null;
  weapon_type?: number | null;
  weapon_serial?: string;
  county?: number | null;
  surrender_location?: number | null;
  surrender_date?: string | null;
  latitude?: string;
  longitude?: string;
  year?: string;
  month?: string;
}

export type UpdateDisarmamentPayload = Partial<CreateDisarmamentPayload>;
