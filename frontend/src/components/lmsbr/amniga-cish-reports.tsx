"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { fetchCounties } from "@/lib/accounts-api";
import { STALE_LIST_MS } from "@/lib/query-config";
import {
  useAmnigaDistrictTasks,
  useAmnigaUserReports,
} from "@/hooks/use-amniga";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { ShimmerBlock, ShimmerForcesTable } from "./shimmer";
import { AmnigaDistrictProfilePanel } from "./amniga-district-profile-panel";
import {
  DateRangePicker,
  formatDisplayRange,
  isoWeekBounds,
  isoWeekNumber,
  localTodayIso,
  monthBounds,
  type ReportPeriod,
} from "./amniga-daily-report-page";
import type { AccountsThemeColors } from "./accounts-shared";
import type { AmnigaNamedTotal } from "@/types/amniga";

type ThemeColors = AccountsThemeColors & {
  cardBg?: string;
  cardShadow?: string;
  panelShadow?: string;
  tableHov?: string;
  barTrack?: string;
};

const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#e6b25c", "#46c08a", "#e0655a", "#0ea5e9"];

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({
  items,
  C,
}: {
  items: { label: string; value: number; color: string; icon: string }[];
  C: ThemeColors;
}) {
  return (
    <div className="lmsbr-cols-4" style={{
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
      gap: 10,
      marginBottom: 18,
    }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: "18px 20px",
            borderRadius: 16,
            background: `linear-gradient(140deg, ${hexA(item.color, 0.1)} 0%, transparent 55%), ${C.panelBg}`,
            border: `1px solid ${hexA(item.color, 0.2)}`,
            boxShadow: `${C.panelShadow}, inset 0 0 0 1px ${hexA(item.color, 0.07)}`,
            position: "relative",
            overflow: "hidden",
            animation: `is-fadeUp .3s ${i * 0.05}s ease both`,
          }}
        >
          {/* accent bar — gradient fade */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
            background: `linear-gradient(180deg, ${item.color}, ${hexA(item.color, 0.4)})`,
            borderRadius: "16px 0 0 16px",
          }} />
          {/* top row: label + icon */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.4, letterSpacing: ".01em" }}>
              {item.label}
            </div>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: hexA(item.color, 0.14),
              border: `1px solid ${hexA(item.color, 0.25)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: item.color,
              boxShadow: `0 2px 8px ${hexA(item.color, 0.15)}`,
            }}>
              <Icon name={item.icon} size={15} sw={2} />
            </div>
          </div>
          {/* number */}
          <div style={{
            fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em",
            color: item.value > 0 ? item.color : C.txtMuted,
            fontFamily: "var(--font-cinzel)",
          }}>
            {item.value.toLocaleString()}
          </div>
          {/* underline accent */}
          {item.value > 0 && (
            <div style={{
              marginTop: 10, width: 28, height: 2.5, borderRadius: 99,
              background: `linear-gradient(90deg, ${item.color}, ${hexA(item.color, 0.3)})`,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Segment breakdown ────────────────────────────────────────────────────────

function SegmentRow({
  title,
  items,
  total,
  C,
  icon,
}: {
  title: string;
  items: AmnigaNamedTotal[];
  total: number;
  C: ThemeColors;
  icon?: string;
}) {
  if (!items.length) return null;
  const maxVal = Math.max(...items.map((i) => i.total), 1);
  return (
    <div style={{
      marginBottom: 14,
      padding: "16px 20px",
      borderRadius: 16,
      background: C.panelBg,
      border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
        {icon && (
          <span style={{ color: C.txtMuted, display: "flex" }}>
            <Icon name={icon} size={13} sw={2} />
          </span>
        )}
        <span style={{
          fontSize: 10.5, fontWeight: 800, color: C.txtMuted,
          fontFamily: "var(--font-outfit)", textTransform: "uppercase", letterSpacing: ".1em",
        }}>
          {title}
        </span>
      </div>
      {/* bar rows — 2 col layout when 4+ items */}
      <div style={{
        display: "grid",
        gridTemplateColumns: items.length >= 4 ? "1fr 1fr" : "1fr",
        gap: "12px 24px",
      }}>
        {items.map((item, i) => {
          const color  = BAR_COLORS[i % BAR_COLORS.length];
          const pct    = total > 0 ? Math.round((item.total / total) * 100) : 0;
          const barW   = Math.round((item.total / maxVal) * 100);
          return (
            <div key={item.name}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>
                    {item.total.toLocaleString()}
                  </span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700,
                    padding: "2px 6px", borderRadius: 999,
                    background: hexA(color, 0.14), color,
                    fontFamily: "var(--font-outfit)",
                    border: `1px solid ${hexA(color, 0.22)}`,
                  }}>
                    {pct}%
                  </span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.barTrack ?? C.tableSep, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${barW}%`, borderRadius: 3,
                  background: `linear-gradient(90deg, ${color}, ${hexA(color, 0.7)})`,
                  transition: "width .55s cubic-bezier(.4,0,.2,1)",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Toolbar & filter controls ────────────────────────────────────────────────

function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      flexWrap: "nowrap", overflowX: "auto",
      marginBottom: 14, paddingBottom: 2,
    }}>
      {children}
    </div>
  );
}

function SearchInput({
  value, onChange, placeholder, C,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; C: ThemeColors;
}) {
  return (
    <div style={{
      flex: "1 1 180px", minWidth: 160,
      display: "flex", alignItems: "center", gap: 8,
      padding: "9px 13px", borderRadius: 11,
      background: C.inputBg, border: `1px solid ${C.inputBdr}`,
    }}>
      <span style={{ display: "flex", color: C.txtMuted }}><Icon name="search" size={15} sw={1.8} /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "none", outline: "none", background: "transparent",
          color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 13.5, flex: 1, minWidth: 0,
        }}
      />
    </div>
  );
}

function SelectFilter({
  value, onChange, options, C, accent, isDark,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  C: ThemeColors; accent: string; isDark: boolean;
}) {
  const active = !!value;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "9px 13px", borderRadius: 11,
        border: `1px solid ${active ? hexA(accent, 0.45) : C.inputBdr}`,
        background: active ? hexA(accent, isDark ? 0.13 : 0.08) : C.inputBg,
        color: active ? accent : C.txtPrimary,
        fontFamily: "var(--font-outfit)", fontSize: 13.5, flex: "0 0 auto",
      }}
    >
      {options.map((o) => (
        <option key={o.value || "all"} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ChipButton({
  active, label, onClick, color, C,
}: {
  active: boolean; label: string; onClick: () => void; color: string; C: ThemeColors;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 16px", borderRadius: 11,
        border: `1px solid ${active ? hexA(color, 0.5) : C.inputBdr}`,
        background: active ? hexA(color, 0.16) : C.inputBg,
        color: active ? color : C.txtSecondary,
        fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap", flex: "0 0 auto",
        transition: "background .18s, color .18s, border-color .18s",
        boxShadow: active ? `0 0 0 2px ${hexA(color, 0.12)}` : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Report frame ─────────────────────────────────────────────────────────────

function ReportFrame({
  C, accent, isDark, isLoading, isFetching, children,
  page, totalPages, onPage, pageSize, onPageSize, totalLabel, t, lang,
}: {
  C: ThemeColors; accent: string; isDark: boolean;
  isLoading: boolean; isFetching: boolean; children: ReactNode;
  page: number; totalPages: number; onPage: (p: number) => void;
  pageSize: number; onPageSize: (n: number) => void;
  totalLabel: string; t: ReturnType<typeof getDict>; lang: string;
}) {
  return (
    <div style={{
      borderRadius: 16, background: C.panelBg,
      borderTop: `2px solid ${hexA(accent, 0.4)}`,
      borderRight: `1px solid ${C.cardBdr}`,
      borderBottom: `1px solid ${C.cardBdr}`,
      borderLeft: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
      overflow: "hidden",
      opacity: isFetching && !isLoading ? 0.82 : 1,
      transition: "opacity .15s",
    }}>
      {isLoading ? (
        <ShimmerForcesTable />
      ) : (
        <>
          <div style={{ padding: "12px 16px 0" }}>
            <TableRowsSelect
              pageSize={pageSize}
              onPageSizeChange={onPageSize}
              C={C}
              label={lang === "so" ? "Tiro" : "Rows"}
            />
          </div>
          <div style={{ overflowX: "auto" }}>{children}</div>
        </>
      )}
      {!isLoading && (
        <Pagination
          page={page} totalPages={totalPages} onPage={onPage}
          C={C} accent={accent} isDark={isDark} isFetching={isFetching}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          totalLabel={totalLabel}
        />
      )}
    </div>
  );
}

// ─── Table cell helpers ───────────────────────────────────────────────────────

const th = (C: ThemeColors): CSSProperties => ({
  padding: "12px 14px", textAlign: "left",
  fontSize: 11, fontWeight: 800, color: C.txtMuted,
  letterSpacing: ".08em", textTransform: "uppercase",
  whiteSpace: "nowrap", fontFamily: "var(--font-outfit)",
  background: C.tableHead,
});

const thR = (C: ThemeColors): CSSProperties => ({ ...th(C), textAlign: "right" });

const td = (C: ThemeColors, opts?: { primary?: boolean; muted?: boolean }): CSSProperties => ({
  padding: "11px 14px", fontSize: 13, whiteSpace: "nowrap",
  fontFamily: "var(--font-outfit)",
  color: opts?.primary ? C.txtPrimary : opts?.muted ? C.txtMuted : C.txtSecondary,
  fontWeight: opts?.primary ? 600 : 400,
});

const tdR = (C: ThemeColors, opts?: { primary?: boolean; muted?: boolean }): CSSProperties => ({
  ...td(C, opts), textAlign: "right",
});

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const ch = name.trim()[0]?.toUpperCase() ?? "?";
  const color = BAR_COLORS[name.charCodeAt(0) % BAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: hexA(color, 0.16),
      border: `1.5px solid ${hexA(color, 0.3)}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color, fontSize: size * 0.39, fontWeight: 800,
      fontFamily: "var(--font-outfit)", letterSpacing: "-.01em",
    }}>
      {ch}
    </div>
  );
}

const RANK_CFG: Record<number, [string, string]> = {
  1: ["rgba(230,178,92,.2)",   "#e6b25c"],
  2: ["rgba(180,190,210,.16)", "#9caabf"],
  3: ["rgba(185,120,75,.17)",  "#c87846"],
};

function RankNo({ no }: { no: number }) {
  const cfg = RANK_CFG[no];
  if (!cfg) {
    return <span style={{ fontSize: 12, color: "inherit", fontFamily: "var(--font-outfit)" }}>{no}</span>;
  }
  const [bg, color] = cfg;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: 8,
      background: bg, border: `1px solid ${hexA(color, 0.45)}`,
      fontSize: 11.5, fontWeight: 800, color,
      fontFamily: "var(--font-cinzel)",
    }}>
      {no}
    </span>
  );
}

function rowBg(C: ThemeColors, hovRow: number | null, rowId: number, rowNo: number): string | undefined {
  if (hovRow === rowId) return C.tableHov ?? "rgba(255,255,255,.04)";
  if (rowNo === 1) return "rgba(230,178,92,.03)";
  if (rowNo === 2) return "rgba(180,190,210,.025)";
  if (rowNo === 3) return "rgba(185,120,75,.025)";
  return undefined;
}

function ActiveDot({ active, label }: { active: boolean; label: string }) {
  const color = active ? "#46c08a" : "#9a8a6f";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: color,
        boxShadow: active ? "0 0 6px rgba(70,192,138,.55)" : "none",
      }} />
      <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "var(--font-outfit)" }}>
        {label}
      </span>
    </span>
  );
}

function PresentPill({ value }: { value: string }) {
  const color = value === "Joogey" ? "#46c08a" : value === "Maqan" ? "#e0655a" : "#e6b25c";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999,
      background: hexA(color, 0.13), border: `1px solid ${hexA(color, 0.28)}`,
      fontSize: 12, fontWeight: 700, color,
      fontFamily: "var(--font-outfit)",
      boxShadow: `0 1px 4px ${hexA(color, 0.12)}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {value}
    </span>
  );
}

function MobileTag({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase();
  const iconName = normalized.includes("mobile_services")
    ? "clipboard"
    : normalized === "mobile app" || normalized.includes("weapon")
      ? "target"
      : normalized.includes("survey")
        ? "clipboard"
        : "dot";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      color: "#3b82f6",
      fontFamily: "var(--font-outfit)",
    }}>
      <span style={{ display: "inline-flex", color: "#3b82f6" }}>
        <Icon name={iconName} size={13} sw={2} />
      </span>
      {value}
    </span>
  );
}

function TodayBadge({ count }: { count: number }) {
  if (!count) return <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9a8a6f30", display: "inline-block" }} />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#46c08a" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#46c08a", boxShadow: "0 0 6px rgba(70,192,138,.6)", flexShrink: 0 }} />
      {count}
    </span>
  );
}

function NumStat({ value, accent }: { value: number; accent: string }) {
  if (!value) return <span style={{ fontSize: 13, color: "#9a8a6f70", fontFamily: "var(--font-outfit)" }}>—</span>;
  return (
    <span style={{
      fontSize: 14.5, fontWeight: 800, color: accent,
      fontFamily: "var(--font-cinzel)", letterSpacing: "-.01em",
    }}>
      {value.toLocaleString()}
    </span>
  );
}

function Empty({ C, label }: { C: ThemeColors; label: string }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 14 }}>
      {label}
    </div>
  );
}

// ─── Shared hooks ─────────────────────────────────────────────────────────────

function useCounties() {
  return useQuery({
    queryKey: ["accounts", "counties"],
    queryFn: fetchCounties,
    staleTime: STALE_LIST_MS,
  });
}

function usePagerReset(deps: unknown[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  useEffect(() => { setPage(1); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { page, setPage, pageSize, setPageSize };
}

// ─── Warbixinta Isticmaalayaasha ──────────────────────────────────────────────

export function AmnigaUserReportsPage({ C, accent, isDark }: { C: ThemeColors; accent: string; isDark: boolean }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("");
  const [mode, setMode] = useState<"all" | "top" | "active">("all");
  const [hovRow, setHovRow] = useState<number | null>(null);
  const deferred = useDeferredValue(search);
  const { page, setPage, pageSize, setPageSize } = usePagerReset([deferred, county, mode]);
  const { data: counties = [] } = useCounties();
  const { data, isLoading, isFetching } = useAmnigaUserReports({
    page, pageSize, search: deferred, county,
    activeOnly: mode === "active", topUsers: mode === "top",
  });

  const rows = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const totalUsers = data?.total_users ?? 0;

  const kpis = useMemo(() => [
    { label: t.cishUsersLabel,         value: totalUsers,                                                                    color: "#3b82f6", icon: "users"  },
    { label: t.cishSuspectsRegistered, value: data?.total_suspects ?? 0,                                                     color: "#46c08a", icon: "badge"  },
    { label: t.statusActive,           value: data?.status_breakdown?.find((x) => x.name === "Active")?.total ?? 0,         color: "#46c08a", icon: "check"  },
    { label: t.cishLoggedToday,        value: data?.activity_breakdown?.find((x) => x.name === "Logged today")?.total ?? 0, color: "#e6b25c", icon: "clock"  },
  ], [data, t, totalUsers]);

  return (
    <div style={{ marginTop: 4, animation: "is-fadeUp .35s ease both" }}>
      {isLoading && !data ? (
        <div className="lmsbr-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {[0, 1, 2, 3].map((i) => <ShimmerBlock key={i} h={82} />)}
        </div>
      ) : (
        <KpiStrip items={kpis} C={C} />
      )}

      <Toolbar>
        <ChipButton active={mode === "all"}    label={t.cishAllUsers}    onClick={() => setMode("all")}     color={accent}   C={C} />
        <ChipButton active={mode === "top"}    label={t.cishTopUsers}    onClick={() => setMode("top")}     color="#46c08a"  C={C} />
        <ChipButton active={mode === "active"} label={t.cishActiveUsers} onClick={() => setMode("active")}  color="#e6b25c"  C={C} />
        <SelectFilter
          value={county} onChange={setCounty}
          options={[{ value: "", label: t.filterDistrict }, ...counties.map((c) => ({ value: String(c.id), label: c.name }))]}
          C={C} accent={accent} isDark={isDark}
        />
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchUsers} C={C} />
      </Toolbar>

      <SegmentRow title={t.cishMobileSection} icon="list" items={data?.mobile_breakdown ?? []} total={totalUsers} C={C} />

      <ReportFrame
        C={C} accent={accent} isDark={isDark}
        isLoading={isLoading && !data} isFetching={isFetching}
        page={page} totalPages={totalPages} onPage={setPage}
        pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }}
        totalLabel={`${data?.count ?? 0} · ${t.page} ${page} ${t.of} ${totalPages}`}
        t={t} lang={lang}
      >
        {rows.length === 0 ? <Empty C={C} label={t.cishNoUsers} /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ borderBottom: `1.5px solid ${C.tableSep}` }}>
                <th style={{ ...th(C), width: 44 }}>#</th>
                <th style={{ ...th(C), minWidth: 180 }}>{t.colName}</th>
                <th style={th(C)}>{t.colEmail}</th>
                <th style={th(C)}>{t.colPhone}</th>
                <th style={th(C)}>{t.colDistrict}</th>
                <th style={th(C)}>{t.cishMobileType}</th>
                <th style={th(C)}>{t.colStatus}</th>
                <th style={thR(C)}>{t.cishSuspectsCol}</th>
                <th style={thR(C)}>{t.cishLastLogin}</th>
                <th style={{ ...thR(C), textAlign: "center" }}>{t.cishTodayLogin}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onMouseEnter={() => setHovRow(row.id)}
                  onMouseLeave={() => setHovRow(null)}
                  style={{
                    borderBottom: `1px solid ${C.tableSep}`,
                    background: rowBg(C, hovRow, row.id, row.no),
                    opacity: !row.is_active ? 0.45 : 1,
                    transition: "background .12s, opacity .12s",
                  }}
                >
                  <td style={{ ...td(C, { muted: true }), textAlign: "center" }}><RankNo no={row.no} /></td>
                  <td style={{ ...td(C), padding: "9px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={row.name} />
                      <span style={{ color: C.txtPrimary, fontWeight: 600, fontSize: 13 }}>{row.name}</span>
                    </div>
                  </td>
                  <td style={td(C)}>{row.email}</td>
                  <td style={td(C)}>{row.phone || "—"}</td>
                  <td style={td(C)}>{row.county_name || "—"}</td>
                  <td style={td(C)}><MobileTag value={row.mobile_type} /></td>
                  <td style={td(C)}>
                    <ActiveDot active={row.is_active} label={row.is_active ? t.statusActive : t.statusInactive} />
                  </td>
                  <td style={tdR(C)}><NumStat value={row.suspects_registered} accent={accent} /></td>
                  <td style={tdR(C, { muted: true })}>{row.last_login ? row.last_login.slice(0, 10) : "—"}</td>
                  <td style={{ ...tdR(C), textAlign: "center" }}><TodayBadge count={row.today_login} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportFrame>
    </div>
  );
}

// ─── Shaqada Degmooyinka ──────────────────────────────────────────────────────

export function AmnigaDistrictTasksPage({
  C,
  accent,
  isDark,
  onOpenSuspect,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  onOpenSuspect?: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const today = useMemo(() => localTodayIso(), []);
  const monthStart = useMemo(() => monthBounds(new Date().getFullYear(), new Date().getMonth() + 1), []);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [rangeFrom, setRangeFrom] = useState(monthStart[0]);
  const [rangeTo, setRangeTo] = useState(monthStart[1]);
  const [search, setSearch] = useState("");
  const [hovRow, setHovRow] = useState<number | null>(null);
  const [profileDistrict, setProfileDistrict] = useState("");
  const deferred = useDeferredValue(search);
  const { page, setPage, pageSize, setPageSize } = usePagerReset([deferred, rangeFrom, rangeTo]);
  const { data, isLoading, isFetching } = useAmnigaDistrictTasks({
    page,
    pageSize,
    search: deferred,
    dateFrom: rangeFrom,
    dateTo: rangeTo,
  });

  const applyRange = (from: string, to: string, nextPeriod: ReportPeriod = "range") => {
    let start = from || today;
    let end = to || today;
    if (end < start) [start, end] = [end, start];
    setPeriod(nextPeriod);
    setRangeFrom(start);
    setRangeTo(end);
    setPage(1);
  };

  const applyPeriod = (next: ReportPeriod) => {
    const now = new Date();
    if (next === "weekly") {
      const [from, to] = isoWeekBounds(now.getFullYear(), isoWeekNumber(now));
      applyRange(from, to, "weekly");
      return;
    }
    if (next === "monthly") {
      applyRange(...monthBounds(now.getFullYear(), now.getMonth() + 1), "monthly");
      return;
    }
    applyRange(today, today, "daily");
  };

  const rows        = data?.results ?? [];
  const totalPages  = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const maxSuspects = Math.max(...rows.map((r) => r.suspects), 1);
  const periodLabel = formatDisplayRange(data?.date_from || rangeFrom, data?.date_to || rangeTo, so);

  const kpis = useMemo(() => [
    { label: t.colDistrict,            value: data?.count          ?? 0, color: "#3b82f6", icon: "map"   },
    { label: t.cishTotalUsers,         value: data?.total_users    ?? 0, color: "#e6b25c", icon: "users" },
    { label: t.statusActive,           value: data?.active_users   ?? 0, color: "#46c08a", icon: "check" },
    { label: t.cishSuspectsRegistered, value: data?.total_suspects ?? 0, color: "#e0655a", icon: "badge" },
  ], [data, t]);

  if (profileDistrict) {
    return (
      <AmnigaDistrictProfilePanel
        district={profileDistrict}
        dateFrom={rangeFrom}
        dateTo={rangeTo}
        periodLabel={periodLabel}
        C={C as never}
        accent={accent}
        isDark={isDark}
        onBack={() => setProfileDistrict("")}
        onOpenSuspect={(id) => onOpenSuspect?.(id)}
      />
    );
  }

  return (
    <div style={{ marginTop: 4, animation: "is-fadeUp .35s ease both" }}>
      {isLoading && !data ? (
        <div className="lmsbr-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {[0, 1, 2, 3].map((i) => <ShimmerBlock key={i} h={82} />)}
        </div>
      ) : (
        <KpiStrip items={kpis} C={C} />
      )}

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "flex-end",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            ["daily", t.dailyReportPeriodDaily],
            ["weekly", t.dailyReportPeriodWeekly],
            ["monthly", t.dailyReportPeriodMonthly],
          ] as const).map(([key, label]) => {
            const active = period === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPeriod(key)}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1px solid ${active ? accent : C.inputBdr}`,
                  background: active ? hexA(accent, isDark ? 0.22 : 0.16) : C.inputBg,
                  color: active ? (isDark ? accent : "#92400e") : C.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <DateRangePicker
          from={rangeFrom}
          to={rangeTo}
          onChange={(from, to) => applyRange(from, to, "range")}
          C={C as never}
          accent={accent}
          isDark={isDark}
          so={so}
        />
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPh} C={C} />
        <div style={{ fontSize: 12.5, color: C.txtMuted, fontFamily: "var(--font-outfit)", paddingBottom: 10 }}>
          {t.dailyReportDateLabel}: {periodLabel}
        </div>
      </div>

      <ReportFrame
        C={C} accent={accent} isDark={isDark}
        isLoading={isLoading && !data} isFetching={isFetching}
        page={page} totalPages={totalPages} onPage={setPage}
        pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }}
        totalLabel={`${data?.count ?? 0} · ${t.page} ${page} ${t.of} ${totalPages}`}
        t={t} lang={lang}
      >
        {rows.length === 0 ? <Empty C={C} label={t.cishNoDistricts} /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ borderBottom: `1.5px solid ${C.tableSep}` }}>
                <th style={{ ...th(C), width: 44 }}>#</th>
                <th style={{ ...th(C), minWidth: 160 }}>{t.colName}</th>
                <th style={thR(C)}>{t.cishSuspectsCol}</th>
                <th style={thR(C)}>{t.dailyReportShare}</th>
                <th style={thR(C)}>{t.cishActiveUsers}</th>
                <th style={thR(C)}>{t.cishInactiveUsers}</th>
                <th style={thR(C)}>{t.cishTotalUsers}</th>
                <th style={{ ...th(C), width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const barW = Math.round((row.suspects / maxSuspects) * 100);
                return (
                  <tr
                    key={row.id}
                    onMouseEnter={() => setHovRow(row.id)}
                    onMouseLeave={() => setHovRow(null)}
                    onClick={() => setProfileDistrict(row.name)}
                    style={{
                      borderBottom: `1px solid ${C.tableSep}`,
                      background: rowBg(C, hovRow, row.id, row.no),
                      transition: "background .12s",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ ...td(C, { muted: true }), textAlign: "center" }}><RankNo no={row.no} /></td>
                    <td style={{ ...td(C, { primary: true }), fontSize: 13.5 }}>
                      <div>{row.name}</div>
                      {row.region ? (
                        <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{row.region}</div>
                      ) : null}
                    </td>
                    <td style={tdR(C)}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <NumStat value={row.suspects} accent={accent} />
                        <div style={{ width: 80, height: 4, borderRadius: 2, background: C.barTrack ?? C.tableSep, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${barW}%`, borderRadius: 2,
                            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.6)})`,
                            transition: "width .55s ease",
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={tdR(C)}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>
                        {(row.share_pct ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td style={tdR(C)}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#46c08a", fontFamily: "var(--font-outfit)" }}>
                        {row.active_users.toLocaleString()}
                      </span>
                    </td>
                    <td style={tdR(C)}>
                      <span style={{
                        fontSize: 13, fontFamily: "var(--font-outfit)",
                        fontWeight: row.inactive_users > 0 ? 600 : 400,
                        color: row.inactive_users > 0 ? "#9a8a6f" : C.txtMuted,
                      }}>
                        {row.inactive_users.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdR(C, { primary: true }), fontSize: 13.5 }}>
                      {row.total_users.toLocaleString()}
                    </td>
                    <td style={td(C)}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 9,
                        border: `1px solid ${hexA(accent, 0.35)}`,
                        background: hexA(accent, isDark ? 0.14 : 0.12),
                        color: isDark ? accent : "#92400e",
                        fontSize: 12.5,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>
                        {t.dailyReportOpenProfile}
                        <Icon name="arrow" size={13} sw={2.1} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ReportFrame>
    </div>
  );
}
