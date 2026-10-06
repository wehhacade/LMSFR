"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  LayoutGrid,
  List,
  Search,
  Shield,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { TipApi, type DistrictUserRow } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { StoredAuth } from "@/lib/tiphone/types";
import { formatCountyLabel, resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { AppBarIconButton, ScreenAppBar } from "../app-bar";
import { TopUsersSheet } from "../top-users-sheet";
import { ListRowShimmer, SuspectGridShimmer } from "../shimmer";
import { useSwipeBackHandler } from "../ios-swipe-back";

type Period = "daily" | "weekly" | "monthly" | "all";
type ViewMode = "grid" | "list";

type District = {
  id: number;
  name: string;
  img: string;
  user_county: number | string;
  total_suspect: number | string;
  total_cases: number | string;
  daily?: { users: number | string; suspects: number | string; cases: number | string };
  weekly?: { users: number | string; suspects: number | string; cases: number | string };
  monthly?: { users: number | string; suspects: number | string; cases: number | string };
  all?: { users: number | string; suspects: number | string; cases: number | string };
};

const PERIODS: { id: Period; label: string }[] = [
  { id: "daily", label: "Maalin" },
  { id: "weekly", label: "Toddobaad" },
  { id: "monthly", label: "Bil" },
  { id: "all", label: "Dhammaan" },
];

const ROW_OPTIONS = [5, 10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 350;

function statsFor(d: District, period: Period) {
  const bucket = d[period];
  if (bucket) return bucket;
  return { users: d.user_county, suspects: d.total_suspect, cases: d.total_cases };
}

function seedTone(seed: number): string {
  const hues = [210, 25, 160, 280, 40, 190];
  const h = hues[Math.abs(seed) % hues.length]!;
  return `hsl(${h} 48% 42%)`;
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function GradAvatar({ size, seed, label }: { size: number; seed: number; label: string }) {
  const { colors } = useTipTheme();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.32),
        background: `linear-gradient(145deg, ${seedTone(seed)}, ${rgba(colors.goldRgb, 0.55)})`,
        boxShadow: `0 0 0 1.5px ${rgba(colors.goldRgb, 0.25)}`,
      }}
      aria-hidden
    >
      {initials(label)}
    </div>
  );
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function matchesDigitTail(field: string, queryDigits: string): boolean {
  if (!field || !queryDigits) return false;
  if (queryDigits.length <= 4) return field.endsWith(queryDigits);
  return field.includes(queryDigits);
}

function filterOfficers(rows: DistrictUserRow[], query: string): DistrictUserRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const qDigits = digitsOnly(q);
  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    if (row.phone.toLowerCase().includes(q)) return true;
    if (row.email.toLowerCase().includes(q)) return true;
    if (!qDigits) return false;
    return [String(row.id), digitsOnly(row.phone), digitsOnly(row.email)].some((field) =>
      matchesDigitTail(field, qDigits),
    );
  });
}

function OfficerCardShimmer() {
  const { colors } = useTipTheme();
  return (
    <div
      className="rounded-[20px] border p-3"
      style={{ borderColor: rgba(colors.lineRgb, 0.1) }}
    >
      <div className="flex items-start gap-2.5">
        <div className="h-[26px] w-[26px] rounded-[9px] bg-white/10" />
        <div className="h-[46px] w-[46px] rounded-full bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <div className="h-3.5 w-[92%] rounded bg-white/10" />
          <div className="h-3.5 w-[70%] rounded bg-white/10" />
          <div className="h-2.5 w-[48%] rounded bg-white/10" />
        </div>
        <div className="h-9 w-11 rounded-[14px] bg-white/10" />
      </div>
      <div className="mt-2.5 flex justify-between pl-9">
        <div className="space-y-1">
          <div className="h-2 w-10 rounded bg-white/10" />
          <div className="h-2.5 w-[72px] rounded bg-white/10" />
          <div className="h-2.5 w-24 rounded bg-white/10" />
        </div>
        <div className="h-3 w-[58px] rounded bg-white/10" />
      </div>
    </div>
  );
}

function OfficerCard({ row, index }: { row: DistrictUserRow; index: number }) {
  const { colors } = useTipTheme();
  const suspectCount = row.total_suspect;
  const ll = row.lastlogin;

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border p-3"
      style={{
        background: rgba(colors.surfRgb, 0.82),
        borderColor: rgba(colors.lineRgb, 0.1),
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%]"
        style={{
          background: `linear-gradient(180deg, ${rgba(colors.goldRgb, index < 3 ? 0.1 : 0.04)}, transparent)`,
        }}
      />
      <div className="relative flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-semibold"
          style={{ background: rgba(colors.goldRgb, 0.12), color: colors.gold }}
        >
          {index + 1}
        </span>
        <GradAvatar size={46} seed={row.id || index * 11 + 3} label={row.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-[19px]" style={{ color: colors.ink0 }}>
            {row.name}
          </p>
          {row.phone ? (
            <p className="mt-0.5 truncate text-[11.5px]" style={{ color: colors.ink2 }}>
              {row.phone}
            </p>
          ) : null}
        </div>
        <div
          className="flex min-w-[44px] shrink-0 items-center justify-center rounded-[14px] border px-3 py-2"
          style={{
            background: "rgba(240,160,75,0.12)",
            borderColor: "rgba(240,160,75,0.28)",
          }}
        >
          <span className="text-base font-bold" style={{ color: "#F0A04B" }}>
            {suspectCount}
          </span>
        </div>
      </div>

      <div className="relative mt-2.5 flex items-end justify-between gap-2.5 pl-9">
        <div className="min-w-0 flex-1">
          <p className="text-[8.5px] tracking-wide" style={{ color: colors.inkMut }}>
            {so.maareyntaLastLogin}
          </p>
          {ll.never || !ll.line2 ? (
            <p className="text-[10.5px] font-semibold" style={{ color: colors.ink2 }}>
              {ll.line1}
            </p>
          ) : (
            <div className="mt-0.5">
              <p className="truncate text-[10.5px] font-semibold" style={{ color: colors.ink1 }}>
                {ll.line1}
              </p>
              <p className="truncate text-[10px] font-semibold" style={{ color: colors.gold }}>
                {ll.line2}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pb-0.5">
          <Fingerprint size={12} style={{ color: "#F0A04B" }} />
          <span className="text-[10px]" style={{ color: colors.ink2 }}>
            {so.leadersSuspectCol}
          </span>
        </div>
      </div>
    </div>
  );
}

function DistrictDetailView({
  district,
  onBack,
  onMenu,
}: {
  district: District;
  onBack: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<DistrictUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const displayName = formatCountyLabel(district.name);
  const crest = resolveTipMediaUrl(district.img);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await TipApi.fetchDistrictUsers(district.id));
      setPage(0);
    } finally {
      setLoading(false);
    }
  }, [district.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, rowsPerPage]);

  const filteredRows = useMemo(
    () => filterOfficers(rows, debouncedSearch),
    [rows, debouncedSearch],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalSuspects = useMemo(
    () => filteredRows.reduce((sum, r) => sum + (Number(r.total_suspect) || 0), 0),
    [filteredRows],
  );

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <ScreenAppBar title={displayName} onBack={onBack} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-2">
        {/* Hero — matches native DistrictDetailScreen */}
        <div
          className="relative mb-3.5 overflow-hidden rounded-[26px] border px-4 py-6 text-center"
          style={{
            background: rgba(colors.surfnavRgb, 0.9),
            borderColor: rgba(colors.lineRgb, 0.12),
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-18deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)",
              color: colors.ink0,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${rgba(colors.goldRgb, 0.2)}, ${rgba(colors.goldRgb, 0.05)} 45%, transparent)`,
            }}
          />
          <div className="relative">
            <div
              className="mx-auto mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] text-3xl font-bold"
              style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
            >
              {crest ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crest} alt="" className="h-full w-full object-cover" />
              ) : (
                displayName.slice(0, 1)
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight" style={{ color: colors.ink0 }}>
              {displayName}
            </p>
            <p
              className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: colors.gold }}
            >
              {so.leadersOfficers}
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <div
                className="rounded-2xl border px-2.5 py-3"
                style={{
                  background: rgba(colors.lineRgb, 0.06),
                  borderColor: rgba(colors.lineRgb, 0.1),
                }}
              >
                <User size={16} className="mx-auto" style={{ color: colors.gold }} />
                <p className="mt-1 text-xl font-bold" style={{ color: colors.ink0 }}>
                  {debouncedSearch ? `${filteredRows.length}/${rows.length}` : rows.length}
                </p>
                <p className="text-[9px]" style={{ color: colors.inkMut }}>
                  {so.leadersTotalOfficers}
                </p>
              </div>
              <div
                className="rounded-2xl border px-2.5 py-3"
                style={{
                  background: "rgba(240,160,75,0.08)",
                  borderColor: "rgba(240,160,75,0.2)",
                }}
              >
                <Fingerprint size={16} className="mx-auto" style={{ color: "#F0A04B" }} />
                <p className="mt-1 text-xl font-bold" style={{ color: colors.ink0 }}>
                  {totalSuspects}
                </p>
                <p className="text-[9px]" style={{ color: colors.inkMut }}>
                  {so.leadersTotalSuspects}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div
          className="mb-3.5 flex h-12 items-center gap-2.5 rounded-2xl border px-3.5"
          style={{
            background: rgba(colors.surfnavRgb, 0.9),
            borderColor: rgba(colors.lineRgb, 0.12),
          }}
        >
          <Search size={17} style={{ color: colors.gold }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={so.leadersSearchOfficers}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: colors.ink0 }}
            autoCorrect="off"
            autoCapitalize="none"
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear">
              <X size={14} style={{ color: colors.inkMut }} />
            </button>
          ) : null}
        </div>

        {/* Toolbar */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="flex-1 text-[15px] font-bold" style={{ color: colors.gold }}>
            {so.leadersUserData}
          </p>
          <div className="flex gap-1">
            {ROW_OPTIONS.map((n) => {
              const on = rowsPerPage === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setRowsPerPage(n);
                    setPage(0);
                  }}
                  className="rounded-[10px] border px-2.5 py-1.5 text-[11px] font-semibold"
                  style={{
                    background: on ? rgba(colors.goldRgb, 0.14) : rgba(colors.lineRgb, 0.05),
                    borderColor: on ? rgba(colors.goldRgb, 0.35) : rgba(colors.lineRgb, 0.1),
                    color: on ? colors.gold : colors.ink2,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <OfficerCardShimmer key={i} />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-8">
            <Users size={40} style={{ color: colors.ink3 }} />
            <p className="px-6 text-center text-sm font-semibold" style={{ color: colors.rose }}>
              {debouncedSearch ? so.maareyntaNoUsers : so.leadersEmptyDistrict}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pageRows.map((row, i) => (
              <OfficerCard
                key={row.id || `${row.name}-${i}`}
                row={row}
                index={page * rowsPerPage + i}
              />
            ))}
          </div>
        )}

        {filteredRows.length > rowsPerPage ? (
          <div className="mt-4 flex items-center justify-center gap-3.5">
            <button
              type="button"
              disabled={loading || page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] border disabled:opacity-40"
              style={{
                borderColor: rgba(colors.lineRgb, 0.12),
                background: rgba(colors.surfnavRgb, 0.8),
                color: colors.gold,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[52px] text-center text-xs font-semibold" style={{ color: colors.ink2 }}>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={loading || page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] border disabled:opacity-40"
              style={{
                borderColor: rgba(colors.lineRgb, 0.12),
                background: rgba(colors.surfnavRgb, 0.8),
                color: colors.gold,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadersViewToggle({
  view,
  setView,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
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
          left: view === "grid" ? 3 : "50%",
          background: `linear-gradient(90deg, ${colors.gold2}, ${colors.goldDeep})`,
        }}
      />
      {(["grid", "list"] as const).map((v) => {
        const active = view === v;
        const Icon = v === "grid" ? LayoutGrid : List;
        return (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="relative z-[1] flex flex-1 items-center justify-center"
          >
            <Icon size={16} style={{ color: active ? colors.onGold : colors.ink2 }} />
          </button>
        );
      })}
    </div>
  );
}

function DistrictCard({
  d,
  period,
  mode,
  onClick,
}: {
  d: District;
  period: Period;
  mode: ViewMode;
  onClick: () => void;
}) {
  const { colors } = useTipTheme();
  const stats = statsFor(d, period);
  const img = resolveTipMediaUrl(d.img);
  const name = formatCountyLabel(d.name);

  if (mode === "list") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
        style={{
          background: rgba(colors.surfRgb, 0.7),
          borderColor: rgba(colors.lineRgb, 0.1),
        }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold"
          style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-[11px]" style={{ color: colors.gold }}>
            {PERIODS.find((p) => p.id === period)?.label}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: colors.inkMut }}>
            {stats.users} · {stats.suspects} · {stats.cases}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-[22px] border p-3.5 text-left"
      style={{
        background: rgba(colors.surfRgb, 0.88),
        borderColor: rgba(colors.lineRgb, 0.12),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${rgba(colors.goldRgb, 0.16)}, transparent 35%)`,
        }}
      />
      <div className="mb-2 flex justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] text-xl font-bold"
          style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1)
          )}
        </div>
      </div>
      <p className="truncate text-center text-sm font-bold">{name}</p>
      <p className="mb-2 text-center text-[11px]" style={{ color: colors.gold }}>
        {PERIODS.find((p) => p.id === period)?.label}
      </p>
      <div className="grid grid-cols-3 gap-1">
        {[
          { Icon: Users, value: stats.users, tint: "107, 155, 255", color: "#6B9BFF" },
          { Icon: Fingerprint, value: stats.suspects, tint: "240, 160, 75", color: "#F0A04B" },
          { Icon: Shield, value: stats.cases, tint: "42, 120, 78", color: colors.green },
        ].map(({ Icon, value, tint, color }) => (
          <div
            key={tint}
            className="rounded-xl border px-1 py-1.5 text-center"
            style={{ background: `rgba(${tint}, 0.1)`, borderColor: `rgba(${tint}, 0.2)` }}
          >
            <Icon size={13} className="mx-auto" style={{ color }} />
            <p className="text-[11px] font-bold">{value}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

export function LeadersScreen({
  auth,
  onBack,
  onMenu,
}: {
  auth: StoredAuth;
  onBack: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTipTheme();
  const [districts, setDistricts] = useState<District[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("daily");
  const [view, setView] = useState<ViewMode>("grid");
  const [detail, setDetail] = useState<District | null>(null);
  const [topUsersOpen, setTopUsersOpen] = useState(false);

  const swipeBack = useCallback(() => {
    if (topUsersOpen) {
      setTopUsersOpen(false);
      return;
    }
    if (detail) {
      setDetail(null);
      return;
    }
    onBack();
  }, [topUsersOpen, detail, onBack]);

  useSwipeBackHandler(swipeBack);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await TipApi.fetchDistrictPage(auth.user.id, p);
        setDistricts(res.districts);
        setPage(res.currentPage);
        setTotalPages(res.totalPages);
      } finally {
        setLoading(false);
      }
    },
    [auth.user.id],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  if (detail) {
    return (
      <DistrictDetailView
        district={detail}
        onBack={() => setDetail(null)}
        onMenu={onMenu}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <ScreenAppBar
        kicker="DEGMOOYINKA · XOG"
        title={so.leadersTitle}
        onBack={onBack}
        onMenu={onMenu}
        right={
          <AppBarIconButton
            onClick={() => setTopUsersOpen(true)}
            label="Top users"
            className="!border-[rgba(138,94,16,0.28)]"
          >
            <Trophy size={18} style={{ color: colors.gold }} />
          </AppBarIconButton>
        }
      />

      <div className="mx-auto w-full max-w-lg flex-1 px-3 pt-2">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: period === p.id ? rgba(colors.goldRgb, 0.18) : rgba(colors.lineRgb, 0.04),
                color: period === p.id ? colors.gold : colors.inkMut,
                border: `1px solid ${period === p.id ? rgba(colors.goldRgb, 0.35) : rgba(colors.lineRgb, 0.1)}`,
              }}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto">
            <LeadersViewToggle view={view} setView={setView} />
          </div>
        </div>

        {loading ? (
          view === "grid" ? <SuspectGridShimmer count={6} /> : <ListRowShimmer count={6} />
        ) : districts.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.inkMut }}>
            Degmo lama helin — hubi in API `/top-admin-page` shaqeynayo.
          </p>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {districts.map((d) => (
              <DistrictCard key={d.id} d={d} period={period} mode="grid" onClick={() => setDetail(d)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {districts.map((d) => (
              <DistrictCard key={d.id} d={d} period={period} mode="list" onClick={() => setDetail(d)} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div
            className="fixed bottom-6 right-5 z-40 flex items-center gap-3 rounded-full border px-3 py-2 shadow-lg"
            style={{
              background: rgba(colors.surfnavRgb, 0.95),
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => void load(page - 1)}
              className="disabled:opacity-40"
              style={{ color: colors.gold }}
            >
              ‹
            </button>
            <span className="text-xs font-bold" style={{ color: colors.gold }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
              className="disabled:opacity-40"
              style={{ color: colors.gold }}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <TopUsersSheet open={topUsersOpen} onClose={() => setTopUsersOpen(false)} />
    </div>
  );
}
