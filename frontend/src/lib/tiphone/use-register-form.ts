"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TipApi } from "./api";
import {
  clearSuspectDraft,
  draftHasContent,
  emptySuspectDraft,
  loadSuspectDraft,
  saveSuspectDraft,
} from "./register-draft";
import { firstRegisterError, validateRegisterStep } from "./register-validation";
import type {
  DamiinLookupRow,
  DamiinMode,
  LookupRow,
  RegisterFieldErrors,
  SuspectRegisterDraft,
} from "./types";
import {
  clampPhoneInput,
  damiinLookupLabel,
  digitsOnly,
  formatCountyLabel,
  PHONE_DIGIT_COUNT,
} from "./utils";

const AUTO_SAVE_MS = 2000;

export type RegisterPhotoKey = "picture" | "damiinIdentity" | "damiinPicture";

function idForName(rows: LookupRow[], name: string | null): string {
  if (!name) return "";
  const hit = rows.find((r) => r.name === name);
  return hit ? String(hit.id) : "";
}

function revokeIfBlob(uri: string | null | undefined) {
  if (uri?.startsWith("blob:")) URL.revokeObjectURL(uri);
}

export function useRegisterForm(
  userId: number | string | undefined,
  initialPhone?: string,
) {
  const [draft, setDraft] = useState<SuspectRegisterDraft>(() => {
    const blank = emptySuspectDraft();
    if (initialPhone) blank.phone = clampPhoneInput(initialPhone);
    return blank;
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [coreLookupsReady, setCoreLookupsReady] = useState(false);
  const [damiinLookupsLoading, setDamiinLookupsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [errors, setErrors] = useState<RegisterFieldErrors>({});

  const [counties, setCounties] = useState<LookupRow[]>([]);
  const [subCountiesAll, setSubCountiesAll] = useState<LookupRow[]>([]);
  const [reasons, setReasons] = useState<LookupRow[]>([]);
  const [relationships, setRelationships] = useState<LookupRow[]>([]);
  const [allDamiins, setAllDamiins] = useState<DamiinLookupRow[]>([]);
  const [islaDamiins, setIslaDamiins] = useState<
    { id: number; name: string; phone?: string }[]
  >([]);
  const [islaDamiinsLoading, setIslaDamiinsLoading] = useState(false);

  const [files, setFiles] = useState<{
    picture: File | null;
    damiinIdentity: File | null;
    damiinPicture: File | null;
  }>({ picture: null, damiinIdentity: null, damiinPicture: null });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const damiinLookupsStarted = useRef(false);
  draftRef.current = draft;

  const captureSubCounties = useMemo(() => {
    if (!draft.captureCountyId) return [];
    return TipApi.filterSubCounties(subCountiesAll, draft.captureCountyId);
  }, [draft.captureCountyId, subCountiesAll]);

  const damiinOptions = useMemo(
    () => allDamiins.map((d) => damiinLookupLabel(d)),
    [allDamiins],
  );

  const scheduleSave = useCallback((next: SuspectRegisterDraft) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSuspectDraft(next), AUTO_SAVE_MS);
  }, []);

  const patch = useCallback(
    (partial: Partial<SuspectRegisterDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...partial, currentStep };
        draftRef.current = next;
        scheduleSave(next);
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(partial) as (keyof SuspectRegisterDraft)[]) {
          delete next[key];
        }
        return next;
      });
    },
    [currentStep, scheduleSave],
  );

  const setField = useCallback(
    <K extends keyof SuspectRegisterDraft>(key: K, value: SuspectRegisterDraft[K]) => {
      patch({ [key]: value } as Partial<SuspectRegisterDraft>);
    },
    [patch],
  );

  const loadIslaDamiins = useCallback(async () => {
    if (!userId) return;
    const phone = draftRef.current.phone;
    if (digitsOnly(phone).length !== PHONE_DIGIT_COUNT) {
      setIslaDamiins([]);
      return;
    }
    setIslaDamiinsLoading(true);
    try {
      const rows = await TipApi.fetchIslaDamiinsByPhone(phone, userId);
      setIslaDamiins(rows);
    } finally {
      setIslaDamiinsLoading(false);
    }
  }, [userId]);

  const loadDamiinLookups = useCallback(async () => {
    if (damiinLookupsStarted.current) return;
    damiinLookupsStarted.current = true;
    setDamiinLookupsLoading(true);
    try {
      const [rel, dam] = await Promise.all([
        TipApi.fetchRelationshipRows(),
        TipApi.fetchAllDamiins(),
      ]);
      setRelationships(rel);
      setAllDamiins(dam);
    } finally {
      setDamiinLookupsLoading(false);
    }
    await loadIslaDamiins();
  }, [loadIslaDamiins]);

  const setDamiinMode = useCallback(
    (mode: DamiinMode) => {
      revokeIfBlob(draftRef.current.damiinIdentityUri);
      revokeIfBlob(draftRef.current.damiinPictureUri);
      setFiles((prev) => ({ ...prev, damiinIdentity: null, damiinPicture: null }));
      patch({
        damiinMode: mode,
        islaDamiinId: null,
        islaDamiinName: null,
        existingDamiinId: null,
        existingDamiinName: null,
        damiinName: "",
        damiinGender: null,
        damiinPhone: "",
        damiinCountyId: null,
        damiinCountyName: null,
        relationshipId: null,
        relationshipName: null,
        damiinIdentityUri: null,
        damiinPictureUri: null,
      });
      if (mode === "isla_damiin") loadIslaDamiins();
    },
    [loadIslaDamiins, patch],
  );

  const persistFile = useCallback(
    (key: RegisterPhotoKey, file: File | null) => {
      const uriKey =
        key === "picture"
          ? "pictureUri"
          : key === "damiinIdentity"
            ? "damiinIdentityUri"
            : "damiinPictureUri";

      setFiles((prev) => ({ ...prev, [key]: file }));
      setDraft((prev) => {
        revokeIfBlob(prev[uriKey]);
        const uri = file ? URL.createObjectURL(file) : null;
        const next = { ...prev, [uriKey]: uri, currentStep };
        draftRef.current = next;
        scheduleSave(next);
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[uriKey];
        return next;
      });
    },
    [currentStep, scheduleSave],
  );

  const resetForm = useCallback(() => {
    revokeIfBlob(draftRef.current.pictureUri);
    revokeIfBlob(draftRef.current.damiinIdentityUri);
    revokeIfBlob(draftRef.current.damiinPictureUri);
    const blank = emptySuspectDraft();
    if (initialPhone) blank.phone = clampPhoneInput(initialPhone);
    draftRef.current = blank;
    setDraft(blank);
    setCurrentStep(0);
    setErrors({});
    setFiles({ picture: null, damiinIdentity: null, damiinPicture: null });
    clearSuspectDraft();
  }, [initialPhone]);

  const applyDraft = useCallback((loaded: SuspectRegisterDraft) => {
    draftRef.current = loaded;
    setDraft(loaded);
    setCurrentStep(loaded.currentStep ?? 0);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, sub, sts] = await Promise.all([
          TipApi.fetchCounties(),
          TipApi.fetchAllSubCounties(),
          TipApi.fetchSuspectStatuses(),
        ]);
        if (!alive) return;
        setCounties(c.map((r) => ({ id: r.id, name: formatCountyLabel(r.name) })));
        setSubCountiesAll(sub);
        setReasons(sts.map((r) => ({ id: r.id, name: r.name })));
      } finally {
        if (alive) setCoreLookupsReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (currentStep >= 2) loadDamiinLookups();
  }, [currentStep, loadDamiinLookups]);

  useEffect(() => {
    const stored = loadSuspectDraft();
    if (!stored || !draftHasContent(stored)) return;
    // Don't restore object URLs (they're dead)
    applyDraft({
      ...stored,
      pictureUri: null,
      damiinIdentityUri: null,
      damiinPictureUri: null,
    });
    setDraftPrompt(true);
    if ((stored.currentStep ?? 0) >= 2) loadDamiinLookups();
  }, [applyDraft, loadDamiinLookups]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      revokeIfBlob(draftRef.current.pictureUri);
      revokeIfBlob(draftRef.current.damiinIdentityUri);
      revokeIfBlob(draftRef.current.damiinPictureUri);
    };
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      setDraft((prev) => {
        const next = { ...prev, currentStep: step };
        draftRef.current = next;
        scheduleSave(next);
        return next;
      });
      if (step >= 2) loadDamiinLookups();
    },
    [loadDamiinLookups, scheduleSave],
  );

  const validateCurrentStep = useCallback((): RegisterFieldErrors => {
    const stepErrors = validateRegisterStep(currentStep, draftRef.current);
    // For step 0, also require an actual File when URI is missing after draft restore
    if (currentStep === 0 && !files.picture && !draftRef.current.pictureUri) {
      stepErrors.pictureUri = "Fadlan sawir ka qaad tuhunsaha.";
    }
    if (currentStep === 2 && draftRef.current.damiinMode === "new_damiin") {
      if (!files.damiinIdentity && !draftRef.current.damiinIdentityUri) {
        stepErrors.damiinIdentityUri = "Fadlan soo geli sawirka aqoonsiga Damiinada.";
      }
    }
    setErrors(stepErrors);
    return stepErrors;
  }, [currentStep, files.damiinIdentity, files.picture]);

  const submit = useCallback(
    async (options?: { skipDamiin?: boolean }) => {
      if (options?.skipDamiin) {
        const next = { ...draftRef.current, damiinMode: "no_damiin" as const };
        draftRef.current = next;
        setDraft(next);
      }

      for (let s = 0; s <= 2; s += 1) {
        if (s === 2 && draftRef.current.damiinMode === "no_damiin") continue;
        const stepErrors = validateRegisterStep(s, draftRef.current);
        if (s === 0 && !files.picture) {
          stepErrors.pictureUri = "Fadlan sawir ka qaad tuhunsaha.";
        }
        if (
          s === 2 &&
          draftRef.current.damiinMode === "new_damiin" &&
          !files.damiinIdentity
        ) {
          stepErrors.damiinIdentityUri = "Fadlan soo geli sawirka aqoonsiga Damiinada.";
        }
        if (Object.keys(stepErrors).length > 0) {
          setErrors(stepErrors);
          setCurrentStep(s);
          return {
            ok: false as const,
            message: firstRegisterError(stepErrors) ?? "Fadlan buuxi foomka",
          };
        }
      }

      setSubmitting(true);
      try {
        const res = await TipApi.submitRegisterComplete(draftRef.current, files);
        if (!res.ok) return { ok: false as const, message: res.message };
        if (res.suspectId && files.picture) {
          try {
            const buffer = await files.picture.arrayBuffer();
            let binary = "";
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
            void TipApi.storeFaceEmbedding({
              suspectId: res.suspectId,
              imageBase64: btoa(binary),
            });
          } catch {
            /* best-effort browser embedding */
          }
        }
        clearSuspectDraft();
        resetForm();
        return {
          ok: true as const,
          message: res.message,
          caseCode: res.caseCode,
        };
      } finally {
        setSubmitting(false);
      }
    },
    [files, resetForm],
  );

  return {
    draft,
    currentStep,
    errors,
    goToStep,
    validateCurrentStep,
    setField,
    setDamiinMode,
    patch,
    persistFile,
    resetForm,
    coreLookupsReady,
    damiinLookupsLoading,
    submitting,
    draftPrompt,
    setDraftPrompt,
    counties,
    captureSubCounties,
    reasons,
    relationships,
    allDamiins,
    islaDamiins,
    islaDamiinsLoading,
    damiinOptions,
    idForName,
    submit,
    files,
  };
}
