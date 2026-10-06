"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Loader2,
  Phone,
  Search,
  User,
} from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import type { DamiinMode, RegisterFieldErrors, StoredAuth } from "@/lib/tiphone/types";
import { useRegisterForm } from "@/lib/tiphone/use-register-form";
import {
  clampPhoneInput,
  damiinLookupLabel,
  islaDamiinLabel,
  PHONE_DIGIT_COUNT,
} from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { FloatingInput } from "../floating-input";
import { TipToast } from "../toast";
import { ListRowShimmer } from "../shimmer";
import { useSwipeBackHandler } from "../ios-swipe-back";

const ACCENT = {
  main: "#7AD9B5",
  mainRgb: "122, 217, 181",
  mainDeep: "#52C49A",
  onMain: "#0A2A1E",
};

const STEPS = [so.suspectRegStep1, so.suspectRegStep2, so.suspectRegStep3] as const;

const DAMIIN_MODES: Exclude<DamiinMode, "no_damiin">[] = [
  "new_damiin",
  "isla_damiin",
  "dhamaan_damiin",
];

type PickerKey =
  | "addressCounty"
  | "captureCounty"
  | "captureSubCounty"
  | "suspectType"
  | "damiinCounty"
  | "relationship"
  | "existingDamiin"
  | null;

function damiinModeLabel(mode: DamiinMode): string {
  if (mode === "isla_damiin") return so.suspectRegDamiinSelf;
  if (mode === "dhamaan_damiin") return so.suspectRegDamiinExisting;
  return so.suspectRegDamiinNew;
}

function ProgressSteps({ current }: { current: number }) {
  const { colors } = useTipTheme();
  return (
    <div className="grid grid-cols-3 gap-2 px-1">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        const fill = done ? "100%" : active ? "55%" : "0%";
        return (
          <div key={label} className="min-w-0">
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: rgba(colors.lineRgb, 0.1) }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: fill,
                  background: ACCENT.mainDeep,
                  boxShadow: active || done ? `0 0 8px rgba(${ACCENT.mainRgb}, 0.45)` : undefined,
                }}
              />
            </div>
            <p
              className="mt-1.5 truncate text-center text-[11px] font-semibold"
              style={{ color: active ? ACCENT.main : done ? colors.ink0 : colors.ink3 }}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTipTheme();
  return (
    <section
      className="space-y-3 rounded-3xl border p-4"
      style={{
        borderColor: rgba(ACCENT.mainRgb, 0.22),
        background: rgba(colors.surfRgb, 0.55),
      }}
    >
      <div>
        <h2 className="text-[15px] font-bold" style={{ color: colors.ink0 }}>
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: colors.ink2 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PickerField({
  label,
  value,
  onPress,
  disabled,
  error,
  required,
  loading,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  loading?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <div>
      <button
        type="button"
        onClick={disabled || loading ? undefined : onPress}
        disabled={disabled || loading}
        className="w-full rounded-2xl border px-3.5 py-3 text-left transition disabled:opacity-50"
        style={{
          background: rgba(colors.hiRgb, 0.04),
          borderColor: error ? "rgba(232,123,107,0.45)" : rgba(colors.lineRgb, 0.12),
          minHeight: 64,
        }}
      >
        <p className="text-[11px] font-semibold" style={{ color: colors.inkMut }}>
          {label}
          {required ? <span style={{ color: ACCENT.main }}> *</span> : null}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ACCENT.main }} /> : null}
          <p className="text-[14px]" style={{ color: value ? colors.ink0 : colors.ink3 }}>
            {value || so.suspectRegPick}
          </p>
        </div>
      </button>
      {error ? (
        <p className="mt-1.5 px-1 text-xs" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GenderToggle({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
}) {
  const { colors } = useTipTheme();
  const options = [
    { key: "Lab", label: so.suspectRegMale },
    { key: "Dhidig", label: so.suspectRegFemale },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-[12px]" style={{ color: colors.inkMut }}>
        {so.suspectRegGender} *
      </p>
      <div className="grid grid-cols-2 gap-2">
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
      {error ? (
        <p className="text-xs" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CompactPhoto({
  uri,
  label,
  onPick,
  error,
  inputRef,
}: {
  uri: string | null;
  label: string;
  onPick: (file: File) => void;
  error?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { colors } = useTipTheme();
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative mx-auto flex w-full max-w-[220px] flex-col items-center"
      >
        <div
          className="flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed"
          style={{
            borderColor: error ? "rgba(232,123,107,0.55)" : rgba(ACCENT.mainRgb, 0.45),
            background: `linear-gradient(145deg, rgba(${ACCENT.mainRgb}, 0.12), rgba(${colors.lineRgb}, 0.04))`,
          }}
        >
          {uri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uri} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Camera size={28} color={ACCENT.main} />
              <span className="text-[12px] font-semibold" style={{ color: colors.ink2 }}>
                {so.suspectRegPhotoTap}
              </span>
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-[13px] font-semibold" style={{ color: colors.ink1 }}>
          {label} *
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className="text-center text-xs" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MiniPhoto({
  uri,
  label,
  onPick,
  error,
  optional,
  inputRef,
}: {
  uri: string | null;
  label: string;
  onPick: (file: File) => void;
  error?: string;
  optional?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { colors } = useTipTheme();
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        <div
          className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border"
          style={{
            borderColor: error ? "rgba(232,123,107,0.45)" : rgba(ACCENT.mainRgb, 0.35),
            background: rgba(colors.lineRgb, 0.04),
          }}
        >
          {uri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uri} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={20} color={ACCENT.main} />
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] leading-tight" style={{ color: colors.ink1 }}>
          {label}
          {optional ? ` (${so.suspectRegOptional})` : " *"}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className="mt-1 text-center text-[11px]" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IslaDamiinList({
  rows,
  selectedId,
  loading,
  onSelect,
  error,
}: {
  rows: Array<{ id: number; name: string; phone?: string }>;
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: number, label: string) => void;
  error?: string;
}) {
  const { colors } = useTipTheme();
  if (loading) {
    return <ListRowShimmer count={4} />;
  }
  if (!rows.length) {
    return (
      <p className="py-2 text-sm" style={{ color: colors.ink2 }}>
        {so.suspectRegDamiinSelfEmpty}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px]" style={{ color: colors.ink2 }}>
        {so.suspectRegDamiinSelfInfo}
      </p>
      {rows.map((row) => {
        const label = islaDamiinLabel(row);
        const selected = selectedId === String(row.id);
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id, label)}
            className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left"
            style={{
              borderColor: selected ? ACCENT.main : rgba(colors.lineRgb, 0.12),
              background: selected ? rgba(ACCENT.mainRgb, 0.1) : "transparent",
            }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: selected ? ACCENT.main : rgba(colors.lineRgb, 0.25),
                background: selected ? ACCENT.main : "transparent",
              }}
            >
              {selected ? <Check size={12} color={ACCENT.onMain} strokeWidth={3} /> : null}
            </span>
            <span className="text-sm" style={{ color: colors.ink0 }}>
              {label}
            </span>
          </button>
        );
      })}
      {error ? (
        <p className="text-xs" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OptionSheet({
  title,
  options,
  value,
  searchable,
  onSelect,
  onClose,
}: {
  title: string;
  options: string[];
  value: string;
  searchable?: boolean;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.toLowerCase().includes(needle));
  }, [options, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[75dvh] w-full max-w-lg flex-col rounded-t-3xl border sm:rounded-3xl"
        style={{
          background: `rgb(${colors.surfRgb})`,
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: rgba(colors.lineRgb, 0.1) }}
        >
          <h3 className="text-[15px] font-bold" style={{ color: colors.ink0 }}>
            {title}
          </h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold" style={{ color: colors.ink2 }}>
            {so.cancel}
          </button>
        </div>
        {searchable ? (
          <div className="border-b px-4 py-2" style={{ borderColor: rgba(colors.lineRgb, 0.08) }}>
            <div
              className="flex items-center gap-2 rounded-2xl border px-3 py-2"
              style={{ borderColor: rgba(colors.lineRgb, 0.12), background: rgba(colors.lineRgb, 0.04) }}
            >
              <Search size={16} style={{ color: colors.ink3 }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={so.searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: colors.ink0 }}
              />
            </div>
          </div>
        ) : null}
        <div className="overflow-y-auto px-2 py-2">
          {filtered.map((opt) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm"
                style={{
                  background: selected ? rgba(ACCENT.mainRgb, 0.12) : "transparent",
                  color: colors.ink0,
                }}
              >
                <span>{opt}</span>
                {selected ? <Check size={16} color={ACCENT.main} /> : null}
              </button>
            );
          })}
          {!filtered.length ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: colors.ink3 }}>
              Lama helin
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AccentButton({
  children,
  onClick,
  loading,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
      style={{
        background: ACCENT.main,
        color: ACCENT.onMain,
        boxShadow: `0 8px 24px rgba(${ACCENT.mainRgb}, 0.28)`,
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function err(errors: RegisterFieldErrors, key: keyof RegisterFieldErrors) {
  return errors[key];
}

export function RegisterScreen({
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
  onDone: () => void;
}) {
  const { colors } = useTipTheme();
  const form = useRegisterForm(auth.user.id, initialPhone);
  const [picker, setPicker] = useState<PickerKey>(null);
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  const pictureRef = useRef<HTMLInputElement>(null);
  const damiinIdRef = useRef<HTMLInputElement>(null);
  const damiinPicRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const d = form.draft;
  const e = form.errors;

  async function goNext() {
    if (form.currentStep < 2) {
      const errors = form.validateCurrentStep();
      if (Object.keys(errors).length > 0) return;
      form.goToStep(form.currentStep + 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const res = await form.submit();
    setToast({
      kind: res.ok ? "success" : "error",
      title: res.ok ? so.suspectRegSuccessTitle : so.suspectRegErrorTitle,
      message:
        res.ok && res.caseCode
          ? `${res.message}\n${so.suspectRegCaseRef}: ${res.caseCode}`
          : res.message,
    });
    if (res.ok) setTimeout(onDone, 1800);
  }

  function goBackStep() {
    if (form.currentStep > 0) {
      form.goToStep(form.currentStep - 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      onBack();
    }
  }

  const swipeBack = useCallback(() => {
    if (picker) {
      setPicker(null);
      return;
    }
    goBackStep();
  }, [picker, form.currentStep, onBack]);

  useSwipeBackHandler(swipeBack);

  async function handleSkipDamiin() {
    const res = await form.submit({ skipDamiin: true });
    setToast({
      kind: res.ok ? "success" : "error",
      title: res.ok ? so.suspectRegSuccessTitle : so.suspectRegErrorTitle,
      message:
        res.ok && res.caseCode
          ? `${res.message}\n${so.suspectRegCaseRef}: ${res.caseCode}`
          : res.message,
    });
    if (res.ok) setTimeout(onDone, 1800);
  }

  const pickerLoading = !form.coreLookupsReady;

  const pickerConfig = (() => {
    switch (picker) {
      case "addressCounty":
        return {
          title: so.suspectRegResidence,
          value: d.addressCountyName ?? "",
          options: form.counties.map((r) => r.name),
          searchable: true,
          onSelect: (name: string) => {
            form.patch({
              addressCountyName: name,
              addressCountyId: form.idForName(form.counties, name),
            });
          },
        };
      case "captureCounty":
        return {
          title: so.suspectRegCaptureCounty,
          value: d.captureCountyName ?? "",
          options: form.counties.map((r) => r.name),
          searchable: true,
          onSelect: (name: string) => {
            form.patch({
              captureCountyName: name,
              captureCountyId: form.idForName(form.counties, name),
              captureSubCountyName: null,
              captureSubCountyId: null,
            });
          },
        };
      case "captureSubCounty":
        return {
          title: so.suspectRegSubCounty,
          value: d.captureSubCountyName ?? "",
          options: form.captureSubCounties.map((r) => r.name),
          onSelect: (name: string) => {
            form.patch({
              captureSubCountyName: name,
              captureSubCountyId: form.idForName(form.captureSubCounties, name),
            });
          },
        };
      case "suspectType":
        return {
          title: so.suspectRegReason,
          value: d.suspectTypeName ?? "",
          options: form.reasons.map((r) => r.name),
          searchable: true,
          onSelect: (name: string) => {
            form.patch({
              suspectTypeName: name,
              suspectTypeId: form.idForName(form.reasons, name),
            });
          },
        };
      case "damiinCounty":
        return {
          title: so.suspectRegDamiinCounty,
          value: d.damiinCountyName ?? "",
          options: form.counties.map((r) => r.name),
          searchable: true,
          onSelect: (name: string) => {
            form.patch({
              damiinCountyName: name,
              damiinCountyId: form.idForName(form.counties, name),
            });
          },
        };
      case "relationship":
        return {
          title: so.suspectRegRelationship,
          value: d.relationshipName ?? "",
          options: form.relationships.map((r) => r.name),
          onSelect: (name: string) => {
            form.patch({
              relationshipName: name,
              relationshipId: form.idForName(form.relationships, name),
            });
          },
        };
      case "existingDamiin":
        return {
          title: so.suspectRegPickExistingDamiin,
          value: d.existingDamiinName ?? "",
          options: form.damiinOptions,
          searchable: true,
          onSelect: (label: string) => {
            const hit = form.allDamiins.find((row) => damiinLookupLabel(row) === label);
            form.patch({
              existingDamiinName: label,
              existingDamiinId: hit ? String(hit.id) : null,
            });
          },
        };
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}

      {form.draftPrompt ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close"
            onClick={() => form.setDraftPrompt(false)}
          />
          <div
            className="relative z-10 w-full max-w-sm rounded-3xl border p-5 shadow-2xl"
            style={{
              background: `rgb(${colors.surfRgb})`,
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <h3 className="text-[16px] font-bold" style={{ color: colors.ink0 }}>
              {so.suspectRegDraftTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.ink2 }}>
              {so.suspectRegDraftBody}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <AccentButton onClick={() => form.setDraftPrompt(false)}>
                {so.suspectRegDraftContinue}
              </AccentButton>
              <button
                type="button"
                onClick={() => {
                  form.resetForm();
                  form.setDraftPrompt(false);
                }}
                className="rounded-2xl border py-3 text-sm font-semibold"
                style={{ borderColor: rgba(colors.lineRgb, 0.15), color: colors.ink1 }}
              >
                {so.suspectRegDraftNew}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ScreenAppBar title={so.suspectRegTitle} onBack={goBackStep} onMenu={onMenu} />

      <div className="px-4 pb-2">
        <ProgressSteps current={form.currentStep} />
      </div>

      <div ref={scrollRef} className="mx-auto w-full max-w-lg flex-1 space-y-4 overflow-y-auto px-4 pb-10">
        {form.currentStep === 0 ? (
          <>
            <FormSection title={so.suspectRegStep1} subtitle={so.suspectRegStepSub1}>
              <CompactPhoto
                uri={d.pictureUri}
                label={so.suspectRegPhoto}
                onPick={(file) => form.persistFile("picture", file)}
                error={err(e, "pictureUri")}
                inputRef={pictureRef}
              />
              <FloatingInput
                icon={<User size={18} style={{ color: colors.ink3 }} />}
                label={`${so.suspectRegFullName} *`}
                value={d.fullname}
                onChange={(v) => form.setField("fullname", v)}
                error={err(e, "fullname")}
              />
              <FloatingInput
                icon={<User size={18} style={{ color: colors.ink3 }} />}
                label={`${so.suspectRegMother} *`}
                value={d.mother}
                onChange={(v) => form.setField("mother", v)}
                error={err(e, "mother")}
              />
              <GenderToggle
                value={d.gender}
                onChange={(v) => form.setField("gender", v)}
                error={err(e, "gender")}
              />
              <FloatingInput
                icon={<Phone size={18} style={{ color: colors.ink3 }} />}
                label={`${so.suspectRegPhone} *`}
                value={d.phone}
                onChange={(v) => form.setField("phone", clampPhoneInput(v))}
                inputMode="tel"
                maxLength={PHONE_DIGIT_COUNT}
                error={err(e, "phone")}
              />
            </FormSection>

            <FormSection title={so.suspectRegIdRef} subtitle="Aqoonsi iyo deegaan">
              <FloatingInput
                icon={<IdCard size={18} style={{ color: colors.ink3 }} />}
                label={`${so.suspectRegIdRef} *`}
                value={d.identityCard}
                onChange={(v) => form.setField("identityCard", v)}
                error={err(e, "identityCard")}
              />
              <FloatingInput
                icon={<IdCard size={18} style={{ color: colors.ink3 }} />}
                label={`${so.suspectRegJob} *`}
                value={d.occupation}
                onChange={(v) => form.setField("occupation", v)}
                error={err(e, "occupation")}
              />
              <PickerField
                label={so.suspectRegResidence}
                value={d.addressCountyName}
                onPress={() => setPicker("addressCounty")}
                loading={pickerLoading}
                error={err(e, "addressCountyId")}
                required
              />
            </FormSection>
          </>
        ) : null}

        {form.currentStep === 1 ? (
          <FormSection title={so.suspectRegStep2} subtitle={so.suspectRegStepSub2}>
            <PickerField
              label={so.suspectRegReason}
              value={d.suspectTypeName}
              onPress={() => setPicker("suspectType")}
              loading={pickerLoading}
              error={err(e, "suspectTypeId")}
              required
            />
            <PickerField
              label={so.suspectRegCaptureCounty}
              value={d.captureCountyName}
              onPress={() => setPicker("captureCounty")}
              loading={pickerLoading}
              error={err(e, "captureCountyId")}
              required
            />
            <PickerField
              label={so.suspectRegSubCounty}
              value={d.captureSubCountyName}
              onPress={() => setPicker("captureSubCounty")}
              disabled={!d.captureCountyId || form.captureSubCounties.length === 0}
              loading={pickerLoading}
              error={err(e, "captureSubCountyId")}
              required
            />
            <div>
              <label className="mb-1.5 block text-[12px]" style={{ color: colors.inkMut }}>
                {so.suspectRegDetails} *
              </label>
              <textarea
                value={d.faahfaahin}
                onChange={(ev) => form.setField("faahfaahin", ev.target.value)}
                rows={4}
                className="w-full rounded-2xl border px-3.5 py-3 text-sm outline-none"
                style={{
                  background: rgba(colors.surfRgb, 0.85),
                  borderColor: err(e, "faahfaahin")
                    ? "rgba(232,123,107,0.45)"
                    : rgba(colors.lineRgb, 0.12),
                  color: colors.ink0,
                }}
              />
              {err(e, "faahfaahin") ? (
                <p className="mt-1.5 text-xs" style={{ color: colors.rose }}>
                  {err(e, "faahfaahin")}
                </p>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        {form.currentStep === 2 ? (
          <FormSection title={so.suspectRegStep3} subtitle={so.suspectRegStepSub3}>
            <div className="grid grid-cols-3 gap-2">
              {DAMIIN_MODES.map((mode) => {
                const selected = d.damiinMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => form.setDamiinMode(mode)}
                    className="rounded-2xl border px-2 py-2.5"
                    style={{
                      borderColor: selected ? ACCENT.main : rgba(colors.lineRgb, 0.12),
                      background: selected
                        ? rgba(ACCENT.mainRgb, 0.14)
                        : rgba(colors.lineRgb, 0.03),
                    }}
                  >
                    <span
                      className="block text-center text-[11px] font-bold leading-tight"
                      style={{ color: selected ? ACCENT.main : colors.ink0 }}
                    >
                      {damiinModeLabel(mode)}
                    </span>
                  </button>
                );
              })}
            </div>

            {d.damiinMode === "isla_damiin" ? (
              <IslaDamiinList
                rows={form.islaDamiins}
                selectedId={d.islaDamiinId}
                loading={form.islaDamiinsLoading}
                onSelect={(id, label) => {
                  form.patch({ islaDamiinId: String(id), islaDamiinName: label });
                }}
                error={err(e, "islaDamiinId")}
              />
            ) : null}

            {d.damiinMode === "dhamaan_damiin" ? (
              <PickerField
                label={so.suspectRegPickExistingDamiin}
                value={d.existingDamiinName}
                onPress={() => setPicker("existingDamiin")}
                loading={form.damiinLookupsLoading}
                error={err(e, "existingDamiinId")}
                required
              />
            ) : null}

            {d.damiinMode === "new_damiin" ? (
              <>
                <div className="flex gap-3">
                  <MiniPhoto
                    uri={d.damiinIdentityUri}
                    label={so.suspectRegDamiinIdPhoto}
                    onPick={(file) => form.persistFile("damiinIdentity", file)}
                    error={err(e, "damiinIdentityUri")}
                    inputRef={damiinIdRef}
                  />
                  <MiniPhoto
                    uri={d.damiinPictureUri}
                    label={so.suspectRegDamiinPhoto}
                    optional
                    onPick={(file) => form.persistFile("damiinPicture", file)}
                    inputRef={damiinPicRef}
                  />
                </div>
                <FloatingInput
                  icon={<User size={18} style={{ color: colors.ink3 }} />}
                  label={`${so.suspectRegDamiinName} *`}
                  value={d.damiinName}
                  onChange={(v) => form.setField("damiinName", v)}
                  error={err(e, "damiinName")}
                />
                <GenderToggle
                  value={d.damiinGender}
                  onChange={(v) => form.setField("damiinGender", v)}
                  error={err(e, "damiinGender")}
                />
                <FloatingInput
                  icon={<Phone size={18} style={{ color: colors.ink3 }} />}
                  label={`${so.suspectRegDamiinPhone} *`}
                  value={d.damiinPhone}
                  onChange={(v) => form.setField("damiinPhone", clampPhoneInput(v))}
                  inputMode="tel"
                  maxLength={PHONE_DIGIT_COUNT}
                  error={err(e, "damiinPhone")}
                />
                <PickerField
                  label={so.suspectRegRelationship}
                  value={d.relationshipName}
                  onPress={() => setPicker("relationship")}
                  loading={form.damiinLookupsLoading}
                  error={err(e, "relationshipId")}
                  required
                />
                <PickerField
                  label={so.suspectRegDamiinCounty}
                  value={d.damiinCountyName}
                  onPress={() => setPicker("damiinCounty")}
                  loading={pickerLoading}
                  error={err(e, "damiinCountyId")}
                  required
                />
              </>
            ) : null}
          </FormSection>
        ) : null}

        <div className="space-y-3 pt-1">
          <div className="flex gap-2">
            {form.currentStep > 0 ? (
              <button
                type="button"
                onClick={goBackStep}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-2xl border py-3.5 text-sm font-semibold"
                style={{ borderColor: rgba(colors.lineRgb, 0.15), color: colors.ink1 }}
              >
                <ChevronLeft size={16} />
                {so.suspectRegPrev}
              </button>
            ) : null}
            <div className={form.currentStep > 0 ? "flex-[2]" : "w-full"}>
              <AccentButton
                onClick={goNext}
                loading={form.submitting}
                icon={
                  form.currentStep < 2 ? (
                    <ChevronRight size={18} />
                  ) : (
                    <Check size={18} />
                  )
                }
              >
                {form.currentStep < 2 ? so.suspectRegNext : so.suspectRegSubmit}
              </AccentButton>
            </div>
          </div>

          {form.currentStep === 2 ? (
            <div
              className="rounded-3xl border p-4"
              style={{
                borderColor: rgba(colors.lineRgb, 0.12),
                background: rgba(colors.lineRgb, 0.03),
              }}
            >
              <p className="text-sm font-bold" style={{ color: colors.ink0 }}>
                {so.suspectRegSkipDamiin}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: colors.ink2 }}>
                {so.suspectRegSkipDamiinHint}
              </p>
              <button
                type="button"
                disabled={form.submitting}
                onClick={handleSkipDamiin}
                className="mt-3 w-full rounded-2xl border py-3 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: rgba(ACCENT.mainRgb, 0.35), color: ACCENT.main }}
              >
                {form.submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  so.suspectRegSkipDamiinAction
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {pickerConfig ? (
        <OptionSheet
          title={pickerConfig.title}
          options={pickerConfig.options}
          value={pickerConfig.value}
          searchable={"searchable" in pickerConfig ? pickerConfig.searchable : false}
          onSelect={pickerConfig.onSelect}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
