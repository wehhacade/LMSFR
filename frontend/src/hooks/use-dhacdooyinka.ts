import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import {
  addDhacdooyinkaUpdate,
  addDhacdooyinkaVictim,
  createDhacdooyinkaRecord,
  createRequirement,
  createUtility,
  deleteDhacdooyinkaRecord,
  deleteRequirement,
  deleteUtility,
  dhacdooyinkaKeys,
  fetchDhacdooyinkaAnalytics,
  fetchDhacdooyinkaLookups,
  fetchDhacdooyinkaRecord,
  fetchDhacdooyinkaRecords,
  fetchDhacdooyinkaStats,
  fetchRequirements,
  fetchUtilities,
  updateDhacdooyinkaRecord,
  updateRequirement,
  updateUtility,
  PAGE_SIZE,
  type DhacdooyinkaListParams,
} from "@/lib/dhacdooyinka-api";
import type {
  CreateRequirementPayload,
  CreateUtilityPayload,
  DhacdooyinkaVictim,
  DhacdooyinkaWritePayload,
  UpdateRequirementPayload,
  UpdateUtilityPayload,
} from "@/types/dhacdooyinka";

const STALE_MS = 60_000;
const STALE_LIST_MS = 30_000;

export function useDhacdooyinkaRecords(params: DhacdooyinkaListParams) {
  const filters = {
    year: params.year ?? "",
    month: params.month ?? "",
  };
  return useQuery({
    queryKey: dhacdooyinkaKeys.list(params.page, params.search, filters, params.page_size ?? PAGE_SIZE),
    queryFn: () => fetchDhacdooyinkaRecords(params),
    staleTime: STALE_LIST_MS,
  });
}

export function useDhacdooyinkaRecord(id: number | null) {
  return useQuery({
    queryKey: dhacdooyinkaKeys.detail(id ?? 0),
    queryFn: () => fetchDhacdooyinkaRecord(id!),
    enabled: id !== null,
    staleTime: STALE_MS,
  });
}

export function useDhacdooyinkaLookups() {
  return useQuery({
    queryKey: dhacdooyinkaKeys.lookups,
    queryFn: fetchDhacdooyinkaLookups,
    staleTime: STALE_MS,
  });
}

export function useDhacdooyinkaStats(filters: Record<string, string>) {
  return useQuery({
    queryKey: dhacdooyinkaKeys.stats(filters),
    queryFn: () => fetchDhacdooyinkaStats(filters),
    staleTime: STALE_LIST_MS,
  });
}

export function useDhacdooyinkaAnalytics() {
  return useQuery({
    queryKey: dhacdooyinkaKeys.analytics,
    queryFn: fetchDhacdooyinkaAnalytics,
    staleTime: STALE_LIST_MS,
  });
}

export function useCreateDhacdooyinkaRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      eventEvidence,
      victimDocuments,
    }: {
      payload: DhacdooyinkaWritePayload;
      eventEvidence?: File[];
      victimDocuments?: File[][];
    }) => createDhacdooyinkaRecord(payload, eventEvidence, victimDocuments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Dhacdo saved" });
    },
    onError: () => toast({ title: "Failed to save dhacdo", variant: "destructive" }),
  });
}

export function useUpdateDhacdooyinkaRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      eventEvidence,
      victimDocuments,
    }: {
      id: number;
      payload: DhacdooyinkaWritePayload;
      eventEvidence?: File[];
      victimDocuments?: File[][];
    }) => updateDhacdooyinkaRecord(id, payload, eventEvidence, victimDocuments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Dhacdo updated" });
    },
    onError: () => toast({ title: "Failed to update dhacdo", variant: "destructive" }),
  });
}

export function useDeleteDhacdooyinkaRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteDhacdooyinkaRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Dhacdo deleted" });
    },
    onError: () => toast({ title: "Failed to delete dhacdo", variant: "destructive" }),
  });
}

export function useAddDhacdooyinkaVictim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      victim,
      documents,
    }: {
      eventId: number;
      victim: DhacdooyinkaVictim;
      documents?: File[];
    }) => addDhacdooyinkaVictim(eventId, victim, documents),
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.detail(eventId) });
      toast({ title: "Victim added" });
    },
    onError: () => toast({ title: "Failed to add victim", variant: "destructive" }),
  });
}

export function useAddDhacdooyinkaUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, fahfaahin }: { eventId: number; fahfaahin: string }) =>
      addDhacdooyinkaUpdate(eventId, fahfaahin),
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.detail(eventId) });
      toast({ title: "Update added" });
    },
    onError: () => toast({ title: "Failed to add update", variant: "destructive" }),
  });
}

export function useUtilities(search = "") {
  return useQuery({
    queryKey: dhacdooyinkaKeys.utility(search),
    queryFn: () => fetchUtilities(search),
    staleTime: STALE_MS,
  });
}

export function useRequirements(search = "", utility = "") {
  return useQuery({
    queryKey: dhacdooyinkaKeys.requirements(search, utility),
    queryFn: () => fetchRequirements(search, utility),
    staleTime: STALE_MS,
  });
}

export function useCreateUtility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUtilityPayload) => createUtility(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Utility saved" });
    },
    onError: () => toast({ title: "Failed to save utility", variant: "destructive" }),
  });
}

export function useUpdateUtility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUtilityPayload }) =>
      updateUtility(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Utility updated" });
    },
    onError: () => toast({ title: "Failed to update utility", variant: "destructive" }),
  });
}

export function useDeleteUtility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUtility(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Utility deleted" });
    },
    onError: () => toast({ title: "Failed to delete utility", variant: "destructive" }),
  });
}

export function useCreateRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequirementPayload) => createRequirement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Requirement saved" });
    },
    onError: () => toast({ title: "Failed to save requirement", variant: "destructive" }),
  });
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRequirementPayload }) =>
      updateRequirement(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Requirement updated" });
    },
    onError: () => toast({ title: "Failed to update requirement", variant: "destructive" }),
  });
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRequirement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dhacdooyinkaKeys.all });
      toast({ title: "Requirement deleted" });
    },
    onError: () => toast({ title: "Failed to delete requirement", variant: "destructive" }),
  });
}
