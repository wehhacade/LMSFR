export interface AppUsageRegistrar {
  agent_id?: number;
  user_id?: number;
  service_id?: string;
  name: string;
  phone: string;
  county_name: string;
  section_name?: string;
  suspects_registered: number;
}

export interface AppUsageAgentRow {
  agent_id: number;
  user_id: number | null;
  service_id: string;
  name: string;
  phone: string;
  county_name: string;
  section_name: string;
  app_installed: boolean;
  installation_status: string;
  installed_at: string | null;
  period_suspects_registered: number;
  period_app_opens: number;
  period_has_suspects: boolean;
  period_has_activity: boolean;
  last_period_suspect_at: string | null;
  last_period_activity_at: string | null;
  last_period_activity_relative: string;
  is_active: boolean;
}

export interface AppUsageDistrictBreakdown {
  name: string;
  total_installed: number;
  active_in_period: number;
  inactive_in_period: number;
  total_suspects: number;
  top_registrars: AppUsageRegistrar[];
}

export interface AppUsageReport {
  generated_at: string;
  period: { date_from: string; date_to: string };
  filters: {
    county_id: string | null;
    department_id: string | null;
    installed_only: boolean;
  };
  summary: {
    total_installed: number;
    active_in_period: number;
    inactive_in_period: number;
    total_suspects_in_period: number;
    total_app_opens_in_period: number;
  };
  top_registrars: {
    overall_top3: AppUsageRegistrar[];
    overall_top10: AppUsageRegistrar[];
    section_top3: AppUsageRegistrar[];
    district_top3: AppUsageRegistrar[];
    section_name: string | null;
    district_name: string | null;
    by_district: Record<string, AppUsageRegistrar[]>;
    by_section: Record<string, AppUsageRegistrar[]>;
  };
  district_breakdown: AppUsageDistrictBreakdown[];
  section_breakdown: AppUsageDistrictBreakdown[];
  active_agents: AppUsageAgentRow[];
  inactive_agents: AppUsageAgentRow[];
  agents: AppUsageAgentRow[];
}

export type AppUsagePrintMode =
  | "top3-overall"
  | "top3-section"
  | "top3-district"
  | "top10-overall"
  | "inactive"
  | "active"
  | "full";
