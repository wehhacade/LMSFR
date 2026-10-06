import type { Choice, Question, SurveyDetail, SurveySection } from "@/types/surveys";

export type { Choice, Question, SurveySection, SurveyDetail };

export interface CreateSectionPayload {
  survey: number;
  title: string;
  order: number;
}

export interface UpdateSectionPayload {
  title?: string;
  order?: number;
}

export type QType =
  | "single"
  | "multi"
  | "short_text"
  | "long_text"
  | "integer"
  | "decimal"
  | "date"
  | "rating"
  | "boolean";

export const QTYPE_LABELS: Record<QType, string> = {
  single: "Single choice",
  multi: "Multiple choice",
  short_text: "Short text",
  long_text: "Long text",
  integer: "Integer",
  decimal: "Decimal",
  date: "Date",
  rating: "Rating",
  boolean: "Yes / No",
};

export const CHOICE_QTYPES = new Set<QType>(["single", "multi"]);

export interface CreateQuestionPayload {
  section: number;
  text: string;
  help_text?: string;
  qtype: QType;
  required?: boolean;
  order: number;
  min_value?: string | null;
  max_value?: string | null;
}

export interface UpdateQuestionPayload {
  text?: string;
  help_text?: string;
  qtype?: QType;
  required?: boolean;
  order?: number;
  min_value?: string | null;
  max_value?: string | null;
}

export interface CreateChoicePayload {
  question: number;
  label: string;
  value?: string;
  order: number;
  is_other?: boolean;
}

export interface CreateChoicesBulkPayload {
  question: number;
  labels: string[];
  start_order?: number;
}

export interface UpdateChoicePayload {
  label?: string;
  value?: string;
  order?: number;
  is_other?: boolean;
}

export interface PublishResponse {
  errors?: string[];
}
