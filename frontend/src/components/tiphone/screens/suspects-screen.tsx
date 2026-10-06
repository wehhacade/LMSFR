"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { CountyRow, StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { resolveTipMediaUrl, listSourceForRole } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { BottomNav } from "../bottom-nav";
import { SuspectGridShimmer, SuspectListShimmer } from "../shimmer";

type ViewMode = "list" | "grid";
type Risk = "High" | "Medium" | "Low";
type Status = "Wanted" | "In custody" | "Watch";

const STATUS_PALETTE: Record<Status, string> = {
  Wanted: "#e87b6b",
  "In custody": "#7aa4d9",
  Watch: "#e9c177",
};

const RISK_PALETTE: Record<Risk, { color: string; dots: number }> = {
  High: { color: "#e87b6b", dots: 3 },
  Medium: { color: "#e9c177", dots: 2 },
  Low: { color: "#7ad99e", dots: 1 },
};

const DAMIIN = {
  deep: "#2F9E78",
  fillDeep: "#28966F",
  onFill: "#FFFFFF",
  rgb: "122, 217, 181",
};

function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDateOptions() {
  const today = new Date();
  const opts: { label: string; value: string }[] = [
    { label: "Dhammaan", value: "" },
    { label: "Maanta", value: formatYmd(today) },
  ];
  for (let i = 1; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    opts.push({ label: formatYmd(d), value: formatYmd(d) });
  }
  return opts;
}

function mapStatus(raw?: string): Status {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("want")) return "Wanted";
  if (s.includes("custody") || s.includes("jail") || s.includes("xabsi")) return "In custody";
  return "Watch";
}

function mapRisk(raw?: string): Risk {
  const r = (raw ?? "medium").toLowerCase();
  if (r.includes("high") || r.includes("sare")) return "High";
  if (r.includes("low") || r.includes("hoose")) return "Low";
  return "Medium";
}

function tuhunkaLabel(row: SuspectListRow): string {
  const t = row.N_tuhunka?.trim();
  if (t && t !== "—") return t;
  return "—";
}

function districtLabel(row: SuspectListRow): string {
  const parts = [row.degmada?.trim(), row.waaxda?.trim()].filter(Boolean) as string[];
  if (!parts.length) return "—";
  return parts
    .map((d) => d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");
}

function createdAgoLabel(row: SuspectListRow): string | null {
  const ago = row.created_ago?.trim();
  if (ago) return ago;
  return null;
}

function RiskDots({ risk, compact }: { risk: Risk; compact?: boolean }) {
  const { colors } = useTipTheme();
  const r = RISK_PALETTE[risk];
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full border"
      style={{
        background: colors.bg1,
        borderColor: `${r.color}55`,
        padding: compact ? "2px 5px" : "3px 6px",
      }}
    >
      {Array.from({ length: r.dots }).map((_, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: compact ? 4 : 5,
            height: compact ? 4 : 5,
            background: r.color,
          }}
        />
      ))}
    </span>
  );
}

function CaptureBadge({ count }: { count?: number }) {
  if (count == null || count <= 1) return null;
  return (
    <span
      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
      style={{ background: "#7C3AED" }}
    >
      {count}
    </span>
  );
}

function PortraitAvatar({
  size = 52,
  name,
  status,
  photo,
  showViewBadge,
}: {
  size?: number;
  name: string;
  status: Status;
  photo?: string | null;
  showViewBadge?: boolean;
}) {
  const { colors } = useTipTheme();
  const ring = STATUS_PALETTE[status] || colors.gold;
  const inner = size - 4;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${ring}, transparent)`,
        padding: 2,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: inner,
          height: inner,
          borderRadius: inner * 0.26,
          background: colors.bg1,
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-sm font-bold"
            style={{ color: ring }}
          >
            {(name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        {showViewBadge && photo ? (
          <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55">
            <Eye size={9} color="#fff" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DamiinMini({ onClick }: { onClick: () => void }) {
  const { colors } = useTipTheme();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `rgba(${DAMIIN.rgb}, 0.42)`,
        background: `rgba(${DAMIIN.rgb}, 0.1)`,
        color: colors.ink0,
      }}
    >
      <Shield size={11} color={DAMIIN.deep} />
      Damiin
    </button>
  );
}

function DamiinCompact({ onClick }: { onClick: () => void }) {
  const { colors } = useTipTheme();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        borderColor: `rgba(${DAMIIN.rgb}, 0.5)`,
        background: `rgba(${DAMIIN.rgb}, 0.12)`,
        color: colors.ink0,
      }}
    >
      <Shield size={13} color={DAMIIN.deep} />
      Damiin
    </button>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  const { colors } = useTipTheme();
  return (
    <div
      className="relative flex h-[34px] w-[76px] shrink-0 overflow-hidden rounded-xl border"
      style={{
        background: rgba(colors.lineRgb, 0.04),
        borderColor: rgba(colors.lineRgb, 0.1),
      }}
    >
      <span
        className="absolute top-[3px] h-[28px] w-[calc(50%-3px)] rounded-[10px] transition-all"
        style={{
          left: view === "list" ? 3 : "50%",
          background: `linear-gradient(90deg, ${colors.gold2}, ${colors.goldDeep})`,
        }}
      />
      {(["list", "grid"] as const).map((v) => {
        const active = view === v;
        const Icon = v === "list" ? List : LayoutGrid;
        return (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="relative z-[1] flex flex-1 items-center justify-center"
            aria-label={v}
          >
            <Icon size={16} style={{ color: active ? colors.onGold : colors.ink2 }} />
          </button>
        );
      })}
    </div>
  );
}

/** List row — exact app parity: avatar+risk · name+Damiin · tuhunka+district · (ago) */
function SuspectListCard({
  person,
  onOpen,
  onDamiin,
}: {
  person: SuspectListRow;
  onOpen: () => void;
  onDamiin: () => void;
}) {
  const { colors } = useTipTheme();
  const [photoOpen, setPhotoOpen] = useState(false);
  const photo = resolveTipMediaUrl(person.photo);
  const status = mapStatus(person.status);
  const risk = mapRisk(person.risk);
  const wanted = status === "Wanted";
  const tuhunka = tuhunkaLabel(person);
  const district = districtLabel(person);
  const createdAgo = createdAgoLabel(person);

  return (
    <>
      <div
        className="flex items-center gap-2.5 rounded-[14px] border px-2.5 py-2"
        style={{
          background: colors.bg1,
          borderColor: wanted ? "rgba(232,123,107,0.22)" : rgba(colors.lineRgb, 0.12),
        }}
      >
        <button
          type="button"
          className="relative shrink-0"
          disabled={!photo}
          onClick={() => photo && setPhotoOpen(true)}
        >
          <PortraitAvatar
            size={52}
            name={person.name}
            status={status}
            photo={photo}
            showViewBadge={!!photo}
          />
          <span className="absolute -bottom-0.5 -right-0.5">
            <RiskDots risk={risk} compact />
          </span>
          <CaptureBadge count={person.captureTime} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
              <p
                className="truncate text-[13.5px] font-bold leading-[17px] tracking-tight"
                style={{ color: colors.ink0 }}
              >
                {person.name || "—"}
              </p>
            </button>
            <DamiinMini onClick={onDamiin} />
          </div>

          {(tuhunka !== "—" || district !== "—") && (
            <button type="button" onClick={onOpen} className="mt-[3px] flex w-full min-w-0 items-center gap-1.5 text-left">
              {tuhunka !== "—" ? (
                <span
                  className="max-w-[46%] truncate rounded-[5px] border px-1.5 py-px text-[9.5px] font-semibold"
                  style={{
                    background: rgba(colors.goldRgb, 0.1),
                    borderColor: rgba(colors.goldRgb, 0.28),
                    color: colors.gold,
                  }}
                >
                  {tuhunka}
                </span>
              ) : null}
              {tuhunka !== "—" && district !== "—" ? (
                <span className="shrink-0 text-xs" style={{ color: colors.ink3 }}>
                  ·
                </span>
              ) : null}
              {district !== "—" ? (
                <span className="flex min-w-0 flex-1 items-center gap-0.5">
                  <MapPin size={9} style={{ color: colors.ink3, flexShrink: 0 }} />
                  <span
                    className="truncate text-[10.5px] font-medium"
                    style={{ color: colors.ink2 }}
                  >
                    {district}
                  </span>
                </span>
              ) : null}
            </button>
          )}

          {createdAgo ? (
            <button type="button" onClick={onOpen} className="mt-1 block text-left">
              <span className="text-[10.5px] font-semibold leading-[14px]" style={{ color: "#7C3AED" }}>
                ({createdAgo})
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {photoOpen && photo ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 p-4"
          onClick={() => setPhotoOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="max-h-[80%] max-w-full object-contain" />
        </div>
      ) : null}
    </>
  );
}

/** Grid card — portrait + tuhunka badge + risk · footer name/district/ago + Damiin */
function SuspectGridCard({
  person,
  onOpen,
  onDamiin,
}: {
  person: SuspectListRow;
  onOpen: () => void;
  onDamiin: () => void;
}) {
  const { colors } = useTipTheme();
  const photo = resolveTipMediaUrl(person.photo);
  const status = mapStatus(person.status);
  const risk = mapRisk(person.risk);
  const wanted = status === "Wanted";
  const tuhunka = tuhunkaLabel(person);
  const district = districtLabel(person);
  const createdAgo = createdAgoLabel(person);

  return (
    <div
      className="overflow-hidden rounded-[18px] border shadow-sm"
      style={{
        background: colors.bg1,
        borderColor: wanted ? "rgba(232,123,107,0.38)" : rgba(colors.lineRgb, 0.16),
        boxShadow: wanted
          ? "0 8px 20px rgba(232,123,107,0.18)"
          : "0 6px 16px rgba(0,0,0,0.12)",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[4/5] w-full overflow-hidden"
        style={{ background: colors.bg0 }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-4xl font-bold"
            style={{ color: STATUS_PALETTE[status] }}
          >
            {(person.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 35%, ${rgba(colors.scrimRgb, 0.82)})`,
          }}
        />
        {/* Tuhunka badge on portrait */}
        <span
          className="absolute left-2 top-2 max-w-[72%] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-semibold"
          style={{
            background: colors.bg1,
            borderColor: rgba(colors.goldRgb, 0.5),
            color: colors.gold,
          }}
        >
          {tuhunka}
        </span>
        <span className="absolute right-2 top-2">
          <RiskDots risk={risk} compact />
        </span>
        <span className="absolute bottom-2 right-2">
          <CaptureBadge count={person.captureTime} />
        </span>
      </button>

      <div
        className="space-y-1.5 border-t px-2.5 py-2.5"
        style={{
          background: colors.bg1,
          borderColor: rgba(colors.lineRgb, 0.1),
        }}
      >
        <button type="button" onClick={onOpen} className="w-full text-left">
          <p className="line-clamp-2 text-[13px] font-bold leading-tight" style={{ color: colors.ink0 }}>
            {person.name || "—"}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: colors.ink2 }}>
            {district}
          </p>
          {createdAgo ? (
            <p className="text-[10.5px] font-semibold" style={{ color: "#7C3AED" }}>
              ({createdAgo})
            </p>
          ) : null}
        </button>
        <div className="pt-0.5">
          <DamiinCompact onClick={onDamiin} />
        </div>
      </div>
    </div>
  );
}

export function SuspectsScreen({
  auth,
  onOpenDrawer,
  onTab,
  onOpenProfile,
  onRegister,
  onDamiin,
}: {
  auth: StoredAuth;
  onOpenDrawer: () => void;
  onTab: (t: "home" | "suspects" | "responses") => void;
  onOpenProfile: (s: SuspectListRow) => void;
  onRegister: () => void;
  onDamiin: (s: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [view, setView] = useState<ViewMode>("grid");
  const [rows, setRows] = useState<SuspectListRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState(0);
  const [counties, setCounties] = useState<CountyRow[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const dateOpts = useMemo(() => buildDateOptions(), []);
  const listSource = useMemo(
    () => listSourceForRole(auth.roles, auth.permissions),
    [auth.roles, auth.permissions],
  );

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await TipApi.fetchSuspectList({
          userId: auth.user.id,
          page: p,
          county,
          dateFilter,
          searchQuery: query,
          // Browse is role-scoped; search stays shared across registries.
          source: query.trim() ? undefined : listSource,
        });
        setRows(res.rows);
        setPage(res.currentPage);
        setTotalPages(res.totalPages);
      } finally {
        setLoading(false);
      }
    },
    [auth.user.id, county, dateFilter, query, listSource],
  );

  useEffect(() => {
    TipApi.fetchCounties().then(setCounties).catch(() => {});
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const countyLabel =
    county === 0 ? so.suspectsDegmo : counties.find((c) => c.id === county)?.name || so.suspectsDegmo;
  const dateLabel = dateOpts.find((d) => d.value === dateFilter)?.label || so.suspectsDate;
  const hasFilters = Boolean(query || county || dateFilter);
  const newCount = rows.filter((r) => r.seen === false).length;

  return (
    <div className="flex min-h-dvh flex-col pb-28">
      <ScreenAppBar
        kicker={so.suspectsKicker}
        title={
          <>
            {so.suspectsTitle}{" "}
            <span style={{ color: colors.gold }}>{so.suspectsTitleEm}</span>
          </>
        }
        onBack={() => onTab("home")}
        onMenu={onOpenDrawer}
      />

      <div className="mx-auto w-full max-w-lg flex-1 px-[18px] pt-2">
        {/* Search */}
        <div
          className="mb-2.5 flex h-[42px] items-center gap-2.5 rounded-xl border px-3"
          style={{
            background: rgba(colors.lineRgb, 0.04),
            borderColor: rgba(colors.lineRgb, 0.1),
          }}
        >
          <Search size={16} style={{ color: colors.ink2 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder={so.suspectsSearch}
            className="w-full bg-transparent text-[13.5px] outline-none"
            style={{ color: colors.ink0 }}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} style={{ color: colors.inkMut }}>
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Degmo · Taariikh · ViewToggle */}
        <div className="mb-3 flex items-center gap-2">
          <label
            className="flex min-w-0 flex-1 flex-col rounded-xl border px-3 py-2"
            style={{
              background: rgba(colors.lineRgb, 0.04),
              borderColor: rgba(colors.lineRgb, 0.1),
            }}
          >
            <span
              className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.08em]"
              style={{ color: colors.inkMut }}
            >
              {so.suspectsDegmo}
            </span>
            <span className="flex items-center gap-1">
              <select
                value={county}
                onChange={(e) => setCounty(Number(e.target.value))}
                className="w-full truncate bg-transparent text-[13.5px] font-semibold outline-none"
                style={{ color: colors.ink0 }}
              >
                <option value={0}>{so.suspectsDegmo}</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ color: colors.ink2 }} />
            </span>
          </label>

          <label
            className="flex min-w-0 flex-1 flex-col rounded-xl border px-3 py-2"
            style={{
              background: rgba(colors.lineRgb, 0.04),
              borderColor: rgba(colors.lineRgb, 0.1),
            }}
          >
            <span
              className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.08em]"
              style={{ color: colors.inkMut }}
            >
              {so.suspectsDate}
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full truncate bg-transparent text-[13.5px] font-semibold outline-none"
              style={{ color: colors.ink0 }}
            >
              {dateOpts.map((d) => (
                <option key={d.value || "all"} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <ViewToggle view={view} setView={setView} />
        </div>

        {/* Meta row */}
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.1em]"
            style={{ color: colors.ink3 }}
          >
            {rows.length} tuhmane
            {newCount > 0 ? ` · ${newCount} cusub` : ""}
            {hasFilters ? ` · ${countyLabel}` : ""}
            {dateFilter ? ` · ${dateLabel}` : ""}
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: rgba(colors.goldRgb, 0.12), color: colors.gold }}
          >
            {view === "grid" ? "Grid view" : "List view"}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          view === "grid" ? <SuspectGridShimmer /> : <SuspectListShimmer />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-base font-semibold">{so.suspectsEmpty}</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCounty(0);
                setDateFilter("");
              }}
              className="rounded-[14px] border px-[18px] py-2.5 text-[13px] font-semibold"
              style={{
                background: rgba(colors.goldRgb, 0.14),
                borderColor: rgba(colors.goldRgb, 0.28),
                color: colors.gold,
              }}
            >
              {so.suspectsRefresh}
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {rows.map((r) => (
              <SuspectGridCard
                key={r.id}
                person={r}
                onOpen={() => onOpenProfile(r)}
                onDamiin={() => onDamiin(r)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <SuspectListCard
                key={r.id}
                person={r}
                onOpen={() => onOpenProfile(r)}
                onDamiin={() => onDamiin(r)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-end gap-2 px-1 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] disabled:opacity-35"
              style={{ color: colors.gold }}
            >
              ‹
            </button>
            <span className="min-w-[72px] text-center text-sm font-semibold" style={{ color: colors.gold }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => load(page + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] disabled:opacity-35"
              style={{ color: colors.gold }}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {/* Register FAB */}
      <div className="pointer-events-none fixed bottom-[7.5rem] right-[22px] z-[45]">
        <span
          className="absolute inset-0 animate-[tipFabRing_1.8s_ease-out_infinite] rounded-[20px] border-2"
          style={{ borderColor: "rgba(122, 217, 181, 0.7)" }}
          aria-hidden
        />
        <button
          type="button"
          onClick={onRegister}
          className="pointer-events-auto relative flex h-[58px] w-[58px] animate-[tipFabPulse_2.2s_ease-in-out_infinite] items-center justify-center rounded-[20px] border-2 transition active:scale-95"
          style={{
            background: "linear-gradient(135deg, #9AE8CA, #52C49A, #28966F)",
            borderColor: "rgba(122, 217, 181, 0.75)",
            color: "#FFFFFF",
            boxShadow: "0 10px 18px rgba(40, 150, 111, 0.42)",
          }}
          aria-label="Registration"
        >
          <Plus size={28} />
        </button>
      </div>
      <style>{`
        @keyframes tipFabPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes tipFabRing {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      <BottomNav active="suspects" onSelect={onTab} />
    </div>
  );
}
