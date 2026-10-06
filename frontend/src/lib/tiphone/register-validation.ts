import type { RegisterFieldErrors, SuspectRegisterDraft } from "./types";
import { isValidPhoneDigits, phoneValidationMessage } from "./utils";

export const REGISTER_STEP_FIELD_ORDER: Record<number, (keyof RegisterFieldErrors)[]> = {
  0: [
    "pictureUri",
    "fullname",
    "mother",
    "gender",
    "phone",
    "identityCard",
    "occupation",
    "addressCountyId",
  ],
  1: ["suspectTypeId", "captureCountyId", "captureSubCountyId", "faahfaahin"],
  2: [
    "islaDamiinId",
    "existingDamiinId",
    "damiinIdentityUri",
    "damiinName",
    "damiinGender",
    "damiinPhone",
    "relationshipId",
    "damiinCountyId",
  ],
};

export function validateRegisterStep(
  step: number,
  draft: SuspectRegisterDraft,
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  if (step === 0) {
    if (!draft.pictureUri?.trim()) {
      errors.pictureUri = "Fadlan sawir ka qaad tuhunsaha.";
    }
    if (!draft.fullname.trim()) {
      errors.fullname = "Fadlan qor magaca tuhunsaha.";
    }
    if (!draft.mother.trim()) {
      errors.mother = "Fadlan qor magaca hooyada.";
    }
    if (!draft.gender) {
      errors.gender = "Fadlan dooro jinsiga.";
    }
    if (!draft.identityCard.trim()) {
      errors.identityCard = "Fadlan qor lambarka aqoonsiga.";
    }
    if (!draft.occupation.trim()) {
      errors.occupation = "Fadlan qor shaqada.";
    }
    if (!isValidPhoneDigits(draft.phone)) {
      errors.phone = phoneValidationMessage();
    }
    if (!draft.addressCountyId) {
      errors.addressCountyId = "Fadlan dooro degmada uu deggan yahay.";
    }
    return errors;
  }

  if (step === 1) {
    if (!draft.suspectTypeId) {
      errors.suspectTypeId = "Fadlan dooro tuhunka.";
    }
    if (!draft.captureCountyId) {
      errors.captureCountyId = "Fadlan dooro degmada qabashada.";
    }
    if (!draft.captureSubCountyId) {
      errors.captureSubCountyId = "Fadlan dooro waaxda qabashada.";
    }
    if (!draft.faahfaahin.trim()) {
      errors.faahfaahin = "Fadlan qor faahfaahinta.";
    }
    return errors;
  }

  if (step === 2) {
    if (draft.damiinMode === "no_damiin") {
      return errors;
    }

    if (draft.damiinMode === "isla_damiin") {
      if (!draft.islaDamiinId) {
        errors.islaDamiinId = "Fadlan dooro damiin hore.";
      }
      return errors;
    }

    if (draft.damiinMode === "dhamaan_damiin") {
      if (!draft.existingDamiinId) {
        errors.existingDamiinId = "Fadlan dooro Damiinada.";
      }
      return errors;
    }

    if (draft.damiinMode !== "new_damiin") {
      return errors;
    }

    if (!draft.damiinName.trim()) {
      errors.damiinName = "Fadlan qor magaca Damiinada.";
    }
    if (!draft.damiinGender) {
      errors.damiinGender = "Fadlan dooro jinsiga Damiinada.";
    }
    if (!isValidPhoneDigits(draft.damiinPhone)) {
      errors.damiinPhone = phoneValidationMessage();
    }
    if (!draft.damiinIdentityUri?.trim()) {
      errors.damiinIdentityUri = "Fadlan soo geli sawirka aqoonsiga Damiinada.";
    }
    if (!draft.relationshipId) {
      errors.relationshipId = "Fadlan dooro xiriirka.";
    }
    if (!draft.damiinCountyId) {
      errors.damiinCountyId = "Fadlan dooro degmada Damiinada.";
    }
  }

  return errors;
}

export function firstRegisterError(errors: RegisterFieldErrors): string | undefined {
  return Object.values(errors).find(Boolean);
}
