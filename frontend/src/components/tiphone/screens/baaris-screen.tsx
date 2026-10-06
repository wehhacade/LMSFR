"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List, MapPin, Search } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { formatCountyLabel, resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { SuspectGridShimmer, SuspectListShimmer } from "../shimmer";
import { useSwipeBackHandler } from "../ios-swipe-back";

type ReportPeriod = "all" | "today" | "week" | "custom";
type ViewMode = "list" | "grid";

const ACCENT = {
  deep: "#3E54AC",
  mid: "#5B6FD6",
  rgb: "62, 84, 172",
};

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "all", label: so.baarisPeriodAll },
  { id: "today", label: so.baarisPeriodToday },
  { id: "week", label: so.baarisPeriodWeek },
  { id: "custom", label: so.baarisPeriodCustom },
];

function formatApiDate(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDisplayDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function toInputDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, day] = value.split("-").map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function periodRange(
  period: ReportPeriod,
  customStart: Date | null,
  customEnd: Date | null,
): { start?: string; end?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (period === "today") {
    const s = formatApiDate(today);
    return { start: s, end: s };
  }
  if (period === "week") {
    return { start: formatApiDate(startOfWeek(today)), end: formatApiDate(today) };
  }
  if (period === "custom" && customStart && customEnd) {
    return { start: formatApiDate(customStart), end: formatApiDate(customEnd) };
  }
  return {};
}

function periodLabel(
  period: ReportPeriod,
  customStart: Date | null,
  customEnd: Date | null,
): string {
  if (period === "today") return so.baarisPeriodToday;
  if (period === "week") return so.baarisPeriodWeek;
  if (period === "custom" && customStart && customEnd) {
    return `${formatDisplayDate(customStart)} – ${formatDisplayDate(customEnd)}`;
  }
  return so.baarisPeriodAll;
}

function CaptureBadge({ count }: { count: number }) {
  if (!count || count <= 1) return null;
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${ACCENT.deep}, ${ACCENT.mid})` }}
    >
      {count}
    </span>
  );
}

function ReportListItem({
  row,
  onPress,
}: {
  row: SuspectListRow;
  onPress: () => void;
}) {
  const { colors } = useTipTheme();
  const unseen = row.seen === false;
  const photo = resolveTipMediaUrl(row.photo);
  const district = row.degmada ? formatCountyLabel(row.degmada) : "—";
  const tuhunka = row.N_tuhunka?.trim() || "—";

  return (
    <button
      type="button"
      onClick={onPress}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.99]"
      style={{
        background: unseen ? "rgba(244,63,94,0.08)" : rgba(colors.surfRgb, 0.75),
        borderColor: unseen ? "rgba(244,63,94,0.35)" : rgba(ACCENT.rgb, 0.22),
      }}
    >
      <div className="relative shrink-0">
        <div
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold"
          style={{ background: rgba(ACCENT.rgb, 0.12), color: ACCENT.deep }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            (row.name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        {unseen ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-black/20" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p className="truncate text-sm font-bold" style={{ color: colors.ink0 }}>
            {row.name?.trim() || "—"}
          </p>
          <span className="shrink-0 text-[11px]" style={{ color: ACCENT.mid }}>
            ({tuhunka})
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {district !== "—" ? (
            <span
              className="inline-flex max-w-[58%] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: rgba(ACCENT.rgb, 0.1), color: ACCENT.deep }}
            >
              <MapPin size={9} />
              <span className="truncate">{district}</span>
            </span>
          ) : null}
          {row.created_ago ? (
            <span className="text-[11px]" style={{ color: colors.ink3 }}>
              ({row.created_ago})
            </span>
          ) : null}
        </div>
      </div>
      <CaptureBadge count={row.captureTime ?? 0} />
      <ChevronRight size={14} style={{ color: colors.ink3 }} />
    </button>
  );
}

function ReportGridItem({
  row,
  onPress,
}: {
  row: SuspectListRow;
  onPress: () => void;
}) {
  const { colors } = useTipTheme();
  const unseen = row.seen === false;
  const photo = resolveTipMediaUrl(row.photo);
  const district = row.degmada ? formatCountyLabel(row.degmada) : "—";
  const tuhunka = row.N_tuhunka?.trim() || "—";

  return (
    <button
      type="button"
      onClick={onPress}
      className="overflow-hidden rounded-2xl border text-left transition active:scale-[0.98]"
      style={{
        background: unseen ? "rgba(244,63,94,0.08)" : rgba(colors.surfRgb, 0.75),
        borderColor: unseen ? "rgba(244,63,94,0.35)" : rgba(ACCENT.rgb, 0.22),
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: colors.bg1 }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full items-center justify-center text-3xl font-bold"
            style={{ color: ACCENT.deep, background: rgba(ACCENT.rgb, 0.1) }}
          >
            {(row.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.72))" }}
        />
        {unseen ? (
          <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-black/30" />
        ) : null}
        <div className="absolute right-2 top-2">
          <CaptureBadge count={row.captureTime ?? 0} />
        </div>
        <span
          className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: rgba(colors.surfRgb, 0.92),
            borderColor: rgba(ACCENT.rgb, 0.45),
            color: ACCENT.deep,
          }}
        >
          {tuhunka}
        </span>
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="line-clamp-2 text-[13px] font-bold leading-tight" style={{ color: colors.ink0 }}>
          {row.name?.trim() || "—"}
        </p>
        <p className="truncate text-[11px]" style={{ color: colors.ink2 }}>
          {district !== "—" ? district : "\u00A0"}
        </p>
        <p className="truncate text-[11px]" style={{ color: colors.ink3 }}>
          {row.created_ago ? `(${row.created_ago})` : "\u00A0"}
        </p>
      </div>
    </button>
  );
}

export function BaarisScreen({
  auth,
  onBack,
  onMenu,
  onOpenProfile,
}: {
  auth: StoredAuth;
  onBack: () => void;
  onMenu: () => void;
  onOpenProfile: (s: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<SuspectListRow[]>([]);
  const [counties, setCounties] = useState<{ id: number; name: string }[]>([{ id: 0, name: "All" }]);
  const [countyId, setCountyId] = useState(0);
  const [countyLabel, setCountyLabel] = useState("All");
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [countyOpen, setCountyOpen] = useState(false);
  const [countySearch, setCountySearch] = useState("");
  const fetchingRef = useRef(false);
  const searchReadyRef = useRef(false);

  const swipeBack = useCallback(() => {
    if (countyOpen) {
      setCountyOpen(false);
      return;
    }
    onBack();
  }, [countyOpen, onBack]);
  useSwipeBackHandler(swipeBack);

  const filtersRef = useRef({ countyId, period, customStart, customEnd, searchQuery });
  filtersRef.current = { countyId, period, customStart, customEnd, searchQuery };

  useEffect(() => {
    TipApi.fetchCounties()
      .then((list) => {
        setCounties([
          { id: 0, name: "All" },
          ...list.map((r) => ({ id: r.id, name: formatCountyLabel(r.name) })),
        ]);
      })
      .catch(() => setCounties([{ id: 0, name: "All" }]));
  }, []);

  const runFetch = useCallback(
    async (
      targetPage: number,
      filters: typeof filtersRef.current,
    ) => {
      if (fetchingRef.current) return;
      if (filters.period === "custom" && (!filters.customStart || !filters.customEnd)) {
        setLoading(false);
        return;
      }
      fetchingRef.current = true;
      setLoading(true);
      setError(false);
      try {
        const { start, end } = periodRange(filters.period, filters.customStart, filters.customEnd);
        const result = await TipApi.fetchSuspectReport({
          userId: auth.user.id,
          page: targetPage,
          searchQuery: filters.searchQuery,
          county: filters.countyId,
          start,
          end,
        });
        setRows(result.rows);
        setPage(result.currentPage);
        setTotalPages(result.totalPages);
      } catch {
        setRows([]);
        setError(true);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [auth.user.id],
  );

  useEffect(() => {
    void runFetch(page, filtersRef.current);
  }, [page, countyId, period, customStart, customEnd, runFetch]);

  useEffect(() => {
    if (!searchReadyRef.current) {
      searchReadyRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      setPage(1);
      void runFetch(1, filtersRef.current);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, runFetch]);

  const unseenCount = useMemo(() => rows.filter((r) => r.seen === false).length, [rows]);
  const activePeriodLabel = useMemo(
    () => periodLabel(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const filteredCounties = useMemo(() => {
    const q = countySearch.trim().toLowerCase();
    if (!q) return counties;
    return counties.filter((c) => c.name.toLowerCase().includes(q));
  }, [counties, countySearch]);

  function selectPeriod(next: ReportPeriod) {
    setPeriod(next);
    setPage(1);
    if (next === "custom" && !customStart && !customEnd) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      setCustomStart(weekAgo);
      setCustomEnd(today);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <ScreenAppBar
        kicker={so.baarisKicker}
        title={so.baarisTitle}
        onBack={onBack}
        onMenu={onMenu}
      />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-1">
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: colors.ink2 }}>
          {so.baarisSubtitle}
        </p>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPeriod(p.id)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  background: active ? rgba(ACCENT.rgb, 0.14) : rgba(colors.lineRgb, 0.04),
                  borderColor: active ? rgba(ACCENT.rgb, 0.45) : rgba(colors.lineRgb, 0.12),
                  color: active ? ACCENT.deep : colors.ink1,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {period === "custom" ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="rounded-2xl border px-3 py-2" style={{ borderColor: rgba(colors.lineRgb, 0.12) }}>
              <span className="block text-[10px] font-bold" style={{ color: colors.ink3 }}>
                {so.baarisDateStart}
              </span>
              <input
                type="date"
                value={customStart ? toInputDate(customStart) : ""}
                onChange={(e) => {
                  const d = parseInputDate(e.target.value);
                  setCustomStart(d);
                  setPeriod("custom");
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: colors.ink0 }}
              />
            </label>
            <label className="rounded-2xl border px-3 py-2" style={{ borderColor: rgba(colors.lineRgb, 0.12) }}>
              <span className="block text-[10px] font-bold" style={{ color: colors.ink3 }}>
                {so.baarisDateEnd}
              </span>
              <input
                type="date"
                value={customEnd ? toInputDate(customEnd) : ""}
                onChange={(e) => {
                  const d = parseInputDate(e.target.value);
                  setCustomEnd(d);
                  setPeriod("custom");
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: colors.ink0 }}
              />
            </label>
          </div>
        ) : null}

        <div className="mb-3 flex gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-2xl border px-3"
            style={{
              background: rgba(colors.surfRgb, 0.8),
              borderColor: rgba(ACCENT.rgb, 0.2),
            }}
          >
            <Search size={16} style={{ color: ACCENT.mid }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void runFetch(1, filtersRef.current);
                }
              }}
              placeholder={so.baarisSearch}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
              style={{ color: colors.ink0 }}
            />
          </div>
          <button
            type="button"
            onClick={() => setCountyOpen(true)}
            className="max-w-[38%] truncate rounded-2xl border px-3 text-xs font-semibold"
            style={{
              background: rgba(ACCENT.rgb, 0.08),
              borderColor: rgba(ACCENT.rgb, 0.28),
              color: ACCENT.deep,
            }}
          >
            {countyLabel}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: colors.ink2 }}>
            {rows.length} {so.baarisMeta} · {activePeriodLabel}
            {unseenCount > 0 ? ` · ${unseenCount} ${so.baarisStatUnseen}` : ""}
          </p>
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
                background: `linear-gradient(90deg, ${ACCENT.mid}, ${ACCENT.deep})`,
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
                  <Icon size={16} style={{ color: active ? "#fff" : colors.ink2 }} />
                </button>
              );
            })}
          </div>
        </div>

        {loading && rows.length === 0 ? (
          view === "grid" ? <SuspectGridShimmer /> : <SuspectListShimmer />
        ) : error ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.rose }}>
            {so.baarisError}
          </p>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold" style={{ color: colors.ink1 }}>
              {so.baarisEmpty}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: colors.inkMut }}>
              {so.baarisEmptySub}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {rows.map((r) => (
              <ReportGridItem key={r.id} row={r} onPress={() => onOpenProfile(r)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => (
              <ReportListItem key={r.id} row={r} onPress={() => onOpenProfile(r)} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div
            className="fixed bottom-6 right-5 z-40 flex items-center gap-3 rounded-full border px-3 py-2 shadow-lg"
            style={{
              background: rgba(colors.surfnavRgb, 0.95),
              borderColor: rgba(ACCENT.rgb, 0.25),
            }}
          >
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="disabled:opacity-40"
              style={{ color: ACCENT.mid }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold" style={{ color: ACCENT.deep }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="disabled:opacity-40"
              style={{ color: ACCENT.mid }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </div>

      {countyOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setCountyOpen(false)}
          />
          <div
            className="relative z-10 flex max-h-[70dvh] w-full max-w-lg flex-col rounded-t-3xl border sm:rounded-3xl"
            style={{
              background: `rgb(${colors.surfRgb})`,
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: rgba(colors.lineRgb, 0.1) }}>
              <h3 className="text-[15px] font-bold">{so.baarisCounty}</h3>
              <button type="button" onClick={() => setCountyOpen(false)} className="text-sm font-semibold" style={{ color: colors.ink2 }}>
                {so.cancel}
              </button>
            </div>
            <div className="border-b px-4 py-2" style={{ borderColor: rgba(colors.lineRgb, 0.08) }}>
              <div
                className="flex items-center gap-2 rounded-2xl border px-3 py-2"
                style={{ borderColor: rgba(colors.lineRgb, 0.12) }}
              >
                <Search size={16} style={{ color: colors.ink3 }} />
                <input
                  value={countySearch}
                  onChange={(e) => setCountySearch(e.target.value)}
                  placeholder={so.baarisCountySearch}
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: colors.ink0 }}
                />
              </div>
            </div>
            <div className="overflow-y-auto px-2 py-2">
              {filteredCounties.map((c) => {
                const selected = c.id === countyId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCountyId(c.id);
                      setCountyLabel(c.name);
                      setPage(1);
                      setCountyOpen(false);
                      setCountySearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm"
                    style={{
                      background: selected ? rgba(ACCENT.rgb, 0.12) : "transparent",
                      color: colors.ink0,
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
