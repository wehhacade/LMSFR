"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { useCreateSuspect, useSuspect, useSuspectTypes, useUpdateSuspect } from "@/hooks/use-suspects";
import { resolveSuspectPhotoUrl } from "@/lib/suspect-photo";
import {
  AccountModal,
  FormField,
  FormRow,
  FormSection,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";

type FormState = {
  name: string;
  alias: string;
  photo: string;
  district: string;
  case_ref: string;
  suspect_type: string;
  last_seen: string;
  offense: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  alias: "",
  photo: "",
  district: "",
  case_ref: "",
  suspect_type: "",
  last_seen: new Date().toISOString().slice(0, 10),
  offense: "",
  notes: "",
});

function selectStyle(C: AccountsThemeColors): React.CSSProperties {
  return {
    padding: "11px 14px",
    borderRadius: "10px",
    border: `1px solid ${C.inputBdr}`,
    background: C.inputBg,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    width: "100%",
    boxSizing: "border-box",
  };
}

export function SuspectFormModal({
  open,
  onClose,
  editId,
  C,
  accent,
  counties,
}: {
  open: boolean;
  onClose: () => void;
  editId: number | null;
  C: AccountsThemeColors;
  accent: string;
  counties: { id: number | string; name: string }[];
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const isEdit = editId !== null;
  const { data: suspect, isLoading } = useSuspect(isEdit && open ? editId : null);
  const { data: suspectTypes = [] } = useSuspectTypes();
  const create = useCreateSuspect();
  const update = useUpdateSuspect(editId ?? 0);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setPictureFile(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPicturePreview(null);
      return;
    }
    if (isEdit && suspect) {
      setForm({
        name: suspect.name,
        alias: suspect.alias ?? "",
        photo: suspect.photo ?? "",
        district: suspect.district,
        case_ref: suspect.case_ref,
        suspect_type: suspect.suspect_type ? String(suspect.suspect_type) : "",
        last_seen: suspect.last_seen,
        offense: suspect.offense,
        notes: suspect.notes ?? "",
      });
    }
  }, [open, isEdit, suspect]);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!pictureFile) {
      setPicturePreview(null);
      return;
    }
    const url = URL.createObjectURL(pictureFile);
    previewUrlRef.current = url;
    setPicturePreview(url);
    return () => {
      URL.revokeObjectURL(url);
      previewUrlRef.current = null;
    };
  }, [pictureFile]);

  const existingPhotoPreview = !picturePreview && isEdit && suspect?.photo
    ? resolveSuspectPhotoUrl(suspect.photo)
    : null;
  const activePreview = picturePreview ?? existingPhotoPreview;

  const clearPicture = () => {
    setPictureFile(null);
    setPicturePreview(null);
  };

  const set = (key: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (!open) return null;

  const valid = form.name.trim() && form.district && form.case_ref.trim() && form.offense.trim() && form.last_seen && form.suspect_type;
  const pending = create.isPending || update.isPending;

  const save = () => {
    const payload = {
      name: form.name.trim(),
      case_ref: form.case_ref.trim(),
      alias: form.alias.trim(),
      photo: form.photo.trim(),
      notes: form.notes.trim(),
      district: form.district,
      suspect_type: form.suspect_type ? Number(form.suspect_type) : null,
      last_seen: form.last_seen,
      offense: form.offense.trim(),
    };
    if (isEdit && editId) {
      update.mutate({ ...payload, pictureFile: pictureFile ?? undefined }, { onSuccess: onClose });
    } else {
      create.mutate({ ...payload, pictureFile: pictureFile ?? undefined }, { onSuccess: onClose });
    }
  };

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={isEdit ? (t.editSuspect ?? "Edit suspect") : t.addSuspect}
      subtitle={isEdit ? (t.suspectEditSub ?? "Update suspect record.") : (t.suspectCreateSub ?? "Register a new suspect in the system.")}
      C={C}
      accent={accent}
      size="xl"
      footer={
        isEdit && isLoading ? undefined : (
          <>
            <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
            <PrimaryButton onClick={save} disabled={pending || !valid} accent={accent}>
              {pending ? t.permSaving : isEdit ? t.userSave : t.addSuspect}
            </PrimaryButton>
          </>
        )
      }
    >
      {isEdit && isLoading ? (
        <div style={{ padding: "32px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>Loading…</div>
      ) : (
        <>
          <FormSection title={t.colName} C={C}>
            <FormRow>
              <FormField label={t.colName} required C={C}>
                <TextInput value={form.name} onChange={set("name")} placeholder={t.colName} C={C} />
              </FormField>
              <FormField label="Alias" C={C}>
                <TextInput value={form.alias} onChange={set("alias")} placeholder="alias" C={C} />
              </FormField>
            </FormRow>
            <FormRow columns={1}>
              <FormField label="Photo file" C={C}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPictureFile(e.target.files?.[0] ?? null)}
                  style={{ ...selectStyle(C), padding: "8px 12px" }}
                />
                {activePreview && (
                  <div style={{ marginTop: "12px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: `1px solid ${hexA(accent, 0.35)}`,
                        flexShrink: 0,
                        background: C.inputBg,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activePreview}
                        alt="Preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    {pictureFile && (
                      <SecondaryButton onClick={clearPicture} C={C}>
                        {t.cancelAction}
                      </SecondaryButton>
                    )}
                  </div>
                )}
              </FormField>
            </FormRow>
            <FormRow columns={1}>
              <FormField label="Photo URL (optional)" C={C}>
                <TextInput value={form.photo} onChange={set("photo")} placeholder="https://…" C={C} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title={t.colCase} C={C}>
            <FormRow>
              <FormField label={t.colCase} required C={C}>
                <TextInput value={form.case_ref} onChange={set("case_ref")} placeholder="CASE-001" C={C} readOnly={isEdit} />
              </FormField>
              <FormField label={t.colDistrict} required C={C}>
                <select value={form.district} onChange={(e) => set("district")(e.target.value)} style={selectStyle(C)}>
                  <option value="">{t.filterDistrict}</option>
                  {counties.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t.colTuhunka} required C={C}>
                <select value={form.suspect_type} onChange={(e) => set("suspect_type")(e.target.value)} style={selectStyle(C)}>
                  <option value="">{t.filterAllTuhunka}</option>
                  {suspectTypes.map((st) => <option key={st.id} value={String(st.id)}>{st.name}</option>)}
                </select>
              </FormField>
              <FormField label={t.colLastSeen} required C={C}>
                <TextInput value={form.last_seen} onChange={set("last_seen")} type="date" C={C} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Offense" required C={C}>
                <TextInput value={form.offense} onChange={set("offense")} placeholder="Offense description" C={C} />
              </FormField>
            </FormRow>
            <FormRow columns={1}>
              <FormField label={t.notes} C={C}>
                <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
                  style={{ ...selectStyle(C), resize: "vertical" }} />
              </FormField>
            </FormRow>
          </FormSection>
        </>
      )}
    </AccountModal>
  );
}
