import type { SuspectRegisterDraft } from "./types";

const DRAFT_KEY = "tiphone_suspect_register_v2_draft";

export function emptySuspectDraft(): SuspectRegisterDraft {
  return {
    fullname: "",
    mother: "",
    phone: "",
    gender: null,
    identityCard: "",
    occupation: "",
    addressCountyId: null,
    addressCountyName: null,
    suspectTypeId: null,
    suspectTypeName: null,
    captureCountyId: null,
    captureCountyName: null,
    captureSubCountyId: null,
    captureSubCountyName: null,
    faahfaahin: "",
    damiinMode: "new_damiin",
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
    pictureUri: null,
    damiinIdentityUri: null,
    damiinPictureUri: null,
    currentStep: 0,
    timestamp: Date.now(),
  };
}

export function draftHasContent(draft: SuspectRegisterDraft): boolean {
  return Boolean(
    draft.fullname.trim() ||
      draft.phone.trim() ||
      draft.pictureUri ||
      draft.faahfaahin.trim() ||
      draft.damiinName.trim(),
  );
}

export function loadSuspectDraft(): SuspectRegisterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SuspectRegisterDraft;
  } catch {
    return null;
  }
}

export function saveSuspectDraft(draft: SuspectRegisterDraft): void {
  if (typeof window === "undefined") return;
  try {
    // Blob/object URLs don't survive reload — strip preview URIs for storage.
    const toSave: SuspectRegisterDraft = {
      ...draft,
      pictureUri: null,
      damiinIdentityUri: null,
      damiinPictureUri: null,
      timestamp: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
  } catch {
    // ignore quota / private mode
  }
}

export function clearSuspectDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
