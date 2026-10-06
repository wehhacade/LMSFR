"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  builderKeys,
  createChoice,
  createChoicesBulk,
  createQuestion,
  createSection,
  deleteChoice,
  deleteQuestion,
  deleteSection,
  publishSurvey,
  reorderQuestions,
  updateChoice,
  updateQuestion,
  updateSection,
} from "@/lib/surveys-builder-api";
import type {
  CreateChoicePayload,
  CreateQuestionPayload,
  CreateSectionPayload,
  UpdateChoicePayload,
  UpdateQuestionPayload,
  UpdateSectionPayload,
} from "@/types/surveys-builder";
import type { ReorderQuestionsPayload } from "@/lib/surveys-builder-api";
import { toast } from "@/components/ui/use-toast";
import { surveyKeys } from "@/lib/surveys-api";

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: Record<string, unknown> | string } };
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const detail = data.detail;
    if (typeof detail === "string") return detail;
    for (const value of Object.values(data)) {
      const msg = Array.isArray(value) ? value[0] : value;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  return fallback;
}

function invalidateSurvey(qc: ReturnType<typeof useQueryClient>, surveyId: number) {
  void qc.invalidateQueries({ queryKey: surveyKeys.detail(surveyId) });
  void qc.invalidateQueries({ queryKey: surveyKeys.all });
}

// ── Sections ────────────────────────────────────────────────────────────────
export function useCreateSection(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSectionPayload) => createSection(payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to add section", variant: "destructive" }),
  });
}

export function useUpdateSection(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSectionPayload }) =>
      updateSection(id, payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to update section", variant: "destructive" }),
  });
}

export function useDeleteSection(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to delete section", variant: "destructive" }),
  });
}

// ── Questions ────────────────────────────────────────────────────────────────
export function useCreateQuestion(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => createQuestion(payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to add question", variant: "destructive" }),
  });
}

export function useUpdateQuestion(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateQuestionPayload }) =>
      updateQuestion(id, payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to update question", variant: "destructive" }),
  });
}

export function useDeleteQuestion(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteQuestion(id),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to delete question", variant: "destructive" }),
  });
}

export function useReorderQuestions(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReorderQuestionsPayload) => reorderQuestions(payload),
    onSuccess: () => {
      invalidateSurvey(qc, surveyId);
      toast({ title: "Question order saved" });
    },
    onError: (err) =>
      toast({
        title: "Failed to save order",
        description: apiErrorMessage(err, "Could not reorder questions."),
        variant: "destructive",
      }),
  });
}

// ── Choices ────────────────────────────────────────────────────────────────
export function useCreateChoice(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChoicePayload) => createChoice(payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: (err) => toast({ title: apiErrorMessage(err, "Failed to add choice"), variant: "destructive" }),
  });
}

export function useCreateChoicesBulk(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { question: number; labels: string[]; start_order?: number }) =>
      createChoicesBulk(payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to add choices", variant: "destructive" }),
  });
}

export function useUpdateChoice(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateChoicePayload }) =>
      updateChoice(id, payload),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to update choice", variant: "destructive" }),
  });
}

export function useDeleteChoice(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteChoice(id),
    onSuccess: () => invalidateSurvey(qc, surveyId),
    onError: () => toast({ title: "Failed to delete choice", variant: "destructive" }),
  });
}

// ── Publish ────────────────────────────────────────────────────────────────
export function usePublishSurvey(surveyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => publishSurvey(surveyId),
    onSuccess: (data) => {
      qc.setQueryData(builderKeys.survey(surveyId), data);
      void qc.invalidateQueries({ queryKey: surveyKeys.all });
      toast({ title: "Survey published!" });
    },
    onError: () => {
      // Errors with validation details are handled in the component
    },
  });
}

// ── Update survey metadata ────────────────────────────────────────────────
export { useUpdateSurvey } from "@/hooks/use-surveys";
