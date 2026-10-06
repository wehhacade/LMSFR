"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Clock3,
  ChevronDown,
  FileText,
  Plus,
  Share2,
  Shield,
  User,
} from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type {
  DamiinRow,
  StoredAuth,
  SuspectCaseRow,
  SuspectListRow,
  SuspectVehicle,
} from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { AppBarIconButton, ScreenAppBar } from "../app-bar";
import { BottomNav } from "../bottom-nav";
import { InlinePanelShimmer } from "../shimmer";
import { AttachCarsModal, ProfileVehicleVisual } from "../attach-cars-modal";
import { TipToast } from "../toast";
import { VehicleDetailSheet } from "../vehicle-detail-sheet";

const STATUS_COLOR: Record<string, string> = {
  Wanted: "#e87b6b",
  "In custody": "#7aa4d9",
  Watch: "#e9c177",
};

function hasVal(v?: string | number | null) {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "—" && s !== "N/A";
}

function display(v?: string | number | null) {
  return hasVal(v) ? String(v).trim() : "—";
}

type PanelId = "tuhunka" | "personal" | "damiin" | "cases";

function DamiinBtn({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  const { colors } = useTipTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition active:scale-95 ${compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"}`}
      style={{
        borderColor: "rgba(122, 217, 181, 0.5)",
        background: "rgba(122, 217, 181, 0.12)",
        color: colors.ink0,
      }}
    >
      <Shield size={compact ? 13 : 14} color="#2F9E78" />
      Damiin
    </button>
  );
}

function CollapsiblePanel({
  id,
  title,
  subtitle,
  icon,
  open,
  onToggle,
  badge,
  children,
}: {
  id: PanelId;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: (id: PanelId) => void;
  badge?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: open ? rgba(colors.goldRgb, 0.38) : rgba(colors.lineRgb, 0.1),
        background: open ? rgba(colors.goldRgb, 0.04) : rgba(colors.lineRgb, 0.02),
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="relative flex w-full items-center gap-3 px-3 py-3.5 text-left"
      >
        {open ? (
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${rgba(colors.goldRgb, 0.14)}, transparent)`,
            }}
          />
        ) : null}
        <span
          className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full"
          style={{ background: open ? colors.gold : "transparent" }}
        />
        <span
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: rgba(colors.goldRgb, open ? 0.22 : 0.1), color: colors.gold }}
        >
          {icon}
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {!open && subtitle ? (
            <p className="truncate text-[11px]" style={{ color: colors.inkMut }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span
            className="relative rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: rgba(colors.goldRgb, 0.18), color: colors.gold }}
          >
            {badge}
          </span>
        ) : null}
        <ChevronDown
          size={15}
          className="relative transition"
          style={{ color: colors.gold, transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open ? <div className="relative space-y-2 px-3 pb-3.5">{children}</div> : null}
    </div>
  );
}

function InfoTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  const { colors } = useTipTheme();
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${wide ? "col-span-2" : ""}`}
      style={{
        background: rgba(colors.lineRgb, 0.03),
        borderColor: rgba(colors.lineRgb, 0.07),
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.inkMut }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

export function ProfileScreen({
  auth,
  suspect,
  onBack,
  onMenu,
  onAddCase,
  onTab,
}: {
  auth: StoredAuth;
  suspect: SuspectListRow;
  onBack: () => void;
  onMenu: () => void;
  onAddCase: () => void;
  onTab?: (t: "home" | "suspects" | "responses") => void;
}) {
  const { colors } = useTipTheme();
  const isBaaris = suspect.source === "baaris";
  const isWanted = suspect.source === "wanted";
  const isNonAmniga = isBaaris || isWanted;
  const [damiins, setDamiins] = useState<DamiinRow[]>([]);
  const [cars, setCars] = useState<SuspectVehicle[]>([]);
  const [cases, setCases] = useState<SuspectCaseRow[]>([]);
  const [relations, setRelations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<PanelId>(isNonAmniga ? "personal" : "tuhunka");
  const [lightbox, setLightbox] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<SuspectVehicle | null>(null);
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  const photo = resolveTipMediaUrl(suspect.photo);
  const statusKey = suspect.status || "Watch";
  const statusColor = STATUS_COLOR[statusKey] || colors.gold;
  const fileNo = suspect.lambarka_diiwaanka || suspect.case_ref || `#${suspect.id}`;
  const tuhunka = isWanted
    ? hasVal(suspect.N_tuhunka) ? String(suspect.N_tuhunka) : "Wanted"
    : isBaaris
      ? "Baaris"
    : hasVal(suspect.N_tuhunka)
      ? String(suspect.N_tuhunka)
      : "—";

  const loadCars = useCallback(async () => {
    const c = await TipApi.fetchSuspectCars(suspect.id);
    setCars(c);
  }, [suspect.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isNonAmniga) {
        const [c, history] = await Promise.all([
          TipApi.fetchSuspectCars(suspect.id),
          TipApi.fetchSuspectCases(suspect.id),
        ]);
        if (!cancelled) {
          setDamiins([]);
          setCars(c);
          setCases(history);
          setRelations({});
          setLoading(false);
        }
        return;
      }
      const [d, c, rel, history] = await Promise.all([
        TipApi.fetchDamiins(suspect.id),
        TipApi.fetchSuspectCars(suspect.id),
        TipApi.fetchRelationships(),
        TipApi.fetchSuspectCases(suspect.id),
      ]);
      if (!cancelled) {
        setDamiins(d);
        setCars(c);
        setCases(history);
        setRelations(rel);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suspect.id, isNonAmniga]);

  const openAttachCar = useCallback(() => {
    if (!auth.user.id) {
      setToast({ kind: "error", title: so.profileCarAttachFailed, message: "User lama helin." });
      return;
    }
    setAttachOpen(true);
  }, [auth.user.id]);

  const personalFields = useMemo(() => {
    const rows: [string, string][] = [];
    if (hasVal(suspect.mother)) rows.push(["Hooyada", String(suspect.mother)]);
    if (hasVal(suspect.gender)) rows.push(["Jinsi", String(suspect.gender)]);
    if (hasVal(suspect.occupation)) rows.push(["Shaqada", String(suspect.occupation)]);
    if (hasVal(suspect.tnumber)) rows.push(["Telefoon", String(suspect.tnumber)]);
    if (hasVal(suspect.tribe)) rows.push(["Qabiil", String(suspect.tribe)]);
    if (hasVal(suspect.marital)) rows.push(["Xaalad", String(suspect.marital)]);
    if (hasVal(suspect.g_dhalashada || suspect.Dob)) {
      rows.push(["Dhalasho", String(suspect.g_dhalashada || suspect.Dob)]);
    }
    return rows;
  }, [suspect]);

  function togglePanel(id: PanelId) {
    setOpenPanel(id);
  }

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      <ScreenAppBar
        title={
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: colors.gold }}>
            {fileNo}
          </span>
        }
        onBack={onBack}
        onMenu={onMenu}
        right={
          <AppBarIconButton
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: suspect.name, text: `${suspect.name} · ${tuhunka}` }).catch(() => {});
              }
            }}
            label="Share"
          >
            <Share2 size={16} />
          </AppBarIconButton>
        }
      />

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {/* Hero */}
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div
              className="flex h-[168px] w-[168px] items-center justify-center rounded-[28px] p-[3px]"
              style={{
                background: `linear-gradient(135deg, ${statusColor}, ${rgba(colors.goldRgb, 0.85)}, ${statusColor})`,
              }}
            >
              <button
                type="button"
                disabled={!photo}
                onClick={() => photo && setLightbox(true)}
                className="h-full w-full overflow-hidden rounded-[25px]"
                style={{ background: colors.bg1 }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-5xl font-bold" style={{ color: colors.gold }}>
                    {(suspect.name || "?").slice(0, 1)}
                  </span>
                )}
              </button>
            </div>
            {/* Corner brackets */}
            {[
              "left-0 top-0 border-l-2 border-t-2",
              "right-0 top-0 border-r-2 border-t-2",
              "bottom-0 left-0 border-b-2 border-l-2",
              "bottom-0 right-0 border-b-2 border-r-2",
            ].map((cls) => (
              <span
                key={cls}
                className={`pointer-events-none absolute h-4 w-4 ${cls}`}
                style={{ borderColor: statusColor, margin: -2 }}
              />
            ))}
          </div>

          <span
            className="mb-2 max-w-[92%] rounded-full border px-3 py-1 text-[12px] font-semibold"
            style={{
              background: rgba(colors.goldRgb, 0.14),
              borderColor: rgba(colors.goldRgb, 0.38),
              color: colors.gold,
            }}
          >
            {tuhunka}
          </span>
          <h2 className="mb-3 text-[28px] font-bold leading-tight tracking-tight">{suspect.name}</h2>
          {!isNonAmniga ? <DamiinBtn onClick={onAddCase} compact /> : null}

          <div
            className="mt-4 grid w-full grid-cols-3 gap-2 rounded-2xl border p-3"
            style={{
              background: rgba(colors.lineRgb, 0.03),
              borderColor: rgba(colors.lineRgb, 0.08),
            }}
          >
            <div className="text-center">
              <p className="text-[10px] uppercase" style={{ color: colors.ink3 }}>
                {hasVal(suspect.tnumber) ? "Telefoon" : "Jinsi"}
              </p>
              <p className="truncate text-sm font-semibold">
                {hasVal(suspect.tnumber) ? suspect.tnumber : display(suspect.gender)}
              </p>
            </div>
            <div className="border-x text-center" style={{ borderColor: rgba(colors.lineRgb, 0.08) }}>
              <p className="text-[10px] uppercase" style={{ color: colors.ink3 }}>
                {isBaaris ? "Nooc" : "Tuhunka"}
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: colors.gold }}>
                {tuhunka}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase" style={{ color: colors.ink3 }}>
                Degmo
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: colors.gold }}>
                {display(suspect.degmada)}
              </p>
            </div>
          </div>

          {/* Stat strip */}
          <div
            className="mt-2 flex w-full divide-x rounded-2xl border"
            style={{
              borderColor: rgba(colors.lineRgb, 0.1),
              background: rgba(colors.surfRgb, 0.5),
            }}
          >
            <div className="flex-1 px-3 py-2.5 text-center">
              <p className="text-[10px]" style={{ color: colors.ink3 }}>
                Jinsi
              </p>
              <p className="text-sm font-semibold">{display(suspect.gender)}</p>
            </div>
            <div className="flex-1 px-3 py-2.5 text-center" style={{ borderColor: rgba(colors.lineRgb, 0.08) }}>
              <p className="text-[10px]" style={{ color: colors.ink3 }}>
                Taariikh
              </p>
              <p className="text-sm font-semibold">{display(suspect.created_ago || suspect.date_opp)}</p>
            </div>
          </div>
        </div>

        {/* Accordions */}
        <div className="space-y-2.5">
          {!isNonAmniga ? (
            <CollapsiblePanel
              id="tuhunka"
              title="Xogta Tuhunka"
              subtitle={tuhunka}
              icon={<FileText size={16} />}
              open={openPanel === "tuhunka"}
              onToggle={togglePanel}
            >
              <div className="grid grid-cols-2 gap-2">
                <InfoTile label="Tuhunka" value={tuhunka} wide />
                <InfoTile label="Degmada" value={display(suspect.degmada)} />
                <InfoTile label="Taariikhda" value={display(suspect.date_opp || suspect.created_ago)} />
              </div>
              {hasVal(suspect.description) ? (
                <div
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    borderColor: rgba(colors.lineRgb, 0.08),
                    background: rgba(colors.lineRgb, 0.03),
                    color: colors.ink1,
                  }}
                >
                  {suspect.description}
                </div>
              ) : null}
            </CollapsiblePanel>
          ) : (
            <CollapsiblePanel
              id="tuhunka"
              title="Degganaansho"
              subtitle={[suspect.degmada, suspect.waaxda].filter(Boolean).join(" · ") || "—"}
              icon={<FileText size={16} />}
              open={openPanel === "tuhunka"}
              onToggle={togglePanel}
            >
              <div className="grid grid-cols-2 gap-2">
                <InfoTile label="Degmada" value={display(suspect.degmada)} />
                <InfoTile label="Waaxda" value={display(suspect.waaxda)} />
                <InfoTile label="Case ref" value={display(suspect.case_ref)} wide />
                <InfoTile label="Taariikhda" value={display(suspect.date_opp || suspect.created_ago)} />
              </div>
            </CollapsiblePanel>
          )}

          {personalFields.length ? (
            <CollapsiblePanel
              id="personal"
              title={isBaaris ? "Xogta Muwaadinka" : isWanted ? "Xogta Wanted" : "Xogta Tuhmansanaha"}
              subtitle={personalFields.map(([, v]) => v).join(" · ")}
              icon={<User size={16} />}
              open={openPanel === "personal"}
              onToggle={togglePanel}
            >
              <div className="grid grid-cols-2 gap-2">
                {personalFields.map(([label, value], i) => (
                  <InfoTile key={label} label={label} value={value} wide={i === 0 && label === "Hooyada"} />
                ))}
              </div>
            </CollapsiblePanel>
          ) : null}

          <CollapsiblePanel
            id="cases"
            title="Taariikhda Kiisaska"
            subtitle={cases.length ? `${cases.length} kiis` : "Kiis lama helin"}
            icon={<Clock3 size={16} />}
            open={openPanel === "cases"}
            onToggle={togglePanel}
            badge={cases.length ? String(cases.length) : undefined}
          >
            {loading ? (
              <InlinePanelShimmer rows={3} />
            ) : cases.length === 0 ? (
              <p className="py-3 text-center text-sm" style={{ color: colors.inkMut }}>
                Kiis hore lama helin
              </p>
            ) : (
              <div className="space-y-2">
                {cases.map((row, index) => (
                  <div
                    key={row.id ?? index}
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: rgba(colors.lineRgb, 0.08),
                      background: rgba(colors.lineRgb, 0.03),
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                        {row.tuhunka || row.Tuhunka || row.case_code || `Kiis #${index + 1}`}
                      </p>
                      {row.status ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: rgba(colors.goldRgb, 0.13), color: colors.gold }}
                        >
                          {row.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: colors.inkMut }}>
                      {[row.d_qabashada, row.w_qabashada].filter(Boolean).join(" · ") || "Goob lama hayo"}
                    </p>
                    {row.description ? (
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.ink2 }}>
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CollapsiblePanel>

          {!isNonAmniga ? (
          <CollapsiblePanel
            id="damiin"
            title="Xogta Damiinka"
            subtitle={damiins.length ? `${damiins.length} damiin` : "Ma jiro"}
            icon={<Shield size={16} />}
            open={openPanel === "damiin"}
            onToggle={togglePanel}
            badge={damiins.length ? String(damiins.length) : undefined}
          >
            <div className="mb-2">
              <DamiinBtn onClick={onAddCase} compact />
            </div>
            {loading ? (
              <InlinePanelShimmer rows={3} />
            ) : damiins.length === 0 ? (
              <p className="py-3 text-center text-sm" style={{ color: colors.inkMut }}>
                Damiin lama helin
              </p>
            ) : (
              <div className="space-y-2">
                {damiins.map((d, i) => {
                  const pic = resolveTipMediaUrl(
                    (d as DamiinRow & { picture?: string }).picture || d.photo,
                  );
                  const phone =
                    (d as DamiinRow & { phone?: string }).phone || d.tnumber;
                  const relId = (d as DamiinRow & { relationship_id?: number }).relationship_id;
                  const rel =
                    d.relationship ||
                    (relId != null ? relations[String(relId)] : undefined);
                  return (
                    <div
                      key={d.id ?? i}
                      className="flex items-center gap-3 rounded-xl border p-2.5"
                      style={{
                        background: rgba(colors.lineRgb, 0.03),
                        borderColor: rgba(colors.lineRgb, 0.08),
                      }}
                    >
                      <div
                        className="flex h-10 w-10 overflow-hidden rounded-xl text-xs font-bold"
                        style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
                      >
                        {pic ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pic} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            {(d.name || "?").slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.name}</p>
                        <p className="truncate text-[11px]" style={{ color: colors.inkMut }}>
                          {[phone, rel, d.degmada].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsiblePanel>
          ) : null}
        </div>

        {/* Vehicles */}
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car size={14} style={{ color: colors.gold }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.inkMut }}>
                {so.profileVehicles}
              </p>
            </div>
            <button
              type="button"
              onClick={openAttachCar}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`,
                color: colors.onGold,
              }}
            >
              <Plus size={12} strokeWidth={2.5} />
              {so.profileAttachCar}
            </button>
          </div>
          {loading ? (
            <InlinePanelShimmer rows={2} />
          ) : cars.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed px-4 py-8 text-center"
              style={{ borderColor: rgba(colors.lineRgb, 0.15) }}
            >
              <Car className="mx-auto mb-2 opacity-40" size={22} style={{ color: colors.ink3 }} />
              <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                {so.profileNoVehicles}
              </p>
              <p className="mt-1 text-[12px]" style={{ color: colors.inkMut }}>
                {so.profileNoVehiclesSub}
              </p>
              <button
                type="button"
                onClick={openAttachCar}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`,
                  color: colors.onGold,
                }}
              >
                <Plus size={13} />
                {so.profileAttachCar}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {cars.map((car) => {
                const img = resolveTipMediaUrl(car.photoUrl);
                return (
                  <button
                    type="button"
                    key={car.id}
                    onClick={() => setSelectedVehicle(car)}
                    className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
                    style={{
                      background: rgba(colors.goldRgb, 0.12),
                      borderColor: rgba(colors.goldRgb, 0.28),
                    }}
                  >
                    {img ? (
                      <div className="h-14 w-[72px] shrink-0 overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <ProfileVehicleVisual seed={car.id} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: colors.ink0 }}>
                        {car.make}
                      </p>
                      <span
                        className="mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold tracking-wider"
                        style={{ background: "#f5e7c0", color: "#221706" }}
                      >
                        {car.plate}
                      </span>
                      {car.detail && car.detail !== "—" ? (
                        <p className="mt-1 truncate text-[11px]" style={{ color: colors.inkMut }}>
                          <span style={{ color: colors.gold }}>▸ </span>
                          {car.detail}
                        </p>
                      ) : null}
                    </div>
                    <span className="ml-auto text-lg" style={{ color: colors.gold }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}

      <AttachCarsModal
        open={attachOpen}
        suspectId={suspect.id}
        suspectName={suspect.name}
        suspectPhone={suspect.tnumber}
        userId={auth.user.id}
        onClose={() => setAttachOpen(false)}
        onSuccess={() => {
          void loadCars();
          setToast({
            kind: "success",
            title: so.profileCarAttachSuccess,
          });
        }}
      />

      <VehicleDetailSheet vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />

      {lightbox && photo ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}

      {onTab ? <BottomNav active="suspects" onSelect={onTab} /> : null}
    </div>
  );
}
