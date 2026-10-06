"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ChevronDown, ImageIcon, Loader2, Search, X } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";
import { FloatingInput } from "./floating-input";
import { GoldButton } from "./gold-button";
import { useSwipeBackHandler } from "./ios-swipe-back";

type FormErrors = Partial<
  Record<"carModel" | "plate" | "detail" | "photo" | "ownerName" | "ownerPhone", string>
>;

function VehicleVisual({ seed = 0 }: { seed?: number }) {
  const tones: [string, string][] = [
    ["#7a5530", "#3a2a16"],
    ["#3a3530", "#15110d"],
    ["#5a5048", "#2a2420"],
  ];
  const [a, b] = tones[seed % tones.length];
  return (
    <div
      className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-xl text-2xl"
      style={{
        background: `linear-gradient(145deg, ${a}, ${b})`,
      }}
      aria-hidden
    >
      🚗
    </div>
  );
}

function ModelPickerSheet({
  open,
  models,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  models: { id: number; name: string }[];
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((m) => m.name.toLowerCase().includes(needle));
  }, [models, q]);

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div
        className="relative max-h-[72dvh] overflow-hidden rounded-t-[28px] border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        style={{
          background: rgba(colors.surfRgb, 0.98),
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full"
          style={{ background: rgba(colors.lineRgb, 0.25) }}
        />
        <p className="mb-2 text-[15px] font-bold" style={{ color: colors.ink0 }}>
          {so.profileCarModel}
        </p>
        <div
          className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{
            background: rgba(colors.lineRgb, 0.04),
            borderColor: rgba(colors.lineRgb, 0.1),
          }}
        >
          <Search size={15} style={{ color: colors.inkMut }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Raadi…"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: colors.ink0 }}
          />
        </div>
        <div className="max-h-[48dvh] space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.inkMut }}>
              {so.profileCarModelsEmpty}
            </p>
          ) : (
            filtered.map((m) => {
              const selected = m.name === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m.name);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left"
                  style={{
                    background: selected ? rgba(colors.goldRgb, 0.12) : "transparent",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: colors.ink0 }}>
                    {m.name}
                  </span>
                  {selected ? <Check size={16} style={{ color: colors.gold }} /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function AttachCarsModal({
  open,
  suspectId,
  suspectName,
  suspectPhone,
  userId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  suspectId: string | number;
  suspectName: string;
  suspectPhone?: string;
  userId: string | number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { colors } = useTipTheme();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [models, setModels] = useState<{ id: number; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [carModelId, setCarModelId] = useState("");
  const [carModelName, setCarModelName] = useState("");
  const [plate, setPlate] = useState("");
  const [detail, setDetail] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useSwipeBackHandler(
    open
      ? () => {
          if (modelPickerOpen) setModelPickerOpen(false);
          else onClose();
        }
      : null,
  );

  useEffect(() => {
    if (!open) return;
    setCarModelId("");
    setCarModelName("");
    setPlate("");
    setDetail("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsOwner(true);
    setOwnerName("");
    setOwnerPhone("");
    setErrors({});
    setSubmitError("");
    setModelPickerOpen(false);

    let cancelled = false;
    setModelsLoading(true);
    TipApi.fetchCarModels()
      .then((rows) => {
        if (cancelled) return;
        setModels(rows);
        if (rows.length === 1) {
          setCarModelId(String(rows[0].id));
          setCarModelName(rows[0].name);
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors((e) => ({ ...e, photo: undefined }));
  };

  const validate = useCallback(() => {
    const e: FormErrors = {};
    if (!carModelId) e.carModel = so.profileCarModelRequired;
    if (!plate.trim()) e.plate = so.profileCarPlateRequired;
    if (!detail.trim()) e.detail = so.profileCarDetailsRequired;
    if (!photoFile) e.photo = so.profileCarPhotoRequired;
    if (!isOwner) {
      if (!ownerName.trim()) e.ownerName = so.profileCarOwnerNameRequired;
      if (!ownerPhone.trim()) e.ownerPhone = so.profileCarOwnerPhoneRequired;
    }
    setErrors(e);
    return e;
  }, [carModelId, detail, isOwner, ownerName, ownerPhone, photoFile, plate]);

  const save = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) return;
    if (!photoFile) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          /* optional */
        }
      }

      const result = await TipApi.createSuspectCar({
        suspectId,
        userId,
        carModelId,
        plateNumber: plate,
        description: detail,
        ownership: isOwner ? "Yes" : "No",
        ownerName: isOwner ? suspectName : ownerName,
        ownerPhone: isOwner ? suspectPhone ?? "" : ownerPhone,
        photo: photoFile,
        latitude,
        longitude,
      });

      if (!result.ok) {
        setSubmitError(result.message || so.profileCarAttachFailed);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setSubmitError(so.profileCarAttachFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: rgba(colors.scrimRgb, 0.55) }}
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-t"
        style={{
          background: rgba(colors.surfRgb, 0.98),
          borderColor: rgba(colors.lineRgb, 0.1),
        }}
      >
        <div
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full"
          style={{ background: rgba(colors.lineRgb, 0.22) }}
        />
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: colors.gold }}
            >
              GAARI · XIRIIRIN
            </p>
            <p className="truncate text-[17px] font-bold" style={{ color: colors.ink0 }}>
              {so.profileAttachCarTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{
              background: rgba(colors.lineRgb, 0.05),
              borderColor: rgba(colors.lineRgb, 0.12),
              color: colors.ink0,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <div>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border"
              style={{
                background: rgba(colors.lineRgb, 0.04),
                borderColor: errors.photo
                  ? "rgba(232,123,107,0.5)"
                  : rgba(colors.goldRgb, 0.28),
              }}
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 text-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${rgba(colors.goldRgb, 0.22)}, ${rgba(colors.goldRgb, 0.06)})`,
                      color: colors.gold,
                    }}
                  >
                    <Camera size={28} />
                  </span>
                  <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                    {so.profileCarPhoto}
                  </p>
                  <p className="text-[12px]" style={{ color: colors.ink2 }}>
                    {so.suspectRegPhotoTap}
                  </p>
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: colors.ink2 }}
            >
              <ImageIcon size={14} />
              {so.suspectRegGallery}
            </button>
            {errors.photo ? (
              <p className="mt-1 text-xs" style={{ color: colors.rose }}>
                {errors.photo}
              </p>
            ) : null}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </div>

          <div>
            <p className="mb-1 text-[13px] font-bold" style={{ color: colors.ink0 }}>
              {so.profileCarSectionInfo}
            </p>
            <p className="mb-2.5 text-[11px]" style={{ color: colors.inkMut }}>
              {so.profileCarSectionInfoSub}
            </p>

            <button
              type="button"
              disabled={modelsLoading}
              onClick={() => setModelPickerOpen(true)}
              className="mb-2.5 w-full rounded-2xl border px-3.5 py-3 text-left"
              style={{
                background: rgba(colors.hiRgb, 0.04),
                borderColor: errors.carModel
                  ? "rgba(232,123,107,0.45)"
                  : rgba(colors.lineRgb, 0.12),
                opacity: modelsLoading ? 0.65 : 1,
              }}
            >
              <p className="text-[11px] font-medium" style={{ color: colors.inkMut }}>
                {so.profileCarModel} <span style={{ color: colors.gold }}>*</span>
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span
                  className="truncate text-[14px] font-semibold"
                  style={{ color: carModelName ? colors.ink0 : colors.ink3 }}
                >
                  {modelsLoading
                    ? so.profileCarModelsLoading
                    : carModelName || so.suspectRegPick}
                </span>
                {modelsLoading ? (
                  <Loader2 size={15} className="animate-spin" style={{ color: colors.gold }} />
                ) : (
                  <ChevronDown size={16} style={{ color: colors.ink3 }} />
                )}
              </div>
            </button>
            {errors.carModel ? (
              <p className="mb-2 text-xs" style={{ color: colors.rose }}>
                {errors.carModel}
              </p>
            ) : null}

            <div className="space-y-2.5">
              <FloatingInput
                label={`${so.profileCarPlate} *`}
                value={plate}
                onChange={(v) => {
                  setPlate(v.toUpperCase());
                  setErrors((e) => ({ ...e, plate: undefined }));
                }}
                error={errors.plate}
                autoCapitalize="characters"
              />
              <FloatingInput
                label={`${so.profileCarDetails} *`}
                value={detail}
                onChange={(v) => {
                  setDetail(v);
                  setErrors((e) => ({ ...e, detail: undefined }));
                }}
                error={errors.detail}
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-bold" style={{ color: colors.ink0 }}>
              {so.profileCarOwner}
            </p>
            <p className="mb-2.5 text-[11px]" style={{ color: colors.inkMut }}>
              {so.profileCarOwnerSub}
            </p>
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              {[
                { self: true, label: so.profileCarOwnerSelf },
                { self: false, label: so.profileCarOwnerOther },
              ].map(({ self, label }) => {
                const active = isOwner === self;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setIsOwner(self)}
                    className="rounded-xl border px-3 py-2.5 text-[13px] font-semibold"
                    style={{
                      background: active
                        ? rgba(colors.goldRgb, 0.16)
                        : rgba(colors.lineRgb, 0.04),
                      borderColor: active
                        ? rgba(colors.goldRgb, 0.45)
                        : rgba(colors.lineRgb, 0.12),
                      color: active ? colors.gold : colors.ink1,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!isOwner ? (
              <div className="space-y-2.5">
                <FloatingInput
                  label={`${so.profileCarOwnerName} *`}
                  value={ownerName}
                  onChange={(v) => {
                    setOwnerName(v);
                    setErrors((e) => ({ ...e, ownerName: undefined }));
                  }}
                  error={errors.ownerName}
                />
                <FloatingInput
                  label={`${so.profileCarOwnerPhone} *`}
                  value={ownerPhone}
                  onChange={(v) => {
                    setOwnerPhone(v.replace(/\D/g, "").slice(0, 9));
                    setErrors((e) => ({ ...e, ownerPhone: undefined }));
                  }}
                  error={errors.ownerPhone}
                  inputMode="tel"
                />
              </div>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-center text-sm" style={{ color: colors.rose }}>
              {submitError}
            </p>
          ) : null}

          <GoldButton loading={submitting} onClick={() => void save()} className="w-full">
            {submitting ? so.profileCarAttaching : so.profileAttachCarSubmit}
          </GoldButton>
        </div>
      </div>

      <ModelPickerSheet
        open={modelPickerOpen}
        models={models}
        value={carModelName}
        onSelect={(name) => {
          const row = models.find((m) => m.name === name);
          if (!row) return;
          setCarModelId(String(row.id));
          setCarModelName(row.name);
          setErrors((e) => ({ ...e, carModel: undefined }));
        }}
        onClose={() => setModelPickerOpen(false)}
      />
    </div>
  );
}

export function ProfileVehicleVisual({ seed }: { seed?: number }) {
  return <VehicleVisual seed={seed} />;
}
