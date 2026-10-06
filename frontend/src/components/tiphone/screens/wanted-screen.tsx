"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Plus, Search, X } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { rgba } from "@/lib/tiphone/theme";
import type { StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { canCreateWanted, resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { ScreenAppBar } from "../app-bar";
import { FloatingInput } from "../floating-input";
import { GoldButton } from "../gold-button";
import { PersonSearchShimmer } from "../shimmer";
import { useTipTheme } from "../theme-provider";
import { TipToast } from "../toast";

type FormState = {
  full_name: string;
  mother_name: string;
  phone: string;
  gender: string;
  wanted_status: string;
  priority: string;
  wanted_type: string;
  details: string;
};

const EMPTY: FormState = {
  full_name: "",
  mother_name: "",
  phone: "",
  gender: "",
  wanted_status: "Wanted",
  priority: "High",
  wanted_type: "",
  details: "",
};

export function WantedScreen({
  auth,
  onBack,
  onMenu,
  onOpenProfile,
}: {
  auth: StoredAuth;
  onBack: () => void;
  onMenu: () => void;
  onOpenProfile: (wanted: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<SuspectListRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [types, setTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; message?: string; kind?: "success" | "error" | "info" } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const mayCreate = canCreateWanted(auth.roles, auth.permissions);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await TipApi.fetchWantedList({ search: query, pageSize: 100 }));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!formOpen) return;
    TipApi.fetchWantedTypes().then(setTypes).catch(() => {});
  }, [formOpen]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function choosePhoto(file?: File) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY);
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function save() {
    if (!form.full_name.trim()) {
      setToast({ kind: "error", title: "Magaca waa qasab." });
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value.trim()) body.append(key, value.trim());
      });
      if (photo) body.append("photo", photo);
      const created = await TipApi.createWanted(body);
      closeForm();
      await load();
      setToast({ kind: "success", title: "Wanted waa la diiwaangeliyey." });
      if (created.id) onOpenProfile(created);
    } catch (err) {
      setToast({
        kind: "error",
        title: "Diiwaangelintu way fashilantay.",
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <ScreenAppBar title="Wanted" onBack={onBack} onMenu={onMenu} />
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl border p-3"
          style={{ background: rgba(colors.roseRgb, 0.11), borderColor: rgba(colors.roseRgb, 0.35) }}
        >
          <AlertTriangle className="shrink-0" size={22} style={{ color: colors.rose }} />
          <div className="min-w-0 flex-1">
            <p className="font-bold" style={{ color: colors.rose }}>DIGNIIN WANTED</p>
            <p className="text-xs" style={{ color: colors.inkMut }}>
              Si taxaddar leh u hubi qofka ka hor tallaabo kasta.
            </p>
          </div>
          {mayCreate ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: colors.rose, color: "#fff" }}
              aria-label="Ku dar Wanted"
            >
              <Plus size={19} />
            </button>
          ) : null}
        </div>

        <div
          className="mb-4 flex items-center gap-2 rounded-xl border px-3"
          style={{ borderColor: rgba(colors.lineRgb, 0.12), background: rgba(colors.surfRgb, 0.72) }}
        >
          <Search size={16} style={{ color: colors.inkMut }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Raadi magac ama telefoon…"
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </div>

        {loading ? (
          <PersonSearchShimmer count={6} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-sm" style={{ color: colors.inkMut }}>
            Wanted lama helin
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rows.map((row) => {
              const image = resolveTipMediaUrl(row.photo);
              return (
                <button
                  type="button"
                  key={row.id}
                  onClick={async () => {
                    try {
                      onOpenProfile(await TipApi.fetchWantedDetail(row.id));
                    } catch {
                      onOpenProfile(row);
                    }
                  }}
                  className="overflow-hidden rounded-2xl border text-left"
                  style={{ borderColor: rgba(colors.roseRgb, 0.38), background: rgba(colors.surfRgb, 0.74) }}
                >
                  <div className="relative aspect-[4/5] bg-black/20">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-4xl font-bold" style={{ color: colors.rose }}>
                        {row.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                      WANTED
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold">{row.name}</p>
                    <p className="mt-1 truncate text-xs" style={{ color: colors.inkMut }}>
                      {[row.risk, row.N_tuhunka].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0" onClick={closeForm} aria-label="Close" />
          <section
            className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border p-4 sm:rounded-[28px]"
            style={{ background: colors.bg1, borderColor: rgba(colors.roseRgb, 0.35) }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.rose }}>Diiwaan cusub</p>
                <h3 className="text-xl font-bold">Ku dar Wanted</h3>
              </div>
              <button type="button" onClick={closeForm} className="rounded-xl border p-2" style={{ borderColor: rgba(colors.lineRgb, 0.12) }}>
                <X size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="mb-3 flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border"
              style={{ borderColor: rgba(colors.roseRgb, 0.28), background: rgba(colors.lineRgb, 0.04) }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm" style={{ color: colors.inkMut }}>
                  <Camera size={30} style={{ color: colors.rose }} /> Qaad sawirka
                </span>
              )}
            </button>
            <button type="button" className="mb-4 text-xs font-semibold" style={{ color: colors.gold }} onClick={() => galleryRef.current?.click()}>
              Ka dooro gallery
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => choosePhoto(e.target.files?.[0])} />
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0])} />

            <div className="space-y-3">
              <FloatingInput label="Magaca *" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
              <div className="grid grid-cols-2 gap-2">
                <FloatingInput label="Hooyada" value={form.mother_name} onChange={(v) => setForm((f) => ({ ...f, mother_name: v }))} />
                <FloatingInput label="Telefoon" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v.replace(/\D/g, "").slice(0, 10) }))} inputMode="tel" />
              </div>
              <Select label="Jinsi" value={form.gender} onChange={(v) => setForm((f) => ({ ...f, gender: v }))} options={["", "Lab", "Dhedig"]} />
              <div className="grid grid-cols-2 gap-2">
                <Select label="Status" value={form.wanted_status} onChange={(v) => setForm((f) => ({ ...f, wanted_status: v }))} options={["Wanted", "Watch", "Captured"]} />
                <Select label="Mudnaan" value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={["High", "Medium", "Low"]} />
              </div>
              <label className="block text-xs" style={{ color: colors.inkMut }}>
                Nooca
                <input
                  list="tip-wanted-types"
                  value={form.wanted_type}
                  onChange={(e) => setForm((f) => ({ ...f, wanted_type: e.target.value }))}
                  className="mt-1 w-full rounded-xl border bg-transparent px-3 py-3 text-sm outline-none"
                  style={{ borderColor: rgba(colors.lineRgb, 0.13), color: colors.ink0 }}
                />
                <datalist id="tip-wanted-types">{types.map((type) => <option key={type.id} value={type.name} />)}</datalist>
              </label>
              <label className="block text-xs" style={{ color: colors.inkMut }}>
                Faahfaahin
                <textarea
                  rows={3}
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  className="mt-1 w-full resize-y rounded-xl border bg-transparent px-3 py-3 text-sm outline-none"
                  style={{ borderColor: rgba(colors.lineRgb, 0.13), color: colors.ink0 }}
                />
              </label>
              <GoldButton loading={saving} disabled={!form.full_name.trim()} onClick={() => void save()}>
                Kaydi Wanted
              </GoldButton>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const { colors } = useTipTheme();
  return (
    <label className="block text-xs" style={{ color: colors.inkMut }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border bg-transparent px-3 py-3 text-sm outline-none"
        style={{ borderColor: rgba(colors.lineRgb, 0.13), color: colors.ink0 }}
      >
        {options.map((option) => <option key={option || "empty"} value={option}>{option || "Dooro"}</option>)}
      </select>
    </label>
  );
}
