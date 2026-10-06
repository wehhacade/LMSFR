"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Loader2, Search, User, Phone } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import type { DamiinMode, StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { useExistingCaseForm } from "@/lib/tiphone/use-existing-case-form";
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
  onMain: "#0B1A14",
};

const DAMIIN_MODES: Exclude<import("@/lib/tiphone/types").DamiinMode, "no_damiin">[] = [
  "new_damiin",
  "isla_damiin",
  "dhamaan_damiin",
];

function damiinModeLabel(mode: Exclude<import("@/lib/tiphone/types").DamiinMode, "no_damiin">): string {
  if (mode === "isla_damiin") return so.suspectRegDamiinSelf;
  if (mode === "dhamaan_damiin") return so.suspectRegDamiinExisting;
  return so.suspectRegDamiinNew;
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
  placeholder,
  error,
  onClick,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  onClick: () => void;
}) {
  const { colors } = useTipTheme();
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border px-3.5 py-3 text-left transition"
        style={{
          background: rgba(colors.surfRgb, 0.85),
          borderColor: error ? "rgba(232,123,107,0.45)" : rgba(colors.lineRgb, 0.12),
        }}
      >
        <p className="text-[11px] font-semibold" style={{ color: colors.inkMut }}>
          {label}
        </p>
        <p className="mt-0.5 text-[14px]" style={{ color: value ? colors.ink0 : colors.ink3 }}>
          {value || placeholder}
        </p>
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
  onSelect: (id: number) => void;
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
        const selected = selectedId === String(row.id);
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition"
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
            <span className="min-w-0 flex-1 text-sm" style={{ color: colors.ink0 }}>
              {islaDamiinLabel(row)}
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
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: rgba(colors.lineRgb, 0.1) }}>
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

export function ExistingCaseScreen({
  auth,
  suspect,
  onBack,
  onMenu,
  onDone,
}: {
  auth: StoredAuth;
  suspect: SuspectListRow;
  onBack: () => void;
  onMenu: () => void;
  onDone: () => void;
}) {
  const { colors } = useTipTheme();
  const form = useExistingCaseForm({
    suspectId: Number(suspect.id),
    suspectName: suspect.name,
    suspectPhone: suspect.tnumber,
    suspectTuhunka: suspect.N_tuhunka,
    userId: auth.user.id,
  });
  const [picker, setPicker] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  const swipeBack = useCallback(() => {
    if (picker) {
      setPicker(null);
      return;
    }
    onBack();
  }, [picker, onBack]);
  useSwipeBackHandler(swipeBack);

  const d = form.draft;
  const e = form.errors;

  async function onSubmit() {
    const res = await form.submit();
    setToast({
      kind: res.ok ? "success" : "error",
      title: res.ok ? so.suspectRegSuccessTitle : so.suspectRegErrorTitle,
      message:
        res.ok && "caseCode" in res && res.caseCode
          ? `${res.message}\n${so.suspectRegCaseRef}: ${res.caseCode}`
          : res.message,
    });
    if (res.ok) setTimeout(onDone, 1600);
  }

  const pickerConfig = (() => {
    if (picker === "status") {
      const name = form.statuses.find((r) => String(r.id) === d.suspectTypeId)?.name ?? "";
      return {
        title: so.suspectRegReason,
        value: name,
        options: form.statuses.map((r) => r.name),
        onSelect: (v: string) => {
          const hit = form.statuses.find((r) => r.name === v);
          form.setField("suspectTypeId", hit ? String(hit.id) : "");
        },
      };
    }
    if (picker === "county") {
      const name = form.counties.find((r) => String(r.id) === d.captureCountyId)?.name ?? "";
      return {
        title: so.suspectRegCaptureCounty,
        value: name,
        options: form.counties.map((r) => r.name),
        onSelect: (v: string) => {
          const hit = form.counties.find((r) => r.name === v);
          form.setField("captureCountyId", hit ? String(hit.id) : "");
          form.setField("captureSubCountyId", "");
        },
      };
    }
    if (picker === "sub") {
      const name = form.filteredSubCounties.find((r) => String(r.id) === d.captureSubCountyId)?.name ?? "";
      return {
        title: so.suspectRegSubCounty,
        value: name,
        options: form.filteredSubCounties.map((r) => r.name),
        onSelect: (v: string) => {
          const hit = form.filteredSubCounties.find((r) => r.name === v);
          form.setField("captureSubCountyId", hit ? String(hit.id) : "");
        },
      };
    }
    if (picker === "relationship") {
      const name = form.relationships.find((r) => String(r.id) === d.relationshipId)?.name ?? "";
      return {
        title: so.suspectRegRelationship,
        value: name,
        options: form.relationships.map((r) => r.name),
        onSelect: (v: string) => {
          const hit = form.relationships.find((r) => r.name === v);
          form.setField("relationshipId", hit ? String(hit.id) : "");
        },
      };
    }
    if (picker === "damiinCounty") {
      const name = form.counties.find((r) => String(r.id) === d.damiinCountyId)?.name ?? "";
      return {
        title: so.suspectRegDamiinCounty,
        value: name,
        options: form.counties.map((r) => r.name),
        onSelect: (v: string) => {
          const hit = form.counties.find((r) => r.name === v);
          form.setField("damiinCountyId", hit ? String(hit.id) : "");
        },
      };
    }
    if (picker === "existingDamiin") {
      const hit = form.allDamiins.find((row) => String(row.id) === d.existingDamiinId);
      return {
        title: so.suspectRegPickExistingDamiin,
        value: hit ? damiinLookupLabel(hit) : "",
        options: form.damiinOptions,
        searchable: true,
        onSelect: (label: string) => {
          const row = form.allDamiins.find((r) => damiinLookupLabel(r) === label);
          form.setField("existingDamiinId", row ? String(row.id) : "");
        },
      };
    }
    return null;
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <ScreenAppBar title={so.existingCaseTitle} onBack={onBack} onMenu={onMenu} />

      <div
        className="mx-4 mb-3 rounded-3xl border px-4 py-3"
        style={{
          background: rgba(ACCENT.mainRgb, 0.12),
          borderColor: rgba(ACCENT.mainRgb, 0.22),
        }}
      >
        <p className="text-[16px] font-bold" style={{ color: colors.ink0 }}>
          {d.suspectName}
        </p>
        {d.suspectPhone ? (
          <p className="mt-0.5 text-sm" style={{ color: colors.ink2 }}>
            {d.suspectPhone}
          </p>
        ) : null}
        <p className="mt-1 text-[12px]" style={{ color: colors.ink3 }}>
          {so.existingCaseHint}
        </p>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-10">
        {form.loadingLookups ? (
          <ListRowShimmer count={6} />
        ) : (
          <>
            <FormSection title={so.existingCaseTitle} subtitle={so.existingCaseHint}>
              <div className="grid grid-cols-3 gap-2">
                {DAMIIN_MODES.map((mode) => {
                  const selected = d.damiinMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => form.setDamiinMode(mode)}
                      className="rounded-2xl border px-2 py-2.5 transition"
                      style={{
                        borderColor: selected ? ACCENT.main : rgba(colors.lineRgb, 0.12),
                        background: selected ? rgba(ACCENT.mainRgb, 0.14) : rgba(colors.lineRgb, 0.03),
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

              <div className="space-y-3 pt-1">
                {d.damiinMode === "new_damiin" ? (
                  <>
                    <p className="text-[13px]" style={{ color: colors.ink2 }}>
                      {so.suspectRegDamiinNewHint}
                    </p>
                    <FloatingInput
                      icon={<User size={18} style={{ color: colors.ink3 }} />}
                      label={`${so.suspectRegDamiinName} *`}
                      value={d.damiinName}
                      onChange={(v) => form.setField("damiinName", v)}
                      error={e.damiinName}
                    />
                    <GenderToggle
                      value={d.damiinGender}
                      onChange={(v) => form.setField("damiinGender", v)}
                      error={e.damiinGender}
                    />
                    <FloatingInput
                      icon={<Phone size={18} style={{ color: colors.ink3 }} />}
                      label={`${so.suspectRegDamiinPhone} *`}
                      value={d.damiinPhone}
                      onChange={(v) => form.setField("damiinPhone", clampPhoneInput(v))}
                      inputMode="tel"
                      maxLength={PHONE_DIGIT_COUNT}
                      error={e.damiinPhone}
                    />
                    <PickerField
                      label={`${so.suspectRegRelationship} *`}
                      value={form.relationships.find((r) => String(r.id) === d.relationshipId)?.name ?? ""}
                      placeholder={so.suspectRegPick}
                      error={e.relationshipId}
                      onClick={() => setPicker("relationship")}
                    />
                    <PickerField
                      label={`${so.suspectRegDamiinCounty} *`}
                      value={form.counties.find((r) => String(r.id) === d.damiinCountyId)?.name ?? ""}
                      placeholder={so.suspectRegPick}
                      error={e.damiinCountyId}
                      onClick={() => setPicker("damiinCounty")}
                    />
                  </>
                ) : null}

                {d.damiinMode === "isla_damiin" ? (
                  <IslaDamiinList
                    rows={form.islaDamiins}
                    selectedId={d.islaDamiinId || null}
                    loading={form.loadingIslaDamiins}
                    onSelect={(id) => form.setField("islaDamiinId", String(id))}
                    error={e.islaDamiinId}
                  />
                ) : null}

                {d.damiinMode === "dhamaan_damiin" ? (
                  <>
                    <p className="text-[13px]" style={{ color: colors.ink2 }}>
                      {so.suspectRegDamiinExistingHint}
                    </p>
                    <PickerField
                      label={`${so.suspectRegPickExistingDamiin} *`}
                      value={(() => {
                        const row = form.allDamiins.find((r) => String(r.id) === d.existingDamiinId);
                        return row ? damiinLookupLabel(row) : "";
                      })()}
                      placeholder={so.suspectRegPick}
                      error={e.existingDamiinId}
                      onClick={() => setPicker("existingDamiin")}
                    />
                  </>
                ) : null}
              </div>
            </FormSection>

            {form.showCaseSection ? (
              <FormSection title={so.existingCaseSection} subtitle={so.existingCaseSectionHint}>
                <div className="space-y-3">
                  <PickerField
                    label={`${so.suspectRegReason} *`}
                    value={form.statuses.find((r) => String(r.id) === d.suspectTypeId)?.name ?? ""}
                    placeholder={so.suspectRegPick}
                    error={e.suspectTypeId}
                    onClick={() => setPicker("status")}
                  />
                  <PickerField
                    label={`${so.suspectRegCaptureCounty} *`}
                    value={form.counties.find((r) => String(r.id) === d.captureCountyId)?.name ?? ""}
                    placeholder={so.suspectRegPick}
                    error={e.captureCountyId}
                    onClick={() => setPicker("county")}
                  />
                  <PickerField
                    label={`${so.suspectRegSubCounty} *`}
                    value={
                      form.filteredSubCounties.find((r) => String(r.id) === d.captureSubCountyId)?.name ?? ""
                    }
                    placeholder={so.suspectRegPick}
                    error={e.captureSubCountyId}
                    onClick={() => setPicker("sub")}
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
                        borderColor: e.faahfaahin
                          ? "rgba(232,123,107,0.45)"
                          : rgba(colors.lineRgb, 0.12),
                        color: colors.ink0,
                      }}
                    />
                    {e.faahfaahin ? (
                      <p className="mt-1.5 text-xs" style={{ color: colors.rose }}>
                        {e.faahfaahin}
                      </p>
                    ) : null}
                  </div>
                </div>
              </FormSection>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={form.submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
              style={{
                background: ACCENT.main,
                color: ACCENT.onMain,
                boxShadow: `0 8px 24px rgba(${ACCENT.mainRgb}, 0.28)`,
              }}
            >
              {form.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={18} />}
              {so.suspectRegSubmit}
            </button>
          </>
        )}
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
