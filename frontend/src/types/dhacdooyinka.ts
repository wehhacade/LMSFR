export interface DhacdooyinkaVictimDocument {
  id: number;
  name?: string | null;
  document_url: string | null;
}

export interface DhacdooyinkaDocument {
  id: number;
  name: string | null;
  url: string | null;
}

export interface DhacdooyinkaUpdate {
  id: number;
  fahfaahin: string | null;
  status: string | null;
  recorded_by_name: string | null;
  date_recorded: string;
  updated_at: string;
}

export interface DhacdooyinkaVictim {
  id?: number;
  magaca: string | null;
  dada_dh: string | null;
  gender: string | null;
  xalada: string | null;
  phone: string | null;
  fahfaahin: string | null;
  documents?: DhacdooyinkaVictimDocument[];
}

export interface DhacdooyinkaRecord {
  id: number;
  tixraac_lambar: string | null;
  location_display: string;
  gobolka_name: string | null;
  degmada_name: string | null;
  waaxda_name: string | null;
  laanta_name: string | null;
  cidda_fulisay: string | null;
  nooca_dhacdada: number | null;
  nooca_dhacdada_name: string | null;
  dhimasho: string | null;
  dhaawac: string | null;
  victim_count: number;
  khasaaraha_dhacdada: string | null;
  taariikhda_dhacdada: string | null;
  date_recorded: string;
  year: string | null;
  month: string | null;
}

export interface DhacdooyinkaDetail extends DhacdooyinkaRecord {
  gobolka: number | null;
  degmada: number | null;
  waaxda: number | null;
  laanta: number | null;
  bartilmaameedka_dhacdada: string | null;
  target_location_display?: string | null;
  tafaasiisha_goobta_dhacdada: string | null;
  fahfaahin?: string | null;
  tirada: string | null;
  xuuraanshe: string | null;
  xuuraan_bille: string | null;
  latitude: string | null;
  longitude: string | null;
  upload_document: string | null;
  upload_document_url: string | null;
  documents?: DhacdooyinkaDocument[];
  date_opp: string | null;
  victims: DhacdooyinkaVictim[];
  updates: DhacdooyinkaUpdate[];
  recorded_by_name: string | null;
}

export interface DhacdooyinkaLookups {
  regions: { id: number; name: string }[];
  counties: { id: number; name: string; region: number | null; region_name?: string }[];
  sub_counties: { id: number; name: string; county: number; county_name?: string }[];
  sections: { id: number; name: string; sub_county: number }[];
  nooca_types: DhacdooyinkaRequirement[];
}

export interface DhacdooyinkaWritePayload {
  tixraac_lambar?: string;
  tafaasiisha_goobta_dhacdada?: string;
  taariikhda_dhacdada?: string;
  gobolka?: number | null;
  degmada?: number | null;
  waaxda?: number | null;
  laanta?: number | null;
  bartilmaameedka_dhacdada?: string;
  cidda_fulisay?: string;
  nooca_dhacdada?: number | null;
  khasaaraha_dhacdada?: string;
  tirada?: string;
  dhimasho?: string;
  dhaawac?: string;
  xuuraanshe?: string;
  xuuraan_bille?: string;
  latitude?: string;
  longitude?: string;
  date_opp?: string | null;
  victims?: DhacdooyinkaVictim[];
}

export interface DhacdooyinkaStats {
  total: number;
}

export interface DhacdooyinkaNamedTotal {
  name: string;
  total: number;
}

export interface DhacdooyinkaTrendPoint {
  date: string;
  label: string;
  count: number;
}

export interface DhacdooyinkaCoverageItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface DhacdooyinkaRecentEvent {
  id: number;
  tixraac_lambar: string | null;
  location_display: string;
  nooca_dhacdada_name: string | null;
  cidda_fulisay: string | null;
  dhimasho: string | null;
  dhaawac: string | null;
  victim_count: number;
  date_recorded: string | null;
}

export interface DhacdooyinkaAnalytics {
  total: number;
  this_month: number;
  this_week: number;
  victims_total: number;
  victims_this_month: number;
  deaths: number;
  injuries: number;
  casualties: number;
  with_document: number;
  with_gps: number;
  with_victims: number;
  sections_total: number;
  types_total: number;
  weekly_trend: DhacdooyinkaTrendPoint[];
  by_event_type: DhacdooyinkaNamedTotal[];
  by_region: DhacdooyinkaNamedTotal[];
  by_perpetrator: DhacdooyinkaNamedTotal[];
  victims_by_gender: DhacdooyinkaNamedTotal[];
  victims_by_status: DhacdooyinkaNamedTotal[];
  coverage: DhacdooyinkaCoverageItem[];
  recent: DhacdooyinkaRecentEvent[];
}

export interface DhacdooyinkaUtility {
  id: number;
  name: string | null;
  created_at: string;
  update_at: string;
}

export interface DhacdooyinkaRequirement {
  id: number;
  type: string | null;
  nooca_dhacdooyinka_guud: number | null;
  utility_name: string | null;
  date_recorded: string;
  created_at: string;
  update_at: string;
}

export interface CreateUtilityPayload {
  name: string;
}

export interface UpdateUtilityPayload {
  name: string;
}

export interface CreateRequirementPayload {
  type: string;
  nooca_dhacdooyinka_guud: number | null;
}

export interface UpdateRequirementPayload {
  type: string;
  nooca_dhacdooyinka_guud: number | null;
}
