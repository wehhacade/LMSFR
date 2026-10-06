export type SurveyStatus = "draft" | "live" | "closed";

export interface Survey {
  id: number;
  name: string;
  description: string;
  status: SurveyStatus;
  allow_multiple_submissions: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  response_count: number;
  section_count: number;
}

export interface Choice {
  id: number;
  label: string;
  value: string;
  order: number;
  is_other?: boolean;
}

export interface Question {
  id: number;
  text: string;
  help_text: string;
  qtype: string;
  required: boolean;
  /** Alias of `required` for mobile clients. */
  is_required?: boolean;
  order: number;
  min_value: string | null;
  max_value: string | null;
  choices: Choice[];
}

export interface SurveySection {
  id: number;
  title: string;
  order: number;
  questions: Question[];
}

export interface SurveyDetail extends Survey {
  sections: SurveySection[];
}

export interface SurveyXlsxImportSummary {
  total_rows: number;
  created: number;
  skipped_duplicate: number;
  detected_county: string;
  unmatched_officers: Record<string, number>;
  fuzzy_matched_officers: Record<string, number>;
  unmatched_subcounties: Record<string, number>;
  interpolated_coordinates: number;
  new_questions_created: string[];
  row_errors: string[];
  dry_run: boolean;
}

export interface SurveyResponse {
  id: number;
  survey: number;
  survey_name: string;
  user: number | null;
  user_name: string | null;
  respondent_phone: string;
  county: number | null;
  county_name: string | null;
  sub_county: number | null;
  sub_county_name: string | null;
  guri_number: string;
  phone_number: string;
  submitted_at: string;
  deadline_duration: string | null;
  deadline_at?: string | null;
  is_deadline_expired?: boolean;
  deadline_days_remaining?: number | null;
  context_object: string;
  context_id: string;
  latitude: string | null;
  longitude: string | null;
  answer_count: number;
  total_questions: number;
  completion_status: "complete" | "partial";
  navigation_url: string;
}

export interface Answer {
  id: number;
  question: number;
  question_text: string;
  question_type: string;
  value_text: string;
  value_number: string | null;
  value_bool: boolean | null;
  value_date: string | null;
  choices: Choice[];
}

export interface SurveyResponseDetail extends SurveyResponse {
  answers: Answer[];
  identity_file: string | null;
  photo: string | null;
  sawirka_guriga: string | null;
  documentiga_guriga: string | null;
  deadline_at: string | null;
  is_deadline_expired: boolean;
}

export interface SurveyOwner {
  id: number;
  response: number;
  owner_name: string;
  camera_installed: string | null;
  survey: number;
  survey_name: string;
  phone_number: string;
  guri_number: string;
  county_name: string | null;
  sub_county_name: string | null;
  submitted_at: string;
  deadline_at?: string | null;
  is_deadline_expired?: boolean;
  deadline_days_remaining?: number | null;
}

export interface SurveyOwnerSummary {
  total: number;
  haa: number;
  maya: number;
  unknown: number;
  county_id?: number | null;
  county_name?: string | null;
}

export interface SurveyOwnersPage extends PaginatedResponse<SurveyOwner> {
  summary?: SurveyOwnerSummary;
}

export interface SurveyStats {
  total_surveys: number;
  live_surveys: number;
  draft_surveys: number;
  closed_surveys: number;
  total_responses: number;
  today_responses: number;
}

export type RespondentActivityStatus = "active" | "idle";

export interface SurveyRespondent {
  key: string;
  display_name: string;
  user_id: number | null;
  phone_number: string;
  guri_number: string;
  context_object: string;
  context_id: string;
  county_name: string | null;
  sub_county_name: string | null;
  submission_count: number;
  survey_count: number;
  complete_count: number;
  partial_count: number;
  last_submitted_at: string;
  first_submitted_at: string;
  completion_rate: number;
  activity_status: RespondentActivityStatus;
  district_count: number;
}

export interface SurveyRespondentMapLocation {
  response_id: number;
  latitude: number;
  longitude: number;
  sub_county_name: string;
  submitted_at: string;
}

export interface SurveyRespondentMapItem {
  key: string;
  display_name: string;
  phone_number: string;
  submission_count: number;
  district_count: number;
  districts: string[];
  latitude: number;
  longitude: number;
  locations: SurveyRespondentMapLocation[];
}

export interface SurveyRespondentMapPinItem {
  key: string;
  display_name: string;
  phone_number: string;
  submission_count: number;
  district_count: number;
  districts: string[];
  latitude: number;
  longitude: number;
}

export interface SurveyRespondentMapTrail {
  key: string;
  locations: SurveyRespondentMapLocation[];
}

export interface SurveyRespondentSummary {
  total_respondents: number;
  active_respondents: number;
  submissions_this_week: number;
  avg_completion_rate: number;
}

export interface ResponsesBySurveyItem {
  name: string;
  total: number;
}

export interface CompletionBreakdownItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface DailyTrendItem {
  label: string;
  date: string;
  count: number;
}

export interface AnalyticsPeriodSummary {
  range: string;
  total_responses: number;
  unique_respondents: number;
  avg_per_day: number;
  gps_coverage_pct: number;
  completed_count: number;
  partial_count: number;
  completion_pct: number;
  previous_period_responses: number;
  change_vs_previous_pct: number;
  peak_day: string;
  peak_day_count: number;
}

export interface HourlyActivityItem {
  hour: number;
  label: string;
  count: number;
}

export interface DistrictBreakdownItem {
  name: string;
  total: number;
}

export interface CompletionTrendDay {
  label: string;
  date: string;
  complete: number;
  partial: number;
  total: number;
}

export interface TopRespondentItem {
  key: string;
  display_name: string;
  submission_count: number;
  complete_count: number;
  completion_rate: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CreateSurveyPayload {
  name: string;
  description?: string;
  status?: SurveyStatus;
  allow_multiple_submissions?: boolean;
}

export type UpdateSurveyPayload = Partial<CreateSurveyPayload>;

export interface SubmitAnswerPayload {
  question: number;
  value_text?: string;
  value_number?: string | number | null;
  value_bool?: boolean | null;
  value_date?: string | null;
  choice_ids?: number[];
}

export interface SubmitSurveyResponsePayload {
  survey: number;
  county?: number | null;
  sub_county?: number | null;
  guri_number?: string;
  phone_number?: string;
  deadline_days?: number | null;
  latitude?: string;
  longitude?: string;
  context_object?: string;
  context_id?: string;
  answers: SubmitAnswerPayload[];
  identity_file?: File | null;
  photo?: File | null;
  sawirka_guriga?: File | null;
  documentiga_guriga?: File | null;
}

/** Survey dashboard / analytics UI types */
export type TimeRange = "7d" | "30d" | "90d" | "all";
export type ResponseStatus = "complete" | "partial";

export type PulseSurvey = {
  id: number;
  title: string;
  status: SurveyStatus;
  meta: string;
  responses: number;
  completion: number;
};

export type PulseResponse = {
  id: number;
  name: string;
  email: string;
  avatar: string;
  survey: string;
  submitted: string;
  duration: string;
  status: ResponseStatus;
  deadlineAt?: string | null;
  isDeadlineExpired?: boolean;
  deadlineDaysRemaining?: number | null;
};

export const STATUS_COLORS: Record<SurveyStatus | ResponseStatus, string> = {
  live: "#10b981",
  draft: "#94a3b8",
  closed: "#f59e0b",
  complete: "#10b981",
  partial: "#f59e0b",
};
