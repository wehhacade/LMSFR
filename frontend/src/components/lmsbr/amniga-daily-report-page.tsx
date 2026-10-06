"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { statusLabel, tuhunkaColor, tuhunkaLabel } from "@/lib/lmsbr/suspect-utils";
import { Icon } from "./icon";
import { useAmnigaDailyReport } from "@/hooks/use-amniga";
import { useCounties } from "@/hooks/use-accounts";
import { ShimmerBlock } from "./shimmer";
import { AmnigaDistrictBarChart, type AmnigaChartTheme } from "./amniga-charts";
import { AmnigaDistrictProfilePanel } from "./amniga-district-profile-panel";
import type { AccountsThemeColors } from "./accounts-shared";
import type { AmnigaDistrictActivityRow } from "@/types/amniga";
import type { SuspectStatus } from "@/types/suspect";

type ThemeColors = AccountsThemeColors & {
  cardBg: string;
  cardBdr: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  tableHead: string;
  tableHov: string;
  txtMuted: string;
  txtSecondary: string;
  txtPrimary: string;
  inputBg: string;
  inputBdr: string;
  inputFocusBdr: string;
  barTrack?: string;
};

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SO = [
  "Janaayo", "Febraayo", "Maarso", "Abriil", "May", "Juun",
  "Luuliyo", "Agoosto", "Sebtembar", "Oktoobar", "Nofembar", "Disembar",
];

const RANK_COLORS = ["#e6b25c", "#94a3b8", "#c2783b"];

export type ReportPeriod = "daily" | "weekly" | "monthly" | "range";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function isoWeekBounds(year: number, week: number): [string, string] {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return [fmt(monday), fmt(sunday)];
}

export function monthBounds(year: number, month: number): [string, string] {
  return [`${year}-${pad2(month)}-01`, `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`];
}

function isRealCountyName(name: string) {
  const n = (name || "").trim();
  if (n.length < 2) return false;
  if (/^[\d\-./\s]+$/.test(n)) return false;
  return /[A-Za-zÀ-ÿ]/.test(n);
}

export function localTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatDisplayDate(iso: string, so: boolean) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = so ? MONTHS_SO : MONTHS_EN;
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

export function formatDisplayRange(from: string, to: string, so: boolean) {
  if (!from) return "";
  if (!to || from === to) return formatDisplayDate(from, so);
  return `${formatDisplayDate(from, so)} – ${formatDisplayDate(to, so)}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function Panel({
  title,
  subtitle,
  children,
  C,
  accent,
  isDark,
  action,
  bodyStyle,
  style,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  action?: ReactNode;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
}) {
  return (
    <div style={{
      borderRadius: 14,
      overflow: "hidden",
      background: C.panelBg,
      border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      ...style,
    }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${C.tableSep}`,
        background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 15.5, color: C.txtPrimary }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)" }}>
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      <div style={{ padding: "18px 20px", flex: 1, ...bodyStyle }}>{children}</div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank - 1];
  if (color) {
    return (
      <span style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hexA(color, 0.18),
        color,
        border: `1px solid ${hexA(color, 0.35)}`,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-outfit)",
      }}>
        {rank}
      </span>
    );
  }
  return (
    <span style={{
      width: 26,
      height: 26,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 600,
      color: "#94a3b8",
      fontFamily: "var(--font-outfit)",
    }}>
      {rank}
    </span>
  );
}

function DistrictActivityRow({
  row,
  rank,
  maxSuspects,
  C,
  accent,
  isDark,
  openLabel,
  onOpen,
}: {
  row: AmnigaDistrictActivityRow;
  rank: number;
  maxSuspects: number;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  openLabel: string;
  onOpen: () => void;
}) {
  const barW = Math.round((row.suspects / maxSuspects) * 100);
  return (
    <tr
      style={{ borderTop: `1px solid ${C.tableSep}`, cursor: "pointer" }}
      onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <td style={tdStyle(C)}><RankBadge rank={rank} /></td>
      <td style={tdStyle(C)}>
        <div style={{ fontWeight: 600, color: C.txtPrimary }}>{row.name}</div>
        {row.region && (
          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{row.region}</div>
        )}
      </td>
      <td style={{ ...tdStyle(C), textAlign: "right" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 90 }}>
          <span style={{ fontWeight: 700, color: C.txtPrimary }}>{row.suspects.toLocaleString()}</span>
          <div style={{ width: 90, height: 5, borderRadius: 999, background: C.barTrack ?? C.tableSep, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${barW}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.55)})`,
            }} />
          </div>
        </div>
      </td>
      <td style={{ ...tdStyle(C), textAlign: "right", fontWeight: 600, color: C.txtPrimary }}>
        {row.share_pct}%
      </td>
      <td style={{ ...tdStyle(C), textAlign: "right", fontWeight: 700, color: "#46c08a" }}>
        {row.active_users.toLocaleString()}
      </td>
      <td style={tdStyle(C)}>
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
          {openLabel}
          <Icon name="arrow" size={13} sw={2.1} />
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ label, C }: { label: string; C: ThemeColors }) {
  return (
    <div style={{
      padding: "28px 12px",
      textAlign: "center",
      color: C.txtMuted,
      fontSize: 13.5,
      fontFamily: "var(--font-outfit)",
    }}>
      {label}
    </div>
  );
}

function thStyle(C: ThemeColors): CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 8px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: ".07em",
    textTransform: "uppercase",
    color: C.txtMuted,
    fontFamily: "var(--font-outfit)",
  };
}

function tdStyle(C: ThemeColors): CSSProperties {
  return {
    padding: "12px 8px",
    fontSize: 13.5,
    color: C.txtSecondary,
    fontFamily: "var(--font-outfit)",
    verticalAlign: "middle",
  };
}

function selectStyle(C: ThemeColors, isDark: boolean): CSSProperties {
  return {
    appearance: "none",
    WebkitAppearance: "none",
    padding: "10px 34px 10px 12px",
    borderRadius: 10,
    border: `1px solid ${C.inputBdr}`,
    backgroundColor: C.inputBg,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isDark ? "%23a8a29e" : "%2378716c"}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    backgroundSize: "12px 12px",
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: 13.5,
    minWidth: 120,
    cursor: "pointer",
  };
}

export function AmnigaDailyReportPage({
  C,
  accent,
  isDark,
  moduleName,
  onOpenSuspect,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName?: string;
  onOpenSuspect: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";

  const today = useMemo(() => localTodayIso(), []);
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [district, setDistrict] = useState("");
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [appliedDistrict, setAppliedDistrict] = useState("");
  const [profileDistrict, setProfileDistrict] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");

  const { data: countyRows = [] } = useCounties();
  const counties = useMemo(() => {
    const names = countyRows
      .map((c) => (c.name || "").trim())
      .filter(isRealCountyName);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [countyRows]);
  const { data, isLoading, isFetching } = useAmnigaDailyReport(appliedFrom, appliedDistrict, appliedTo);

  const applyRange = (from: string, to: string, nextPeriod: ReportPeriod = period) => {
    let start = from || today;
    let end = to || today;
    if (end < start) [start, end] = [end, start];
    setPeriod(nextPeriod);
    setRangeFrom(start);
    setRangeTo(end);
    setAppliedFrom(start);
    setAppliedTo(end);
    setAppliedDistrict(district);
  };

  const applyPeriod = (next: ReportPeriod) => {
    const now = new Date();
    if (next === "weekly") {
      const [from, to] = isoWeekBounds(now.getFullYear(), isoWeekNumber(now));
      applyRange(from, to, "weekly");
      return;
    }
    if (next === "monthly") {
      const [from, to] = monthBounds(now.getFullYear(), now.getMonth() + 1);
      applyRange(from, to, "monthly");
      return;
    }
    applyRange(today, today, "daily");
  };

  const applyReport = () => {
    applyRange(rangeFrom, rangeTo, period === "range" ? "range" : period);
  };

  const summary = data?.summary;
  const activityRows = data?.district_activity ?? [];
  const filteredActivity = useMemo(() => {
    const q = districtQuery.trim().toLowerCase();
    if (!q) return activityRows;
    return activityRows.filter((row) =>
      row.name.toLowerCase().includes(q) || row.region.toLowerCase().includes(q)
    );
  }, [activityRows, districtQuery]);
  const chartTheme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack ?? C.tableSep,
  };
  const kpis = [
    {
      label: t.dailyReportSuspectsRegistered,
      value: summary?.suspects_registered ?? 0,
      icon: "badge" as const,
      color: "#7c6cf0",
    },
    {
      label: t.dailyReportDamiinCreated,
      value: summary?.damiin_created ?? 0,
      icon: "users" as const,
      color: "#46c08a",
    },
    {
      label: t.dailyReportCaptureDistricts,
      value: summary?.capture_districts ?? 0,
      icon: "map" as const,
      color: "#5b9fd4",
    },
  ];

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
        marginBottom: 18,
      }}>
        <div>
          {moduleName && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: accent,
                boxShadow: isDark ? `0 0 12px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
              }} />
              <span style={{
                fontSize: 11.5, letterSpacing: ".18em", textTransform: "uppercase",
                color: isDark ? accent : "#c69049", fontWeight: 600,
              }}>
                {moduleName}
              </span>
            </div>
          )}
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-cinzel)",
            fontWeight: 600,
            fontSize: "clamp(24px, 3.2vw, 34px)",
            color: C.txtPrimary,
            letterSpacing: ".01em",
          }}>
            {t.dailyReportTitle}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: C.txtMuted, maxWidth: 520, lineHeight: 1.5 }}>
            {t.dailyReportSub}
          </p>
        </div>
        <div style={{
          fontFamily: "var(--font-outfit)",
          fontSize: 13.5,
          fontWeight: 600,
          color: C.txtSecondary,
        }}>
          {t.dailyReportDateLabel}: {formatDisplayRange(appliedFrom, appliedTo, so)}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "flex-end",
        padding: "16px 18px",
        borderRadius: 14,
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
        marginBottom: 16,
      }}>
        <FilterField label={t.dailyReportPeriod} C={C}>
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
                    height: 42,
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
        </FilterField>
        <FilterField label={t.dailyReportDates} C={C}>
          <DateRangePicker
            from={rangeFrom}
            to={rangeTo}
            onChange={(from, to) => applyRange(from, to, "range")}
            C={C}
            accent={accent}
            isDark={isDark}
            so={so}
          />
        </FilterField>
        <FilterField label={t.dailyReportDistrict} C={C}>
          <select
            value={district}
            onChange={(e) => {
              const next = e.target.value;
              setDistrict(next);
              setAppliedDistrict(next);
            }}
            style={{ ...selectStyle(C, isDark), minWidth: 180 }}
          >
            <option value="">{t.dailyReportAllDistricts}</option>
            {counties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </FilterField>
        <button
          type="button"
          onClick={applyReport}
          disabled={isFetching}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 18px",
            borderRadius: 11,
            border: "none",
            cursor: isFetching ? "wait" : "pointer",
            background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.75)})`,
            color: "#1c1917",
            fontFamily: "var(--font-outfit)",
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: `0 8px 20px -10px ${hexA(accent, 0.7)}`,
            opacity: isFetching ? 0.75 : 1,
          }}
        >
          <Icon name="search" size={15} sw={2.2} />
          {t.dailyReportShow}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "20px 18px",
              borderRadius: 14,
              background: C.cardBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow,
            }}
          >
            {!isDark && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${kpi.color}, ${hexA(kpi.color, 0.35)})`,
              }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(kpi.color, isDark ? 0.16 : 0.12),
                color: kpi.color,
                border: `1px solid ${hexA(kpi.color, 0.25)}`,
              }}>
                <Icon name={kpi.icon} size={20} sw={1.8} />
              </div>
            </div>
            {isLoading ? (
              <div style={{ marginTop: 14 }}><ShimmerBlock h={34} w="40%" /></div>
            ) : (
              <div style={{
                marginTop: 14,
                fontFamily: "var(--font-cinzel)",
                fontWeight: 700,
                fontSize: 32,
                color: kpi.color,
                lineHeight: 1,
              }}>
                {kpi.value.toLocaleString()}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {profileDistrict ? (
        <AmnigaDistrictProfilePanel
          district={profileDistrict}
          dateFrom={appliedFrom}
          dateTo={appliedTo}
          periodLabel={formatDisplayRange(appliedFrom, appliedTo, so)}
          C={C}
          accent={accent}
          isDark={isDark}
          onBack={() => setProfileDistrict("")}
          onOpenSuspect={onOpenSuspect}
        />
      ) : (
      <>
      {/* District activity */}
      <Panel
        title={t.dailyReportDistrictActivity}
        subtitle={t.dailyReportDistrictActivitySub}
        C={C}
        accent={accent}
        isDark={isDark}
        style={{ overflow: "visible" }}
        bodyStyle={{ overflow: "visible", paddingBottom: 28 }}
        action={(
          <input
            value={districtQuery}
            onChange={(e) => setDistrictQuery(e.target.value)}
            placeholder={t.dailyReportSearchDistrict}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: `1px solid ${C.inputBdr}`,
              backgroundColor: C.inputBg,
              color: C.txtPrimary,
              fontFamily: "var(--font-outfit)",
              fontSize: 13,
              minWidth: 180,
            }}
          />
        )}
      >
        {isLoading ? <ShimmerBlock h={240} /> : !filteredActivity.length ? (
          <EmptyState label={t.dailyReportNoData} C={C} />
        ) : (
          <div>
            <AmnigaDistrictBarChart
              data={filteredActivity.slice(0, 14).map((row) => ({ name: row.name, suspects: row.suspects }))}
              theme={chartTheme}
              emptyLabel={t.dailyReportNoData}
              onSelect={setProfileDistrict}
            />
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={thStyle(C)}>#</th>
                    <th style={thStyle(C)}>{t.dailyReportColDistrict}</th>
                    <th style={{ ...thStyle(C), textAlign: "right" }}>{t.dailyReportColCount}</th>
                    <th style={{ ...thStyle(C), textAlign: "right" }}>{t.dailyReportShare}</th>
                    <th style={{ ...thStyle(C), textAlign: "right" }}>{t.dailyReportActiveOfficers}</th>
                    <th style={thStyle(C)} />
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((row, i) => (
                    <DistrictActivityRow
                      key={row.id || row.name}
                      row={row}
                      rank={i + 1}
                      maxSuspects={Math.max(...filteredActivity.map((r) => r.suspects), 1)}
                      C={C}
                      accent={accent}
                      isDark={isDark}
                      openLabel={t.dailyReportOpenProfile}
                      onOpen={() => setProfileDistrict(row.name)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {/* Registrars + comments */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14, marginTop: 14 }}>
        <Panel title={t.dailyReportTopRegistrars} subtitle={t.dailyReportTopRegistrarsSub} C={C} accent={accent} isDark={isDark} bodyStyle={{ padding: "8px 14px 14px" }}>
          {isLoading ? <ShimmerBlock h={180} /> : !(data?.top_registrars.length) ? (
            <EmptyState label={t.dailyReportNoData} C={C} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
                <thead>
                  <tr>
                    <th style={thStyle(C)}>#</th>
                    <th style={thStyle(C)}>{t.dailyReportColName}</th>
                    <th style={{ ...thStyle(C), textAlign: "right" }}>{t.dailyReportColCount}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_registrars.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{ borderTop: `1px solid ${C.tableSep}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={tdStyle(C)}><RankBadge rank={i + 1} /></td>
                      <td style={tdStyle(C)}>
                        <div style={{ fontWeight: 600, color: C.txtPrimary }}>{row.name}</div>
                        {row.phone && (
                          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{row.phone}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle(C), textAlign: "right", fontWeight: 700, color: C.txtPrimary }}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={t.dailyReportLatestComments} C={C} accent={accent} isDark={isDark}>
          {isLoading ? <ShimmerBlock h={180} /> : !(data?.latest_comments.length) ? (
            <EmptyState label={t.dailyReportNoComments} C={C} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.latest_comments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenSuspect(item.suspect_id)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${C.cardBdr}`,
                    background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: C.txtPrimary }}>{item.author_name}</span>
                    <span style={{ fontSize: 11.5, color: C.txtMuted }}>{formatTime(item.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.txtSecondary, lineHeight: 1.45 }}>
                    {(item.body || "").slice(0, 140)}{(item.body || "").length > 140 ? "…" : ""}
                  </div>
                  {item.suspect_name && (
                    <div style={{ marginTop: 6, fontSize: 12, color: accent, fontWeight: 600 }}>
                      {item.suspect_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Responses */}
      <div style={{ marginBottom: 14 }}>
        <Panel title={t.dailyReportLatestResponses} C={C} accent={accent} isDark={isDark}>
          {isLoading ? <ShimmerBlock h={100} /> : !(data?.latest_responses.length) ? (
            <EmptyState label={t.dailyReportNoResponses} C={C} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {data.latest_responses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenSuspect(item.suspect_id)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${C.cardBdr}`,
                    background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: C.txtPrimary }}>{item.author_name}</span>
                    <span style={{ fontSize: 11.5, color: C.txtMuted }}>{formatTime(item.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.txtSecondary, lineHeight: 1.45 }}>
                    {(item.details || "").slice(0, 140)}{(item.details || "").length > 140 ? "…" : ""}
                  </div>
                  {item.suspect_name && (
                    <div style={{ marginTop: 6, fontSize: 12, color: accent, fontWeight: 600 }}>
                      {item.suspect_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Repeat offenders */}
      <Panel
        title={t.dailyReportRepeatOffenders}
        subtitle={t.dailyReportRepeatOffendersSub}
        C={C}
        accent={accent}
        isDark={isDark}
        bodyStyle={{ padding: 0 }}
      >
        {isLoading ? (
          <div style={{ padding: 20 }}><ShimmerBlock h={200} /></div>
        ) : !(data?.repeat_offenders.length) ? (
          <EmptyState label={t.dailyReportNoData} C={C} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: C.tableHead }}>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>#</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>{t.dailyReportColName}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>{t.dailyReportColMother}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>{t.dailyReportColPhone}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>{t.dailyReportColDistrict}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }}>{t.dailyReportColStatus}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px", textAlign: "right" }}>{t.dailyReportColCases}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px", textAlign: "right" }}>{t.dailyReportColBail}</th>
                  <th style={{ ...thStyle(C), padding: "12px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {data.repeat_offenders.map((row, i) => {
                  const statusText = row.tuhunka
                    ? tuhunkaLabel(row.tuhunka, t)
                    : statusLabel(row.status as SuspectStatus, t) || row.status;
                  const color = row.tuhunka
                    ? tuhunkaColor(row.tuhunka)
                    : row.status === "detained" ? "#8b5cf6"
                      : row.status === "watching" ? "#e6b25c"
                        : row.status === "cleared" ? "#46c08a"
                          : "#e0655a";
                  return (
                    <tr
                      key={row.id}
                      style={{ borderTop: `1px solid ${C.tableSep}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>{i + 1}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px", fontWeight: 600, color: C.txtPrimary }}>{row.name}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>{row.mother_name || "—"}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>{row.phone || "—"}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>{row.district || "—"}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          color,
                          background: hexA(color, 0.12),
                          border: `1px solid ${hexA(color, 0.24)}`,
                        }}>
                          {statusText}
                        </span>
                      </td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px", textAlign: "right", fontWeight: 700, color: C.txtPrimary }}>{row.case_count}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px", textAlign: "right" }}>{row.bail_count}</td>
                      <td style={{ ...tdStyle(C), padding: "14px 16px" }}>
                        <button
                          type="button"
                          onClick={() => onOpenSuspect(row.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 12px",
                            borderRadius: 9,
                            border: `1px solid ${hexA(accent, 0.35)}`,
                            background: hexA(accent, isDark ? 0.14 : 0.12),
                            color: isDark ? accent : "#92400e",
                            fontFamily: "var(--font-outfit)",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {t.dailyReportProfile}
                          <Icon name="arrow" size={13} sw={2.1} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      </>
      )}
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onChange,
  C,
  accent,
  isDark,
  so,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  so: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number((from || localTodayIso()).slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number((from || localTodayIso()).slice(5, 7)));
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const months = so ? MONTHS_SO : MONTHS_EN;
  const weekdays = so
    ? ["Is", "Tl", "Ar", "Kh", "Ji", "Sb", "Ax"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  useEffect(() => {
    if (!open) return;
    const [y, m] = (from || localTodayIso()).split("-").map(Number);
    if (y) setViewYear(y);
    if (m) setViewMonth(m);
    setDraftStart(null);
    setHoverDay(null);
  }, [open, from]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraftStart(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const count = daysInMonth(viewYear, viewMonth);
    const out: Array<string | null> = [];
    for (let i = 0; i < startWeekday; i += 1) out.push(null);
    for (let d = 1; d <= count; d += 1) out.push(`${viewYear}-${pad2(viewMonth)}-${pad2(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  const previewStart = draftStart || from;
  const previewEnd = draftStart ? (hoverDay || draftStart) : to;
  const rangeStart = previewStart && previewEnd && previewEnd < previewStart ? previewEnd : previewStart;
  const rangeEnd = previewStart && previewEnd && previewEnd < previewStart ? previewStart : previewEnd;

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const pick = (iso: string) => {
    if (!draftStart) {
      setDraftStart(iso);
      setHoverDay(iso);
      return;
    }
    let start = draftStart;
    let end = iso;
    if (end < start) [start, end] = [end, start];
    onChange(start, end);
    setDraftStart(null);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 240,
          height: 42,
          padding: "0 12px",
          borderRadius: 10,
          border: `1px solid ${open ? accent : C.inputBdr}`,
          background: C.inputBg,
          color: C.txtPrimary,
          fontFamily: "var(--font-outfit)",
          fontSize: 13.5,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name="calendar" size={15} sw={2} />
        <span>{formatDisplayRange(from, to, so) || "—"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          zIndex: 40,
          width: 292,
          padding: 12,
          borderRadius: 14,
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={() => shiftMonth(-1)} style={calNavBtn(C)}>‹</button>
            <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 700, fontSize: 13.5, color: C.txtPrimary }}>
              {months[viewMonth - 1]} {viewYear}
            </div>
            <button type="button" onClick={() => shiftMonth(1)} style={calNavBtn(C)}>›</button>
          </div>
          <div className="lmsbr-cols-7" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {weekdays.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.txtMuted, fontWeight: 600, padding: "4px 0" }}>
                {d}
              </div>
            ))}
            {cells.map((iso, idx) => {
              if (!iso) return <div key={`e-${idx}`} />;
              const inRange = Boolean(rangeStart && rangeEnd && iso >= rangeStart && iso <= rangeEnd);
              const isStart = iso === rangeStart;
              const isEnd = iso === rangeEnd;
              const isToday = iso === localTodayIso();
              const selected = isStart || isEnd;
              return (
                <button
                  key={iso}
                  type="button"
                  onMouseEnter={() => setHoverDay(iso)}
                  onClick={() => pick(iso)}
                  style={{
                    height: 34,
                    borderRadius: selected ? 9 : inRange ? 0 : 9,
                    border: selected ? `1px solid ${accent}` : "1px solid transparent",
                    background: selected
                      ? hexA(accent, isDark ? 0.28 : 0.22)
                      : inRange
                        ? hexA(accent, isDark ? 0.12 : 0.1)
                        : "transparent",
                    color: selected ? (isDark ? accent : "#92400e") : C.txtPrimary,
                    fontFamily: "var(--font-outfit)",
                    fontSize: 13,
                    fontWeight: selected || isToday ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: isToday && !selected ? `inset 0 0 0 1px ${hexA(accent, 0.45)}` : "none",
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 6, fontFamily: "var(--font-outfit)" }}>
            {so ? "Dooro bilowga, kadib dhamaadka." : "Pick a start date, then an end date."}
          </div>
        </div>
      )}
    </div>
  );
}

function calNavBtn(C: ThemeColors): CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${C.cardBdr}`,
    background: C.inputBg ?? "transparent",
    color: C.txtPrimary,
    cursor: "pointer",
    fontSize: 16,
  };
}

function FilterField({
  label,
  C,
  children,
}: {
  label: string;
  C: ThemeColors;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: C.txtMuted,
        fontFamily: "var(--font-outfit)",
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}
