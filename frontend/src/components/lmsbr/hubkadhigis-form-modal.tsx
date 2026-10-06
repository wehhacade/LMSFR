"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { LIGHT_DUSTY_INPUT } from "@/lib/lmsbr/palette";
import type { DisarmamentRecord } from "@/types/hubkadhigis";
import {
  useCreateDisarmamentRecord,
  useDisarmamentRecord,
  useHubkadhigisLookups,
  useUpdateDisarmamentRecord,
} from "@/hooks/use-hubkadhigis";
import {
  deleteDisarmamentImage,
  hubkadhigisKeys,
  uploadDisarmamentImage,
} from "@/lib/hubkadhigis-api";
import { resolveMediaUrl } from "@/lib/media-url";
import { fetchCounties } from "@/lib/accounts-api";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "./icon";
import {
  AccountModal,
  FormField,
  FormRow,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { useTheme } from "./theme-ctx";

type FormState = {
  person_name: string;
  police_station: string;
  phone_number: string;
  force_unit: string;
  force_number: string;
  rank: string;
  weapon_type: string;
  weapon_serial: string;
  county: string;
  surrender_location: string;
  surrender_date: string;
  details: string;
  latitude: string;
  longitude: string;
};

type PendingImage = { key: string; file: File; preview: string };

type ExistingImage = { key: string; imageId: number; preview: string };

const emptyForm = (): FormState => ({
  person_name: "",
  police_station: "",
  phone_number: "",
  force_unit: "",
  force_number: "",
  rank: "",
  weapon_type: "",
  weapon_serial: "",
  county: "",
  surrender_location: "",
  surrender_date: "",
  details: "",
  latitude: "0",
  longitude: "0",
});

function selectStyle(C: AccountsThemeColors, accent?: string, active?: boolean, isDark = true): CSSProperties {
  return {
    padding: "11px 14px",
    borderRadius: "10px",
    border: `1px solid ${active && accent ? hexA(accent, isDark ? 0.4 : 0.28) : C.inputBdr}`,
    background: isDark ? C.inputBg : LIGHT_DUSTY_INPUT,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    cursor: "pointer",
    appearance: "auto",
  };
}

function revokeBlob(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function SectionCard({
  title, description, icon, children, C, accent, isDark,
}: {
  title: string;
  description?: string;
  icon: string;
  children: ReactNode;
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <section style={{
      marginBottom: 20,
      borderRadius: 14,
      border: `1px solid ${isDark ? C.cardBdr : "#E5E7EB"}`,
      background: isDark
        ? `linear-gradient(165deg, ${C.panelBg} 0%, ${hexA(accent, 0.05)} 100%)`
        : "#FFFFFF",
      overflow: "hidden",
      boxShadow: isDark ? C.panelShadow : "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "16px 18px",
        borderBottom: `1px solid ${C.tableSep}`,
        background: `linear-gradient(135deg, ${hexA(accent, isDark ? 0.08 : 0.05)} 0%, transparent 72%)`,
      }}>
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: hexA(accent, isDark ? 0.14 : 0.10),
          color: accent,
          border: isDark ? "none" : `1px solid ${hexA(accent, 0.16)}`,
        }}>
          <Icon name={icon} size={18} sw={2} />
        </span>
        <div>
          <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 15, fontWeight: 600, color: C.txtPrimary }}>{title}</h3>
          {description && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.4 }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ padding: "18px" }}>{children}</div>
    </section>
  );
}

function HubSelect({
  value, onChange, options, placeholder, C, accent, isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle(C, accent, !!value, isDark)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ImageUploadPanel({
  label,
  hint,
  multiple,
  pending,
  existing,
  onAdd,
  onRemovePending,
  onRemoveExisting,
  C,
  accent,
  isDark,
  removeLabel,
}: {
  label: string;
  hint: string;
  multiple: boolean;
  pending: PendingImage[];
  existing: ExistingImage[];
  onAdd: (files: FileList | File[]) => void;
  onRemovePending: (key: string) => void;
  onRemoveExisting: (key: string) => void;
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
  removeLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const hasImages = pending.length > 0 || existing.length > 0;

  const pickFiles = (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (!files.length) return;
    onAdd(multiple ? files : [files[0]]);
  };

  return (
    <FormField label={label} C={C}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) pickFiles(e.dataTransfer.files);
        }}
        style={{
          padding: hasImages ? 12 : "24px 20px",
          borderRadius: 12,
          border: `2px dashed ${dragOver ? hexA(accent, 0.6) : C.inputBdr}`,
          background: dragOver ? hexA(accent, 0.06) : (isDark ? C.inputBg : LIGHT_DUSTY_INPUT),
          cursor: "pointer",
          textAlign: "center",
          transition: ".2s",
        }}
      >
        {!hasImages ? (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.1), color: accent,
            }}>
              <Icon name="plus" size={22} sw={2} />
            </div>
            <div style={{ fontSize: 14, color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontWeight: 500 }}>{hint}</div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 10 }}>
            {existing.map((img) => (
              <div key={img.key} style={{ position: "relative" }}>
                <img
                  src={img.preview}
                  alt=""
                  style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 10, border: `1px solid ${C.cardBdr}`,
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveExisting(img.key); }}
                  style={{
                    position: "absolute", top: 4, right: 4,
                    width: 24, height: 24, borderRadius: 999, border: "none",
                    background: "rgba(15,23,42,0.72)", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  title={removeLabel}
                >
                  <Icon name="close" size={12} sw={2.2} />
                </button>
              </div>
            ))}
            {pending.map((img) => (
              <div key={img.key} style={{ position: "relative" }}>
                <img
                  src={img.preview}
                  alt=""
                  style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 10, border: `2px solid ${hexA(accent, 0.35)}`,
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemovePending(img.key); }}
                  style={{
                    position: "absolute", top: 4, right: 4,
                    width: 24, height: 24, borderRadius: 999, border: "none",
                    background: "rgba(15,23,42,0.72)", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  title={removeLabel}
                >
                  <Icon name="close" size={12} sw={2.2} />
                </button>
              </div>
            ))}
            {multiple && (
              <div style={{
                aspectRatio: "1", borderRadius: 10,
                border: `1px dashed ${hexA(accent, 0.35)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: accent, background: hexA(accent, 0.05),
              }}>
                <Icon name="plus" size={20} sw={2} />
              </div>
            )}
          </div>
        )}
      </div>
      {hasImages && multiple && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{hint}</p>
      )}
    </FormField>
  );
}

function recordToForm(record: DisarmamentRecord): FormState {
  return {
    person_name: record.person_name ?? "",
    police_station: record.police_station ?? "",
    phone_number: record.phone_number ?? "",
    force_unit: record.force_unit ? String(record.force_unit) : "",
    force_number: record.force_number ?? "",
    rank: record.rank ? String(record.rank) : "",
    weapon_type: "",
    weapon_serial: "",
    county: record.county ? String(record.county) : "",
    surrender_location: "",
    surrender_date: "",
    details: "",
    latitude: "0",
    longitude: "0",
  };
}

function makePending(file: File): PendingImage {
  return { key: `new-${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) };
}

export function HubkadhigisFormModal({
  open,
  onClose,
  editId,
  prefillFrom,
  C,
  accent,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  editId: number | null;
  prefillFrom?: DisarmamentRecord | null;
  C: AccountsThemeColors;
  accent: string;
  variant?: "modal" | "page";
}) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = getDict(lang);
  const qc = useQueryClient();
  const isEdit = editId !== null;
  const { data: record, isLoading } = useDisarmamentRecord(isEdit && open ? editId : null);
  const { data: lookups } = useHubkadhigisLookups();
  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: fetchCounties,
    enabled: open,
  });
  const create = useCreateDisarmamentRecord();
  const update = useUpdateDisarmamentRecord(editId ?? 0);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [weaponPending, setWeaponPending] = useState<PendingImage[]>([]);
  const [weaponExisting, setWeaponExisting] = useState<ExistingImage[]>([]);
  const [evidencePending, setEvidencePending] = useState<PendingImage[]>([]);
  const [evidenceExisting, setEvidenceExisting] = useState<ExistingImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const resetImages = () => {
    weaponPending.forEach((i) => revokeBlob(i.preview));
    evidencePending.forEach((i) => revokeBlob(i.preview));
    if (personFile && personPreview?.startsWith("blob:")) revokeBlob(personPreview);
    setPersonFile(null);
    setPersonPreview(null);
    setWeaponPending([]);
    setWeaponExisting([]);
    setEvidencePending([]);
    setEvidenceExisting([]);
    setRemovedImageIds([]);
  };

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      resetImages();
      return;
    }
    if (isEdit && record) {
      setForm({
        person_name: record.person_name ?? "",
        police_station: record.police_station ?? "",
        phone_number: record.phone_number ?? "",
        force_unit: record.force_unit ? String(record.force_unit) : "",
        force_number: record.force_number ?? "",
        rank: record.rank ? String(record.rank) : "",
        weapon_type: record.weapon_type ? String(record.weapon_type) : "",
        weapon_serial: record.weapon_serial ?? "",
        county: record.county ? String(record.county) : "",
        surrender_location: record.surrender_location ? String(record.surrender_location) : "",
        surrender_date: record.surrender_date ? record.surrender_date.slice(0, 16) : "",
        details: record.details ?? "",
        latitude: record.latitude ?? "0",
        longitude: record.longitude ?? "0",
      });
      resetImages();
      setPersonPreview(resolveMediaUrl(record.person_image_url));
      const weapons: ExistingImage[] = [];
      const coverUrl = resolveMediaUrl(record.cover_image_url ?? record.weapon_image_url);
      if (coverUrl) {
        weapons.push({ key: "cover", imageId: -1, preview: coverUrl });
      }
      (record.images ?? [])
        .filter((img) => img.image_type === "weapon")
        .forEach((img) => {
          const url = resolveMediaUrl(img.file_url);
          if (url) weapons.push({ key: `img-${img.id}`, imageId: img.id, preview: url });
        });
      setWeaponExisting(weapons);
      const evidence: ExistingImage[] = (record.images ?? [])
        .filter((img) => img.image_type !== "weapon")
        .map((img) => ({
          key: `img-${img.id}`,
          imageId: img.id,
          preview: resolveMediaUrl(img.file_url) ?? "",
        }))
        .filter((img) => img.preview);
      setEvidenceExisting(evidence);
    } else if (!isEdit && prefillFrom) {
      setForm(recordToForm(prefillFrom));
      resetImages();
    }
  }, [open, isEdit, record, prefillFrom]);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const addPending = (
    setter: React.Dispatch<React.SetStateAction<PendingImage[]>>,
    files: FileList | File[],
    multiple: boolean,
  ) => {
    const next = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (!next.length) return;
    setter((prev) => {
      const added = (multiple ? next : [next[0]]).map(makePending);
      return multiple ? [...prev, ...added] : added;
    });
  };

  const removePending = (
    setter: React.Dispatch<React.SetStateAction<PendingImage[]>>,
    key: string,
  ) => {
    setter((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item) revokeBlob(item.preview);
      return prev.filter((i) => i.key !== key);
    });
  };

  const removeExisting = (key: string, imageId: number) => {
    if (imageId > 0) setRemovedImageIds((ids) => [...ids, imageId]);
    if (key === "cover" || imageId === -1) {
      setWeaponExisting((prev) => prev.filter((i) => i.key !== key));
      return;
    }
    if (weaponExisting.some((i) => i.key === key)) {
      setWeaponExisting((prev) => prev.filter((i) => i.key !== key));
    } else {
      setEvidenceExisting((prev) => prev.filter((i) => i.key !== key));
    }
  };

  const applyPersonFile = (file: File) => {
    if (personPreview?.startsWith("blob:")) revokeBlob(personPreview);
    setPersonFile(file);
    setPersonPreview(URL.createObjectURL(file));
  };

  const payload = () => ({
    person_name: form.person_name,
    police_station: form.police_station,
    phone_number: form.phone_number,
    force_unit: form.force_unit ? Number(form.force_unit) : null,
    force_number: form.force_number,
    rank: form.rank ? Number(form.rank) : null,
    weapon_type: form.weapon_type ? Number(form.weapon_type) : null,
    weapon_serial: form.weapon_serial,
    county: form.county ? Number(form.county) : null,
    surrender_location: form.surrender_location ? Number(form.surrender_location) : null,
    surrender_date: form.surrender_date || null,
    details: form.details,
    latitude: form.latitude,
    longitude: form.longitude,
  });

  const submit = async () => {
    if (!form.person_name.trim() || saving) return;
    setSaving(true);
    try {
      const coverFile = weaponPending[0]?.file;
      const extraWeaponFiles = weaponPending.slice(1).map((i) => i.file);
      const body = {
        ...payload(),
        personFile: personFile ?? undefined,
        coverFile,
      };

      let recordId = editId;
      if (isEdit && recordId) {
        await update.mutateAsync(body);
      } else {
        const created = await create.mutateAsync(body);
        recordId = created.id;
      }

      if (!recordId) return;

      for (const id of removedImageIds) {
        await deleteDisarmamentImage(id);
      }

      for (const file of extraWeaponFiles) {
        await uploadDisarmamentImage(recordId, file, { image_type: "weapon" });
      }

      for (const item of evidencePending) {
        await uploadDisarmamentImage(recordId, item.file, { image_type: "evidence" });
      }

      await qc.invalidateQueries({ queryKey: hubkadhigisKeys.all });
      await qc.invalidateQueries({ queryKey: hubkadhigisKeys.detail(recordId) });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const pending = saving || create.isPending || update.isPending;
  const isPage = variant === "page";

  const formBody = isEdit && isLoading ? (
    <p style={{ color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.permSaving}</p>
  ) : (
    <>
      <SectionCard title={t.hubPersonSection} description={t.hubPersonSectionSub} icon="badge" C={C} accent={accent} isDark={isDark}>
        <FormRow>
          <FormField label={t.hubPersonName} required C={C}>
            <TextInput value={form.person_name} onChange={(v) => set("person_name", v)} C={C} placeholder={t.hubPersonName} />
          </FormField>
          <FormField label={t.hubPhone} C={C}>
            <TextInput value={form.phone_number} onChange={(v) => set("phone_number", v)} C={C} placeholder="+252…" />
          </FormField>
        </FormRow>
        <FormField label={t.hubPoliceStation} C={C}>
          <TextInput value={form.police_station} onChange={(v) => set("police_station", v)} C={C} placeholder={t.hubPoliceStation} />
        </FormField>
        <ImageUploadPanel
          label={t.hubPersonPhoto}
          hint={t.hubUploadHint}
          multiple={false}
          pending={personFile && personPreview ? [{ key: "person", file: personFile, preview: personPreview }] : []}
          existing={!personFile && personPreview ? [{ key: "person-existing", imageId: -1, preview: personPreview }] : []}
          onAdd={(files) => { const f = Array.from(files)[0]; if (f) applyPersonFile(f); }}
          onRemovePending={() => {
            if (personPreview?.startsWith("blob:")) revokeBlob(personPreview);
            setPersonFile(null);
            setPersonPreview(null);
          }}
          onRemoveExisting={() => {
            setPersonFile(null);
            setPersonPreview(null);
          }}
          C={C}
          accent={accent}
          isDark={isDark}
          removeLabel={t.hubRemovePhoto}
        />
      </SectionCard>

      <SectionCard title={t.hubForceSection} description={t.hubForceSectionSub} icon="shield" C={C} accent={accent} isDark={isDark}>
        <FormRow>
          <FormField label={t.hubForceUnit} C={C}>
            <HubSelect
              value={form.force_unit}
              onChange={(v) => set("force_unit", v)}
              placeholder={t.hubSelectOption}
              options={(lookups?.force_units ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </FormField>
          <FormField label={t.hubRank} C={C}>
            <HubSelect
              value={form.rank}
              onChange={(v) => set("rank", v)}
              placeholder={t.hubSelectOption}
              options={(lookups?.ranks ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </FormField>
        </FormRow>
        <FormField label={t.hubForceNumber} C={C}>
          <TextInput value={form.force_number} onChange={(v) => set("force_number", v)} C={C} placeholder={t.hubForceNumber} />
        </FormField>
      </SectionCard>

      <SectionCard title={t.hubWeaponSection} description={t.hubWeaponSectionSub} icon="target" C={C} accent={accent} isDark={isDark}>
        <FormRow>
          <FormField label={t.hubWeaponType} C={C}>
            <HubSelect
              value={form.weapon_type}
              onChange={(v) => set("weapon_type", v)}
              placeholder={t.hubSelectOption}
              options={(lookups?.weapon_types ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </FormField>
          <FormField label={t.hubWeaponSerial} C={C}>
            <TextInput value={form.weapon_serial} onChange={(v) => set("weapon_serial", v)} C={C} placeholder={t.hubWeaponSerial} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t.colDistrict} C={C}>
            <HubSelect
              value={form.county}
              onChange={(v) => set("county", v)}
              placeholder={t.hubSelectOption}
              options={counties.map((c) => ({ value: String(c.id), label: c.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </FormField>
          <FormField label={t.hubSurrenderLocation} C={C}>
            <HubSelect
              value={form.surrender_location}
              onChange={(v) => set("surrender_location", v)}
              placeholder={t.hubSelectOption}
              options={(lookups?.surrender_locations ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </FormField>
        </FormRow>
        <FormField label={t.hubSurrenderDate} C={C}>
          <input type="datetime-local" value={form.surrender_date} onChange={(e) => set("surrender_date", e.target.value)} style={selectStyle(C, accent, !!form.surrender_date, isDark)} />
        </FormField>
        <ImageUploadPanel
          label={t.hubWeaponPhotos}
          hint={t.hubWeaponPhotosSub}
          multiple
          pending={weaponPending}
          existing={weaponExisting}
          onAdd={(files) => addPending(setWeaponPending, files, true)}
          onRemovePending={(key) => removePending(setWeaponPending, key)}
          onRemoveExisting={(key) => {
            const item = weaponExisting.find((i) => i.key === key);
            if (item) removeExisting(key, item.imageId);
          }}
          C={C}
          accent={accent}
          isDark={isDark}
          removeLabel={t.hubRemovePhoto}
        />
      </SectionCard>

      <SectionCard title={t.hubEvidenceGallery} description={t.hubEvidencePhotosSub} icon="grid" C={C} accent={accent} isDark={isDark}>
        <ImageUploadPanel
          label={t.hubEvidencePhotos}
          hint={t.hubUploadHint}
          multiple
          pending={evidencePending}
          existing={evidenceExisting}
          onAdd={(files) => addPending(setEvidencePending, files, true)}
          onRemovePending={(key) => removePending(setEvidencePending, key)}
          onRemoveExisting={(key) => {
            const item = evidenceExisting.find((i) => i.key === key);
            if (item) removeExisting(key, item.imageId);
          }}
          C={C}
          accent={accent}
          isDark={isDark}
          removeLabel={t.hubRemovePhoto}
        />
      </SectionCard>

      <SectionCard title={t.notes} description={t.hubNotesSectionSub} icon="clipboard" C={C} accent={accent} isDark={isDark}>
        <FormField label={t.notes} C={C}>
          <textarea
            value={form.details}
            onChange={(e) => set("details", e.target.value)}
            rows={4}
            placeholder={t.notes}
            style={{ ...selectStyle(C, undefined, false, isDark), resize: "vertical", cursor: "text" }}
          />
        </FormField>
      </SectionCard>
    </>
  );

  const footer = (
    <>
      <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
      <PrimaryButton accent={accent} onClick={submit} disabled={pending || !form.person_name.trim()}>
        {pending ? t.permSaving : isEdit ? t.userSave : t.hubAddRecord}
      </PrimaryButton>
    </>
  );

  if (isPage) {
    if (!open) return null;
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: 22, color: C.txtPrimary, margin: 0 }}>
            {isEdit ? t.hubEditRecord : t.hubAddRecord}
          </h2>
          <p style={{ color: C.txtMuted, fontFamily: "var(--font-outfit)", marginTop: 6 }}>
            {isEdit ? t.hubEditRecordSub : t.hubAddRecordSub}
          </p>
        </div>
        {formBody}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>{footer}</div>
      </div>
    );
  }

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={isEdit ? t.hubEditRecord : t.hubAddRecord}
      subtitle={isEdit ? t.hubEditRecordSub : t.hubAddRecordSub}
      C={C}
      accent={accent}
      size="xl"
      footer={footer}
    >
      {formBody}
    </AccountModal>
  );
}
