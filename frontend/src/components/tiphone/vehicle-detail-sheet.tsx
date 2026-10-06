"use client";

import { CalendarDays, Car, MapPin, Phone, UserRound, X } from "lucide-react";
import { rgba } from "@/lib/tiphone/theme";
import type { SuspectVehicle } from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { useSwipeBackHandler } from "./ios-swipe-back";
import { useTipTheme } from "./theme-provider";

export function VehicleDetailSheet({
  vehicle,
  onClose,
}: {
  vehicle: SuspectVehicle | null;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  useSwipeBackHandler(vehicle ? onClose : null);
  if (!vehicle) return null;

  const image = resolveTipMediaUrl(vehicle.photoUrl);
  const hasLocation =
    Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude);

  return (
    <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border p-4 sm:rounded-[28px]"
        style={{ background: colors.bg1, borderColor: rgba(colors.goldRgb, 0.3) }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
              Gaari · Faahfaahin
            </p>
            <h3 className="text-xl font-bold" style={{ color: colors.ink0 }}>
              {vehicle.make}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border p-2"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink1 }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="mb-4 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: rgba(colors.goldRgb, 0.24), background: rgba(colors.lineRgb, 0.04) }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Car size={56} style={{ color: colors.gold }} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Detail label="Taargada" value={vehicle.plate} icon={<Car size={13} />} />
          <Detail label="Lahaanshaha" value={vehicle.ownership} icon={<UserRound size={13} />} />
          <Detail label="Magaca milkiilaha" value={vehicle.ownerName} icon={<UserRound size={13} />} />
          <Detail label="Telefoonka milkiilaha" value={vehicle.ownerPhone} icon={<Phone size={13} />} />
          <Detail label="Taariikhda" value={vehicle.createdAt} icon={<CalendarDays size={13} />} wide />
          <Detail label="Faahfaahin" value={vehicle.detail} icon={<Car size={13} />} wide />
        </div>

        {hasLocation ? (
          <a
            href={`https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold"
            style={{
              borderColor: rgba(colors.goldRgb, 0.35),
              background: rgba(colors.goldRgb, 0.12),
              color: colors.gold,
            }}
          >
            <MapPin size={16} /> Ka eeg goobta khariidadda
          </a>
        ) : null}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value?: string;
  icon: React.ReactNode;
  wide?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className={`rounded-xl border p-3 ${wide ? "col-span-2" : ""}`}
      style={{ borderColor: rgba(colors.lineRgb, 0.09), background: rgba(colors.lineRgb, 0.035) }}
    >
      <p className="flex items-center gap-1 text-[10px] uppercase" style={{ color: colors.inkMut }}>
        {icon} {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold" style={{ color: colors.ink0 }}>
        {value || "—"}
      </p>
    </div>
  );
}
