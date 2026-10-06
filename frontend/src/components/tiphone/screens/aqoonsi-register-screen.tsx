"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TipApi } from "@/lib/tiphone/api";
import type { LookupRow, StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { clampPhoneInput, digitsOnly, PHONE_DIGIT_COUNT } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { FloatingInput } from "../floating-input";
import { GoldButton } from "../gold-button";
import { TipToast } from "../toast";

type Step = 0 | 1 | 2 | 3;

const STEPS = ["Sawir & Aqoonsi", "Degganaansho", "Xiriir & Shaqo", "Qoys & Dukumenti"];

function yearFromAge(ageStr: string): number | null {
  const age = Number.parseInt(String(ageStr).replace(/\D/g, ""), 10);
  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  return new Date().getFullYear() - age;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function composeDob(year: number, month: number, day: number): string {
  const maxDay = daysInMonth(year, month);
  const safeDay = Math.min(Math.max(1, day), maxDay);
  const m = String(month).padStart(2, "0");
  const d = String(safeDay).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseDobParts(iso: string): { year: number; month: number; day: number } | null {
  if (!iso || iso.length < 8) return null;
  const [ys, ms, ds] = iso.split("-");
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

type FormState = {
  name: string;
  mother: string;
  gender: string;
  date_of_birth: string;
  age_reported: string;
  address_county_id: string;
  waaxda: string;
  xaafadda: string;
  ijaar_ama_milkiyad: "" | "Ijaar" | "Milkiyad";
  mudada_uu_deggan_yahay: string;
  yaa_ka_ijaaray: string;
  hormuud: string;
  somnet: string;
  somtel: string;
  nuuca_shaqada: string;
  goobta_shaqada: string;
  maamulaha_shaqada: string;
  muddada_shaqada: string;
  xaaladda_guurka: "" | "Guurday" | "Aan guursan";
  tirada_carruurta: string;
  tirada_dadka_guriga: string;
  qof_degdeg: string;
  qabiilka: string;
  gobolka_kasoo_jeedo: string;
  horay_maloo_xiray: string;
  nira: string;
  baasaboor: string;
  qoraallo_dheeraad: string;
};

const emptyForm = (): FormState => ({
  name: "",
  mother: "",
  gender: "",
  date_of_birth: "",
  age_reported: "",
  address_county_id: "",
  waaxda: "",
  xaafadda: "",
  ijaar_ama_milkiyad: "",
  mudada_uu_deggan_yahay: "",
  yaa_ka_ijaaray: "",
  hormuud: "",
  somnet: "",
  somtel: "",
  nuuca_shaqada: "",
  goobta_shaqada: "",
  maamulaha_shaqada: "",
  muddada_shaqada: "",
  xaaladda_guurka: "",
  tirada_carruurta: "0",
  tirada_dadka_guriga: "0",
  qof_degdeg: "",
  qabiilka: "",
  gobolka_kasoo_jeedo: "",
  horay_maloo_xiray: "",
  nira: "",
  baasaboor: "",
  qoraallo_dheeraad: "",
});

const ACCENT = { main: "#7AD9B5", mainRgb: "122, 217, 181" };

function ChoiceToggle({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <div className="space-y-1.5">
      <p className="text-[12px]" style={{ color: colors.inkMut }}>
        {label}
        {required ? <span style={{ color: ACCENT.main }}> *</span> : null}
      </p>
      <div className={`grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map((opt) => {
          const selected = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className="rounded-2xl border py-3 text-sm font-semibold transition"
              style={{
                borderColor: selected ? ACCENT.main : rgba(colors.lineRgb, 0.12),
                background: selected ? rgba(ACCENT.mainRgb, 0.15) : rgba(colors.lineRgb, 0.04),
                color: selected ? ACCENT.main : colors.ink1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <label className="block">
      <span className="text-[12px] font-semibold" style={{ color: colors.inkMut }}>
        {label}
        {required ? <span style={{ color: ACCENT.main }}> *</span> : null}
      </span>
      <select
        disabled={disabled}
        className="mt-1.5 w-full rounded-2xl border px-3.5 py-3.5 text-sm outline-none disabled:opacity-50"
        style={{
          background: rgba(colors.surfRgb, 0.8),
          borderColor: rgba(colors.lineRgb, 0.15),
          color: value ? colors.ink0 : colors.ink3,
          minHeight: 56,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhoneChecks({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { colors } = useTipTheme();
  const [open, setOpen] = useState({
    hormuud: Boolean(form.hormuud),
    somnet: Boolean(form.somnet),
    somtel: Boolean(form.somtel),
  });

  const rows: { key: "hormuud" | "somnet" | "somtel"; label: string }[] = [
    { key: "hormuud", label: "Hormuud" },
    { key: "somnet", label: "Somnet" },
    { key: "somtel", label: "Somtel" },
  ];

  return (
    <div className="space-y-2.5">
      <p className="text-[12px]" style={{ color: colors.inkMut }}>
        Telefoonada * — dooro mid ama ka badan
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const on = open[r.key];
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setOpen((prev) => {
                  const next = !prev[r.key];
                  if (!next) setField(r.key, "" as FormState[typeof r.key]);
                  return { ...prev, [r.key]: next };
                });
              }}
              className="rounded-full border px-3.5 py-2 text-xs font-semibold"
              style={{
                borderColor: on ? ACCENT.main : rgba(colors.lineRgb, 0.18),
                background: on ? rgba(ACCENT.mainRgb, 0.18) : "transparent",
                color: on ? ACCENT.main : colors.ink1,
              }}
            >
              {on ? "✓ " : ""}
              {r.label}
            </button>
          );
        })}
      </div>
      {rows.map((r) =>
        open[r.key] ? (
          <FloatingInput
            key={r.key}
            label={`${r.label}${r.key === "hormuud" ? "" : ""}`}
            value={form[r.key]}
            onChange={(v) => setField(r.key, clampPhoneInput(v))}
            inputMode="tel"
            maxLength={PHONE_DIGIT_COUNT}
          />
        ) : null,
      )}
    </div>
  );
}

export function AqoinsiRegisterScreen({
  auth,
  initialPhone,
  onBack,
  onMenu,
  onDone,
}: {
  auth: StoredAuth;
  initialPhone?: string;
  onBack: () => void;
  onMenu: () => void;
  onDone: (created?: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(() => {
    const f = emptyForm();
    if (initialPhone) f.hormuud = clampPhoneInput(initialPhone);
    return f;
  });
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [counties, setCounties] = useState<LookupRow[]>([]);
  const [subCounties, setSubCounties] = useState<{ id: number; name: string }[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ kind?: "success" | "error" | "info"; title: string; message?: string } | null>(null);

  useEffect(() => {
    TipApi.fetchCounties()
      .then((rows) => setCounties(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setCounties([]));
  }, []);

  useEffect(() => {
    if (!form.address_county_id) {
      setSubCounties([]);
      return;
    }
    let cancelled = false;
    setSubsLoading(true);
    TipApi.fetchSubCounties(form.address_county_id)
      .then((rows) => {
        if (!cancelled) setSubCounties(rows);
      })
      .catch(() => {
        if (!cancelled) setSubCounties([]);
      })
      .finally(() => {
        if (!cancelled) setSubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.address_county_id]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validateStep = useCallback((): string | null => {
    if (step === 0) {
      if (!form.name.trim()) return "Magaca waa loo baahan yahay.";
      if (!form.mother.trim()) return "Magaca hooyada waa loo baahan yahay.";
      if (!form.gender) return "Dooro jinsiga.";
    }
    if (step === 1) {
      if (!form.address_county_id) return "Dooro degmada.";
      if (!form.ijaar_ama_milkiyad) return "Dooro Ijaar ama Milkiyad.";
      if (form.ijaar_ama_milkiyad === "Ijaar" && !form.yaa_ka_ijaaray.trim()) {
        return "Qor yaa ka ijaaray.";
      }
    }
    if (step === 2) {
      const phone = digitsOnly(form.hormuud || form.somnet || form.somtel);
      if (phone.length < 9) return "Ugu yaraan hal lambar telefoon ah ayaa loo baahan yahay.";
    }
    if (step === 3) {
      if (!form.xaaladda_guurka) return "Dooro xaaladda guurka.";
    }
    return null;
  }, [form, step]);

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(3, s + 1) as Step);
  };

  const back = () => {
    setError("");
    if (step === 0) onBack();
    else setStep((s) => Math.max(0, s - 1) as Step);
  };

  const submit = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      const payload: Record<string, string> = { ...form };
      if (payload.ijaar_ama_milkiyad !== "Ijaar") payload.yaa_ka_ijaaray = "";
      if (payload.xaaladda_guurka !== "Guurday") payload.tirada_carruurta = "0";
      Object.entries(payload).forEach(([k, v]) => {
        if (v != null && String(v).trim() !== "") fd.append(k, String(v));
      });
      if (picture) fd.append("picture", picture);
      const res = await TipApi.registerBaarisCitizen(fd);
      if (!res.ok) {
        setError(res.message);
        setToast({ kind: "error", title: "Fashil", message: res.message });
        return;
      }
      setToast({ kind: "success", title: "Waa la diiwaan geliyey", message: "Gaadiidka ku dar profile-ka." });
      const created: SuspectListRow | undefined = res.suspectId
        ? {
            id: res.suspectId,
            name: form.name.trim(),
            mother: form.mother.trim(),
            gender: form.gender,
            tnumber: form.hormuud || form.somnet || form.somtel,
            source: "baaris",
            degmada: counties.find((c) => String(c.id) === form.address_county_id)?.name,
            waaxda: form.waaxda || undefined,
          }
        : undefined;
      setTimeout(() => onDone(created), 500);
    } finally {
      setSubmitting(false);
    }
  };

  const countyOptions = useMemo(
    () => counties.map((c) => ({ value: String(c.id), label: c.name })),
    [counties],
  );
  const waaxOptions = useMemo(
    () => subCounties.map((s) => ({ value: s.name, label: s.name })),
    [subCounties],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenAppBar title="Aqoonsiga Muwaadinka" onBack={back} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-28 pt-3">
        <div className="mb-4 flex gap-1">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: i <= step ? colors.gold : rgba(colors.lineRgb, 0.2) }}
              title={label}
            />
          ))}
        </div>
        <p className="mb-3 text-xs font-semibold" style={{ color: colors.inkMut }}>
          {STEPS[step]} · {auth.user.firstName || auth.user.username}
        </p>

        {step === 0 ? (
          <div className="space-y-3">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6"
              style={{ borderColor: rgba(colors.lineRgb, 0.25), background: rgba(colors.surfRgb, 0.5) }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-28 w-28 rounded-2xl object-cover" />
              ) : (
                <span className="text-sm" style={{ color: colors.inkMut }}>
                  Sawirka qofka (taabo)
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPicture(file);
                  if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
            <FloatingInput label="Magaca oo buuxa *" value={form.name} onChange={(v) => setField("name", v)} />
            <FloatingInput label="Magaca hooyada *" value={form.mother} onChange={(v) => setField("mother", v)} />
            <ChoiceToggle
              label="Jinsiga"
              required
              value={form.gender}
              onChange={(v) => setField("gender", v)}
              options={[
                { key: "Lab", label: "Lab" },
                { key: "Dhidig", label: "Dhedig" },
              ]}
            />
            <FloatingInput
              label="Da'da *"
              value={form.age_reported}
              onChange={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, 3);
                const year = yearFromAge(digits);
                setForm((prev) => {
                  if (year == null) {
                    return { ...prev, age_reported: digits, date_of_birth: "" };
                  }
                  const parts = parseDobParts(prev.date_of_birth);
                  const month = parts?.month ?? 1;
                  const day = parts?.day ?? 1;
                  return {
                    ...prev,
                    age_reported: digits,
                    date_of_birth: composeDob(year, month, day),
                  };
                });
              }}
              inputMode="numeric"
            />
            {form.age_reported && yearFromAge(form.age_reported) != null ? (
              <div className="space-y-2">
                <p className="text-[12px]" style={{ color: colors.inkMut }}>
                  Taariikhda dhalashada — bisha iyo maalinta waa la beddeli karaa
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold" style={{ color: colors.inkMut }}>Sanadka</span>
                    <div
                      className="mt-1 rounded-2xl border px-3 py-3.5 text-sm font-semibold"
                      style={{
                        background: rgba(colors.surfRgb, 0.8),
                        borderColor: rgba(colors.lineRgb, 0.15),
                        color: colors.ink0,
                      }}
                    >
                      {yearFromAge(form.age_reported)}
                    </div>
                  </label>
                  <SelectField
                    label="Bisha"
                    value={String(parseDobParts(form.date_of_birth)?.month ?? 1)}
                    placeholder="Bil"
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      label: String(i + 1),
                    }))}
                    onChange={(v) => {
                      const year = yearFromAge(form.age_reported);
                      if (year == null) return;
                      const month = Number(v) || 1;
                      const day = parseDobParts(form.date_of_birth)?.day ?? 1;
                      setField("date_of_birth", composeDob(year, month, day));
                    }}
                  />
                  <SelectField
                    label="Maalinta"
                    value={String(parseDobParts(form.date_of_birth)?.day ?? 1)}
                    placeholder="Maalin"
                    options={Array.from(
                      {
                        length: daysInMonth(
                          yearFromAge(form.age_reported)!,
                          parseDobParts(form.date_of_birth)?.month ?? 1,
                        ),
                      },
                      (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
                    )}
                    onChange={(v) => {
                      const year = yearFromAge(form.age_reported);
                      if (year == null) return;
                      const month = parseDobParts(form.date_of_birth)?.month ?? 1;
                      const day = Number(v) || 1;
                      setField("date_of_birth", composeDob(year, month, day));
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <SelectField
              label="Degmada"
              required
              value={form.address_county_id}
              placeholder="Dooro degmo"
              options={countyOptions}
              onChange={(v) => {
                setField("address_county_id", v);
                setField("waaxda", "");
              }}
            />
            <SelectField
              label="Waaxda"
              value={form.waaxda}
              placeholder={subsLoading ? "Waa la soo rarayaa…" : form.address_county_id ? "Dooro waax" : "Marka hore dooro degmo"}
              options={waaxOptions}
              disabled={!form.address_county_id || subsLoading || waaxOptions.length === 0}
              onChange={(v) => setField("waaxda", v)}
            />
            <FloatingInput label="Xaafadda" value={form.xaafadda} onChange={(v) => setField("xaafadda", v)} />
            <ChoiceToggle
              label="Guriga"
              required
              value={form.ijaar_ama_milkiyad}
              onChange={(v) => {
                setField("ijaar_ama_milkiyad", v as FormState["ijaar_ama_milkiyad"]);
                if (v !== "Ijaar") setField("yaa_ka_ijaaray", "");
              }}
              options={[
                { key: "Ijaar", label: "Ijaar" },
                { key: "Milkiyad", label: "Milkiyad" },
              ]}
            />
            {form.ijaar_ama_milkiyad === "Ijaar" ? (
              <FloatingInput
                label="Yaa ka ijaaray *"
                value={form.yaa_ka_ijaaray}
                onChange={(v) => setField("yaa_ka_ijaaray", v)}
              />
            ) : null}
            <FloatingInput
              label="Mudada uu deggan yahay"
              value={form.mudada_uu_deggan_yahay}
              onChange={(v) => setField("mudada_uu_deggan_yahay", v)}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <PhoneChecks form={form} setField={setField} />
            <FloatingInput label="Nuuca shaqada" value={form.nuuca_shaqada} onChange={(v) => setField("nuuca_shaqada", v)} />
            <FloatingInput label="Goobta shaqada" value={form.goobta_shaqada} onChange={(v) => setField("goobta_shaqada", v)} />
            <FloatingInput label="Maamulaha shaqada" value={form.maamulaha_shaqada} onChange={(v) => setField("maamulaha_shaqada", v)} />
            <FloatingInput label="Muddada shaqada" value={form.muddada_shaqada} onChange={(v) => setField("muddada_shaqada", v)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <ChoiceToggle
              label="Xaaladda guurka"
              required
              value={form.xaaladda_guurka}
              onChange={(v) => {
                setField("xaaladda_guurka", v as FormState["xaaladda_guurka"]);
                if (v !== "Guurday") setField("tirada_carruurta", "0");
              }}
              options={[
                { key: "Guurday", label: "Guurday" },
                { key: "Aan guursan", label: "Aan guursan" },
              ]}
            />
            {form.xaaladda_guurka === "Guurday" ? (
              <FloatingInput
                label="Tirada carruurta"
                value={form.tirada_carruurta}
                onChange={(v) => setField("tirada_carruurta", v)}
                inputMode="numeric"
              />
            ) : null}
            <FloatingInput
              label="Tirada dadka guriga"
              value={form.tirada_dadka_guriga}
              onChange={(v) => setField("tirada_dadka_guriga", v)}
              inputMode="numeric"
            />
            <FloatingInput label="Qof degdeg" value={form.qof_degdeg} onChange={(v) => setField("qof_degdeg", v)} />
            <FloatingInput label="Qabiilka" value={form.qabiilka} onChange={(v) => setField("qabiilka", v)} />
            <FloatingInput
              label="Gobolka kasoo jeedo"
              value={form.gobolka_kasoo_jeedo}
              onChange={(v) => setField("gobolka_kasoo_jeedo", v)}
            />
            <ChoiceToggle
              label="Horay maloo xiray?"
              value={form.horay_maloo_xiray}
              onChange={(v) => setField("horay_maloo_xiray", v)}
              options={[
                { key: "Haa", label: "Haa" },
                { key: "Maya", label: "Maya" },
              ]}
            />
            <FloatingInput label="NIRA" value={form.nira} onChange={(v) => setField("nira", v)} />
            <FloatingInput label="Baasaboor" value={form.baasaboor} onChange={(v) => setField("baasaboor", v)} />
            <FloatingInput
              label="Qoraallo (ikhtiyaari)"
              value={form.qoraallo_dheeraad}
              onChange={(v) => setField("qoraallo_dheeraad", v)}
            />
            <p className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: rgba(colors.surfRgb, 0.5), color: colors.inkMut }}>
              Gaadiidka waxaa lagu dari doonaa profile-ka kadib diiwaangelinta (sida suspects). Sarkaalka waa adiga oo gudaha ah.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm" style={{ color: "#e87b6b" }}>
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex w-full max-w-lg gap-2 px-4 py-3"
        style={{ background: `linear-gradient(180deg, transparent, ${colors.bg0} 30%)` }}
      >
        <button
          type="button"
          className="flex-1 rounded-2xl border px-4 py-3.5 text-[15px] font-semibold"
          style={{ borderColor: rgba(colors.lineRgb, 0.2), color: colors.ink0 }}
          onClick={back}
        >
          Dib
        </button>
        {step < 3 ? (
          <GoldButton className="flex-[2]" onClick={next}>
            Xiga
          </GoldButton>
        ) : (
          <GoldButton className="flex-[2]" onClick={submit} loading={submitting}>
            Diiwaan geli
          </GoldButton>
        )}
      </div>

      {toast ? (
        <TipToast
          kind={toast.kind}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
