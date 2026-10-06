import api from "@/lib/axios";
import type {
  CreateChoicePayload,
  CreateChoicesBulkPayload,
  CreateQuestionPayload,
  CreateSectionPayload,
  UpdateChoicePayload,
  UpdateQuestionPayload,
  UpdateSectionPayload,
} from "@/types/surveys-builder";
import type { Choice, Question, SurveyDetail, SurveySection } from "@/types/surveys";

const BASE = "/survey";

// ── Query key factories ──────────────────────────────────────────────────────
export const builderKeys = {
  survey: (id: number) => ["surveys", "detail", id] as const,
  sections: (surveyId: number) => ["builder", "sections", surveyId] as const,
  questions: (sectionId: number) => ["builder", "questions", sectionId] as const,
};

// ── Sections ────────────────────────────────────────────────────────────────
export async function createSection(payload: CreateSectionPayload): Promise<SurveySection> {
  const { data } = await api.post<SurveySection>(`${BASE}/sections/`, payload);
  return data;
}

export async function updateSection(id: number, payload: UpdateSectionPayload): Promise<SurveySection> {
  const { data } = await api.patch<SurveySection>(`${BASE}/sections/${id}/`, payload);
  return data;
}

export async function deleteSection(id: number): Promise<void> {
  await api.delete(`${BASE}/sections/${id}/`);
}

// ── Questions ────────────────────────────────────────────────────────────────
export async function createQuestion(payload: CreateQuestionPayload): Promise<Question> {
  const { data } = await api.post<Question>(`${BASE}/questions/`, payload);
  return data;
}

export async function updateQuestion(id: number, payload: UpdateQuestionPayload): Promise<Question> {
  const { data } = await api.patch<Question>(`${BASE}/questions/${id}/`, payload);
  return data;
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(`${BASE}/questions/${id}/`);
}

export interface ReorderQuestionsPayload {
  section?: number;
  survey?: number;
  questions: { id: number; order: number }[];
}

export async function reorderQuestions(payload: ReorderQuestionsPayload): Promise<Question[]> {
  const { data } = await api.post<Question[]>(`${BASE}/questions/reorder/`, payload);
  return data;
}

// ── Choices ────────────────────────────────────────────────────────────────
export async function createChoice(payload: CreateChoicePayload): Promise<Choice> {
  const { data } = await api.post<Choice>(`${BASE}/choices/`, payload);
  return data;
}

export async function createChoicesBulk(payload: CreateChoicesBulkPayload): Promise<Choice[]> {
  const { data } = await api.post<Choice[]>(`${BASE}/choices/bulk-create/`, payload);
  return data;
}

export async function updateChoice(id: number, payload: UpdateChoicePayload): Promise<Choice> {
  const { data } = await api.patch<Choice>(`${BASE}/choices/${id}/`, payload);
  return data;
}

export async function deleteChoice(id: number): Promise<void> {
  await api.delete(`${BASE}/choices/${id}/`);
}

// ── Publish ────────────────────────────────────────────────────────────────
export interface PublishResult {
  errors?: string[];
  [key: string]: unknown;
}

export async function publishSurvey(id: number): Promise<SurveyDetail> {
  const { data } = await api.post<SurveyDetail>(`${BASE}/surveys/${id}/publish/`);
  return data;
}
