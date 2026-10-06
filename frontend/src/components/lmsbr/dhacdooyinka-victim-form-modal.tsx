"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict } from "@/lib/lmsbr/data";
import { useAddDhacdooyinkaVictim } from "@/hooks/use-dhacdooyinka";
import type { DhacdooyinkaVictim } from "@/types/dhacdooyinka";
import {
  AccountModal,
  MultiFileChooser,
  FormField,
  FormRow,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";

type VictimForm = {
  magaca: string;
  dada_dh: string;
  gender: string;
  xalada: string;
  phone: string;
  fahfaahin: string;
};

const emptyForm = (): VictimForm => ({
  magaca: "",
  dada_dh: "",
  gender: "",
  xalada: "",
  phone: "",
  fahfaahin: "",
});

export function DhacdooyinkaVictimFormModal({
  open,
  onClose,
  eventId,
  C,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  eventId: number;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const addVictim = useAddDhacdooyinkaVictim();
  const [form, setForm] = useState(emptyForm);
  const [documents, setDocuments] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setDocuments([]);
  }, [open]);

  const set = (key: keyof VictimForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pending = addVictim.isPending;
  const canSave = Boolean(form.magaca.trim());

  const payload: DhacdooyinkaVictim = {
    magaca: form.magaca.trim(),
    dada_dh: form.dada_dh.trim() || null,
    gender: form.gender || null,
    xalada: form.xalada.trim() || null,
    phone: form.phone.trim() || null,
    fahfaahin: form.fahfaahin.trim() || null,
  };

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={t.dhacdoAddVictim}
      subtitle={t.dhacdoVictimFormSub}
      size="md"
      C={C}
      accent={accent}
      footer={(
        <>
          <SecondaryButton onClick={onClose} disabled={pending} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            disabled={!canSave || pending}
            onClick={() => {
              addVictim.mutate(
                { eventId, victim: payload, documents },
                { onSuccess: onClose },
              );
            }}
            accent={accent}
          >
            {pending ? `${t.dhacdoAddVictim}…` : t.dhacdoAddVictim}
          </PrimaryButton>
        </>
      )}
    >
      <FormRow columns={2}>
        <FormField label={t.dhacdoVictimName} required C={C}>
          <TextInput value={form.magaca} onChange={set("magaca")} C={C} />
        </FormField>
        <FormField label={t.dhacdoVictimAge} C={C}>
          <TextInput value={form.dada_dh} onChange={set("dada_dh")} C={C} />
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoVictimGender} C={C}>
          <SelectInput
            value={form.gender}
            onChange={set("gender")}
            C={C}
            accent={accent}
            active={!!form.gender}
          >
            <option value="">{t.dhacdoSelectGender}</option>
            <option value="Lab">Lab</option>
            <option value="Dhedig">Dhedig</option>
          </SelectInput>
        </FormField>
        <FormField label={t.dhacdoVictimPhone} C={C}>
          <TextInput value={form.phone} onChange={set("phone")} C={C} />
        </FormField>
      </FormRow>

      <FormField label={t.dhacdoVictimStatus} C={C}>
        <TextInput value={form.xalada} onChange={set("xalada")} C={C} />
      </FormField>

      <FormField label={t.dhacdoVictimDetails} C={C}>
        <TextInput value={form.fahfaahin} onChange={set("fahfaahin")} C={C} />
      </FormField>

      <FormField label={t.dhacdoVictimDocument} C={C}>
        <MultiFileChooser
          files={documents}
          onChange={setDocuments}
          C={C}
          accent={accent}
          hint={t.dhacdoEvidenceUploadHint}
          formatsHint={t.dhacdoEvidenceFormats}
          removeLabel={t.dhacdoEvidenceRemove}
        />
      </FormField>
    </AccountModal>
  );
}
