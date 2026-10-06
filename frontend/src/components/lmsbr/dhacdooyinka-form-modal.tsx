"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { sanitizeRichHtml } from "@/lib/lmsbr/rich-text";
import { Icon } from "./icon";
import {
  useCreateDhacdooyinkaRecord,
  useDhacdooyinkaLookups,
  useDhacdooyinkaRecord,
  useUpdateDhacdooyinkaRecord,
} from "@/hooks/use-dhacdooyinka";
import type { DhacdooyinkaVictim } from "@/types/dhacdooyinka";
import {
  AccountModal,
  DateInput,
  MultiFileChooser,
  FormField,
  FormRow,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { AccountsRichTextField } from "./rich-text-field";

type VictimRow = DhacdooyinkaVictim & { key: string; documentFiles: File[] };

function ExistingFilesList({
  files,
  C,
  accent,
}: {
  files: { id: number; name?: string | null; url: string | null }[];
  C: AccountsThemeColors;
  accent: string;
}) {
  if (!files.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
      {files.map((f) => (
        <a
          key={f.id}
          href={f.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12.5, color: accent, fontFamily: "var(--font-outfit)",
            textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {f.name || "File"}
        </a>
      ))}
    </div>
  );
}

type FormState = {
  gobolka: string;
  degmada: string;
  waaxda: string;
  laanta: string;
  nooca_dhacdada: string;
  cidda_fulisay: string;
  dhimasho: string;
  dhaawac: string;
  khasaaraha_dhacdada: string;
  latitude: string;
  longitude: string;
  date_opp: string;
  tafaasiisha_goobta_dhacdada: string;
};

const emptyVictim = (): VictimRow => ({
  key: crypto.randomUUID(),
  magaca: "",
  dada_dh: "",
  gender: "",
  xalada: "",
  phone: "",
  fahfaahin: "",
  documentFiles: [],
});

const emptyForm = (): FormState => ({
  gobolka: "",
  degmada: "",
  waaxda: "",
  laanta: "",
  nooca_dhacdada: "",
  cidda_fulisay: "",
  dhimasho: "0",
  dhaawac: "0",
  khasaaraha_dhacdada: "",
  latitude: "0",
  longitude: "0",
  date_opp: "",
  tafaasiisha_goobta_dhacdada: "",
});

function toPayload(form: FormState, victims: VictimRow[]) {
  const rows = victims.filter((v) => v.magaca?.trim());
  return {
    payload: {
      gobolka: form.gobolka ? Number(form.gobolka) : null,
      degmada: form.degmada ? Number(form.degmada) : null,
      waaxda: form.waaxda ? Number(form.waaxda) : null,
      laanta: form.laanta ? Number(form.laanta) : null,
      nooca_dhacdada: form.nooca_dhacdada ? Number(form.nooca_dhacdada) : null,
      cidda_fulisay: form.cidda_fulisay,
      dhimasho: form.dhimasho,
      dhaawac: form.dhaawac,
      khasaaraha_dhacdada: form.khasaaraha_dhacdada,
      latitude: form.latitude,
      longitude: form.longitude,
      date_opp: form.date_opp || null,
      tafaasiisha_goobta_dhacdada: form.tafaasiisha_goobta_dhacdada.trim()
        ? sanitizeRichHtml(form.tafaasiisha_goobta_dhacdada.trim())
        : "",
      victims: rows.map(({ key: _k, id: _id, documents: _docs, documentFiles: _files, ...rest }) => rest),
    },
    victimDocuments: rows.map((v) => v.documentFiles),
  };
}

export function DhacdooyinkaFormModal({
  open,
  onClose,
  recordId,
  C,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  recordId?: number | null;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const isEdit = recordId != null;
  const { data: lookups } = useDhacdooyinkaLookups();
  const { data: existing } = useDhacdooyinkaRecord(isEdit ? recordId : null);
  const create = useCreateDhacdooyinkaRecord();
  const update = useUpdateDhacdooyinkaRecord();

  const [form, setForm] = useState(emptyForm);
  const [victims, setVictims] = useState<VictimRow[]>([emptyVictim()]);
  const [eventEvidence, setEventEvidence] = useState<File[]>([]);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setEventEvidence([]);
    if (existing && isEdit) {
      setForm({
        gobolka: existing.gobolka ? String(existing.gobolka) : "",
        degmada: existing.degmada ? String(existing.degmada) : "",
        waaxda: existing.waaxda ? String(existing.waaxda) : "",
        laanta: existing.laanta ? String(existing.laanta) : "",
        nooca_dhacdada: existing.nooca_dhacdada ? String(existing.nooca_dhacdada) : "",
        cidda_fulisay: existing.cidda_fulisay ?? "",
        dhimasho: existing.dhimasho ?? "0",
        dhaawac: existing.dhaawac ?? "0",
        khasaaraha_dhacdada: existing.khasaaraha_dhacdada ?? "",
        latitude: existing.latitude ?? "0",
        longitude: existing.longitude ?? "0",
        date_opp: existing.date_opp ?? "",
        tafaasiisha_goobta_dhacdada: existing.tafaasiisha_goobta_dhacdada || existing.fahfaahin || "",
      });
      setVictims(
        existing.victims?.length
          ? existing.victims.map((v) => ({ ...v, key: crypto.randomUUID(), documentFiles: [] }))
          : [emptyVictim()],
      );
    } else if (!isEdit) {
      setForm(emptyForm());
      setVictims([emptyVictim()]);
      setEventEvidence([]);
    }
  }, [open, existing, isEdit]);

  useEffect(() => {
    if (!open || isEdit) return;
    setForm((f) => ({ ...f, degmada: "", waaxda: "", laanta: "" }));
  }, [form.gobolka, open, isEdit]);

  useEffect(() => {
    if (!open || isEdit) return;
    setForm((f) => ({ ...f, waaxda: "", laanta: "" }));
  }, [form.degmada, open, isEdit]);

  useEffect(() => {
    if (!open || isEdit) return;
    setForm((f) => ({ ...f, laanta: "" }));
  }, [form.waaxda, open, isEdit]);

  const counties = useMemo(
    () => (lookups?.counties ?? []).filter((c) => !form.gobolka || String(c.region) === form.gobolka),
    [lookups?.counties, form.gobolka],
  );
  const subCounties = useMemo(
    () => (lookups?.sub_counties ?? []).filter((s) => !form.degmada || String(s.county) === form.degmada),
    [lookups?.sub_counties, form.degmada],
  );
  const sections = useMemo(
    () => (lookups?.sections ?? []).filter((s) => !form.waaxda || String(s.sub_county) === form.waaxda),
    [lookups?.sections, form.waaxda],
  );

  if (!open) return null;

  const pending = create.isPending || update.isPending;

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={isEdit ? t.dhacdoEditEvent : t.dhacdoAddEvent}
      subtitle={t.dhacdoFormSub}
      C={C}
      accent={accent}
      size="lg"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              const { payload, victimDocuments } = toPayload(form, victims);
              if (isEdit && recordId) {
                update.mutate({ id: recordId, payload, eventEvidence, victimDocuments }, { onSuccess: onClose });
              } else {
                create.mutate({ payload, eventEvidence, victimDocuments }, { onSuccess: onClose });
              }
            }}
            disabled={pending}
            accent={accent}
          >
            {pending ? t.permSaving : t.dhacdoRegister}
          </PrimaryButton>
        </>
      }
    >
      <FormRow columns={2}>
        <FormField label={t.dhacdoGobolka} C={C}>
          <SelectInput value={form.gobolka} onChange={set("gobolka")} C={C} accent={accent} active={!!form.gobolka}>
            <option value="">{t.dhacdoSelectGobolka}</option>
            {(lookups?.regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label={t.dhacdoDegmada} C={C}>
          <SelectInput value={form.degmada} onChange={set("degmada")} C={C} accent={accent} active={!!form.degmada}>
            <option value="">{t.dhacdoSelectDegmada}</option>
            {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoWaaxda} C={C}>
          <SelectInput value={form.waaxda} onChange={set("waaxda")} C={C} accent={accent} active={!!form.waaxda}>
            <option value="">{t.dhacdoSelectWaaxda}</option>
            {subCounties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label={t.dhacdoLaanta} C={C}>
          <SelectInput value={form.laanta} onChange={set("laanta")} C={C} accent={accent} active={!!form.laanta}>
            <option value="">{t.dhacdoSelectLaanta}</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoNoocaType} C={C}>
          <SelectInput value={form.nooca_dhacdada} onChange={set("nooca_dhacdada")} C={C} accent={accent} active={!!form.nooca_dhacdada}>
            <option value="">{t.dhacdoSelectNooca}</option>
            {(lookups?.nooca_types ?? []).map((n) => <option key={n.id} value={n.id}>{n.type}</option>)}
          </SelectInput>
        </FormField>
        <FormField label={t.dhacdoCiddaFulisay} C={C}>
          <TextInput value={form.cidda_fulisay} onChange={set("cidda_fulisay")} placeholder={t.dhacdoCiddaFulisay} C={C} />
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoDhimasho} C={C}>
          <TextInput value={form.dhimasho} onChange={set("dhimasho")} type="number" C={C} />
        </FormField>
        <FormField label={t.dhacdoDhaawac} C={C}>
          <TextInput value={form.dhaawac} onChange={set("dhaawac")} type="number" C={C} />
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoKhasaaroKale} C={C}>
          <TextInput value={form.khasaaraha_dhacdada} onChange={set("khasaaraha_dhacdada")} C={C} />
        </FormField>
        <FormField label={t.dhacdoTaariikhda} C={C}>
          <DateInput value={form.date_opp} onChange={set("date_opp")} C={C} accent={accent} />
        </FormField>
      </FormRow>

      <FormRow columns={2}>
        <FormField label={t.dhacdoLatitude} C={C}>
          <TextInput value={form.latitude} onChange={set("latitude")} C={C} />
        </FormField>
        <FormField label={t.dhacdoLongitude} C={C}>
          <TextInput value={form.longitude} onChange={set("longitude")} C={C} />
        </FormField>
      </FormRow>

      <FormField label={t.dhacdoDescription} C={C}>
        <AccountsRichTextField
          value={form.tafaasiisha_goobta_dhacdada}
          onChange={set("tafaasiisha_goobta_dhacdada")}
          C={C}
          accent={accent}
          placeholder={t.dhacdoDescription}
          ariaLabel={t.dhacdoDescription}
          minHeight={160}
          disabled={pending}
        />
      </FormField>

      <div style={{ marginTop: 8, marginBottom: 12, fontFamily: "var(--font-cinzel)", fontWeight: 600, color: C.txtPrimary }}>
        {t.dhacdoVictimsSection}
      </div>

      {victims.map((v, idx) => (
        <div key={v.key} style={{ marginBottom: 14, padding: 14, borderRadius: 12, border: `1px solid ${C.cardBdr}`, background: hexA(accent, 0.04) }}>
          <FormRow columns={2}>
            <FormField label={t.dhacdoVictimName} C={C}>
              <TextInput value={v.magaca ?? ""} onChange={(val) => setVictims((rows) => rows.map((r, i) => i === idx ? { ...r, magaca: val } : r))} C={C} />
            </FormField>
            <FormField label={t.dhacdoVictimGender} C={C}>
              <SelectInput
                value={v.gender ?? ""}
                onChange={(val) => setVictims((rows) => rows.map((r, i) => i === idx ? { ...r, gender: val } : r))}
                C={C}
                accent={accent}
                active={!!v.gender}
              >
                <option value="">{t.dhacdoSelectGender}</option>
                <option value="Lab">Lab</option>
                <option value="Dhedig">Dhedig</option>
              </SelectInput>
            </FormField>
          </FormRow>
          <FormRow columns={2}>
            <FormField label={t.dhacdoVictimPhone} C={C}>
              <TextInput value={v.phone ?? ""} onChange={(val) => setVictims((rows) => rows.map((r, i) => i === idx ? { ...r, phone: val } : r))} C={C} />
            </FormField>
            <FormField label={t.dhacdoVictimStatus} C={C}>
              <TextInput value={v.xalada ?? ""} onChange={(val) => setVictims((rows) => rows.map((r, i) => i === idx ? { ...r, xalada: val } : r))} C={C} />
            </FormField>
          </FormRow>
          <FormField label={t.dhacdoVictimDocument} C={C}>
            {v.documents?.length ? (
              <ExistingFilesList
                files={v.documents.map((d) => ({ id: d.id, name: d.name, url: d.document_url }))}
                C={C}
                accent={accent}
              />
            ) : null}
            <MultiFileChooser
              files={v.documentFiles}
              onChange={(files) => setVictims((rows) => rows.map((r, i) => i === idx ? { ...r, documentFiles: files } : r))}
              C={C}
              accent={accent}
              hint={t.dhacdoEvidenceUploadHint}
              formatsHint={t.dhacdoEvidenceFormats}
              removeLabel={t.dhacdoEvidenceRemove}
            />
          </FormField>
          {victims.length > 1 && (
            <button
              type="button"
              onClick={() => setVictims((rows) => rows.filter((_, i) => i !== idx))}
              style={{ marginTop: 8, background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13 }}
            >
              {t.deleteAction}
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setVictims((rows) => [...rows, emptyVictim()])}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px dashed ${hexA(accent, 0.5)}`, background: "transparent", color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)", marginBottom: 16 }}
      >
        <Icon name="plus" size={16} sw={2} /> {t.dhacdoAddVictim}
      </button>

      <FormField label={t.dhacdoEvidence} C={C}>
        {(existing?.documents?.length || existing?.upload_document_url) ? (
          <ExistingFilesList
            files={[
              ...(existing?.upload_document_url
                ? [{ id: -1, name: t.dhacdoEvidenceCurrent, url: existing.upload_document_url }]
                : []),
              ...(existing?.documents ?? []).map((d) => ({ id: d.id, name: d.name, url: d.url })),
            ]}
            C={C}
            accent={accent}
          />
        ) : null}
        <MultiFileChooser
          files={eventEvidence}
          onChange={setEventEvidence}
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
