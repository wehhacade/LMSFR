"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLang } from "../lang-ctx";
import { useTheme } from "../theme-ctx";
import { PrimaryButton, SecondaryButton, TextInput } from "../accounts-shared";
import { useCounties, useQeybs } from "@/hooks/use-accounts";
import { useAgentStatuses, useExportReport, usePersonnelReport } from "@/hooks/use-personnel";
import { ShimmerBlock } from "../shimmer";
import { Icon } from "../icon";
import { hexA } from "@/lib/lmsbr/data";
import { fmtNum } from "@/hooks/use-kpi-counter";
import { DateRangePicker, localTodayIso, monthBounds } from "../amniga-daily-report-page";
import type { PersonnelPageProps } from "./personnel-page-props";

const REPORT_TYPES = [
  { id: "agents", labelEn: "Agents", labelSo: "Ciidanka", icon: "users" },
  { id: "attendance", labelEn: "Attendance", labelSo: "Imaanshaha", icon: "calendar" },
  { id: "transfers", labelEn: "Transfers", labelSo: "Wareejinta", icon: "send" },
  { id: "restrictions", labelEn: "Restrictions", labelSo: "Xayiraadaha", icon: "lock" },
  { id: "district-summary", labelEn: "District Summary", labelSo: "Kooban Degmooyinka", icon: "map" },
  { id: "section-summary", labelEn: "Section Summary", labelSo: "Kooban Qaybaha", icon: "folder" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["id"];

const PAGE_SIZE = 50;

const COLUMN_LABELS: Record<string, { en: string; so: string }> = {
  service_id: { en: "Service ID", so: "Lambarka" },
  name: { en: "Name", so: "Magac" },
  phone: { en: "Phone", so: "Telefoon" },
  county_name: { en: "District", so: "Degmo" },
  district_name: { en: "District", so: "Degmo" },
  department_name: { en: "Section", so: "Qayb" },
  section_name: { en: "Section", so: "Qayb" },
  status: { en: "Status", so: "Xaalad" },
  presence: { en: "Presence", so: "Joogitaan" },
  position: { en: "Position", so: "Jagada" },
  weapon: { en: "Weapon", so: "Hubka" },
  date: { en: "Date", so: "Taariikh" },
  from_county: { en: "From district", so: "Degmada laga" },
  to_county: { en: "To district", so: "Degmada loo" },
  reason: { en: "Reason", so: "Sabab" },
  total_agents: { en: "Total agents", so: "Wadarta ciidanka" },
  present: { en: "Present", so: "Joogay" },
  absent: { en: "Absent", so: "Maqan" },
  lama_haayo: { en: "Not found", so: "Lama haayo" },
  fakad: { en: "Absconded", so: "Fakad" },
  dhaawac: { en: "Injured", so: "Dhaawac" },
  la_xiray: { en: "Arrested", so: "La xiray" },
  fasax: { en: "Leave", so: "Fasax" },
  badal: { en: "Transferred", so: "Badal" },
  other: { en: "Other", so: "Kale" },
  total: { en: "Total", so: "Wadar" },
  district: { en: "District", so: "Degmo" },
  session: { en: "Session", so: "Fadhiga" },
  absence_reason: { en: "Absence reason", so: "Sababta maqnaanshaha" },
  recorded_at: { en: "Recorded at", so: "La diiwaangeliyay" },
  notes: { en: "Notes", so: "Qoraal" },
};

type AttendanceView = "detail" | "district";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function weekStartIso(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { id: "today", days: 0, labelEn: "Today", labelSo: "Maanta" },
  { id: "week", labelEn: "This week", labelSo: "Usbuucan", from: weekStartIso },
  { id: "month", labelEn: "This month", labelSo: "Bishan", from: () => monthBounds(new Date().getFullYear(), new Date().getMonth() + 1)[0] },
  { id: "7d", labelEn: "Last 7 days", labelSo: "7 maalmood", from: () => isoDaysAgo(6) },
  { id: "30d", labelEn: "Last 30 days", labelSo: "30 maalmood", from: () => isoDaysAgo(29) },
] as const;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#46c08a",
  active: "#46c08a",
  Joogey: "#46c08a",
  Present: "#46c08a",
  RELEASED: "#94a3b8",
  ABSENT: "#e0655a",
  Maqan: "#e0655a",
  TRANSFERRED: "#5b9fd4",
  ON_LEAVE: "#e0a84a",
  INJURED: "#b8860b",
  ARRESTED: "#8b5cf6",
};

function formatHeader(key: string, so: boolean) {
  const mapped = COLUMN_LABELS[key];
  if (mapped) return so ? mapped.so : mapped.en;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cellValue(row: Record<string, unknown>, col: string): string {
  const v = row[col];
  if (v == null || v === "") return "—";
  if (typeof v === "number") return fmtNum(v);
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function StatusBadge({ value, C }: { value: string; C: PersonnelPageProps["C"] }) {
  const color = STATUS_COLORS[value] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "4px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      color,
      background: hexA(color, 0.12),
      border: `1px solid ${hexA(color, 0.28)}`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {value}
    </span>
  );
}

function KpiStrip({
  total,
  showing,
  page,
  totalPages,
  accent,
  C,
  so,
}: {
  total: number;
  showing: number;
  page: number;
  totalPages: number;
  accent: string;
  C: PersonnelPageProps["C"];
  so: boolean;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 10,
      marginBottom: 14,
    }}>
      {[
        { label: so ? "Wadarta safafka" : "Total rows", value: total, color: accent },
        { label: so ? "Muuqda hadda" : "Showing now", value: showing, color: "#3b82f6" },
        { label: so ? "Bogga" : "Page", value: `${page} / ${totalPages}`, color: "#8b5cf6", text: true },
      ].map((item) => (
        <div key={item.label} style={{
          padding: "14px 16px",
          borderRadius: 14,
          border: `1px solid ${hexA(item.color, 0.22)}`,
          background: `linear-gradient(135deg, ${hexA(item.color, 0.08)} 0%, ${C.cardBg} 100%)`,
          boxShadow: C.cardShadow,
        }}>
          <div style={{ fontSize: 11, color: C.txtMuted, marginBottom: 6, fontFamily: "var(--font-outfit)" }}>{item.label}</div>
          <div style={{
            fontSize: item.text ? 18 : 26,
            fontWeight: 800,
            color: item.color,
            fontFamily: "var(--font-cinzel)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {item.text ? item.value : fmtNum(Number(item.value))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterField({
  label,
  children,
  C,
  minWidth = 140,
}: {
  label: string;
  children: React.ReactNode;
  C: PersonnelPageProps["C"];
  minWidth?: number;
}) {
  return (
    <label style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minWidth,
      flexShrink: 0,
      fontFamily: "var(--font-outfit)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function PersonnelReportsPage({ C, accent }: PersonnelPageProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const so = lang === "so";

  const monthStart = useMemo(() => monthBounds(new Date().getFullYear(), new Date().getMonth() + 1), []);
  const [reportType, setReportType] = useState<ReportType>("agents");
  const [county, setCounty] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStart[0]);
  const [dateTo, setDateTo] = useState(localTodayIso());
  const [attendanceView, setAttendanceView] = useState<AttendanceView>("district");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const { data: counties = [] } = useCounties();
  const { data: departments = [] } = useQeybs();
  const { data: agentStatuses = [] } = useAgentStatuses();
  const exportReport = useExportReport();

  const selectedQeyb = useMemo(
    () => departments.find((d) => String(d.id) === department),
    [departments, department],
  );

  const districtOptions = useMemo(() => {
    if (!department || !selectedQeyb?.counties?.length) return counties;
    const allowed = new Set(selectedQeyb.counties.map((c) => String(c.id)));
    return counties.filter((c) => allowed.has(String(c.id)));
  }, [department, selectedQeyb, counties]);

  useEffect(() => {
    if (county && districtOptions.length && !districtOptions.some((c) => String(c.id) === county)) {
      setCounty("");
    }
  }, [county, districtOptions]);

  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (county) p.county = county;
    if (department) p.department = department;
    if (status) p.status = status;
    if (deferredSearch) p.search = deferredSearch;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (reportType === "attendance") p.view = attendanceView;
    return p;
  }, [county, department, status, deferredSearch, dateFrom, dateTo, reportType, attendanceView]);

  const activeFilters = useMemo(() => {
    let n = 0;
    if (county) n += 1;
    if (department) n += 1;
    if (status) n += 1;
    if (deferredSearch) n += 1;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    return n;
  }, [county, department, status, deferredSearch, dateFrom, dateTo]);

  const { data, isLoading, isFetching, isError, refetch } = usePersonnelReport(reportType, params);
  const rows = data?.rows ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];

  const showCountyFilter = ["agents", "attendance", "transfers", "restrictions"].includes(reportType);
  const showDepartmentFilter = reportType === "agents" || reportType === "attendance";
  const showStatusFilter = reportType === "agents" || reportType === "restrictions";
  const showDateFilter = reportType === "attendance" || reportType === "transfers";
  const showAttendanceView = reportType === "attendance";
  const showSearchFilter = reportType === "agents";
  const hasFilters = showCountyFilter || showDepartmentFilter || showStatusFilter || showDateFilter || showSearchFilter || showAttendanceView;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [reportType, county, department, status, deferredSearch, dateFrom, dateTo, attendanceView]);

  const applyDatePreset = (preset: (typeof DATE_PRESETS)[number]) => {
    const today = localTodayIso();
    if ("days" in preset && preset.days === 0) {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    const from = "from" in preset && preset.from ? preset.from() : today;
    setDateFrom(from);
    setDateTo(today);
  };

  const activeReport = REPORT_TYPES.find((r) => r.id === reportType)!;

  const handleExport = () => {
    exportReport.mutate({ type: reportType, params });
  };

  const selectStyle: React.CSSProperties = {
    padding: "9px 11px",
    borderRadius: 10,
    border: `1px solid ${C.inputBdr}`,
    background: C.inputBg,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: 13,
    width: "100%",
    height: 40,
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 11px",
    borderRadius: 8,
    border: `1px solid ${active ? hexA(accent, 0.45) : C.inputBdr}`,
    background: active ? hexA(accent, isDark ? 0.16 : 0.1) : C.inputBg,
    color: active ? accent : C.txtSecondary,
    fontFamily: "var(--font-outfit)",
    fontSize: 11.5,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ animation: "is-fadeUp .35s ease both", paddingBottom: 28 }}>
      {/* Hero header */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        border: `1px solid ${hexA(accent, 0.25)}`,
        background: `linear-gradient(135deg, ${hexA(accent, isDark ? 0.14 : 0.1)} 0%, ${C.cardBg} 55%, ${C.cardBg} 100%)`,
        boxShadow: C.cardShadow,
        padding: "22px 22px 20px",
        marginBottom: 16,
      }}>
        <div style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: hexA(accent, 0.08),
          pointerEvents: "none",
        }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hexA(accent, 0.15),
              border: `1px solid ${hexA(accent, 0.3)}`,
              color: accent,
              flexShrink: 0,
            }}>
              <Icon name="clipboard" size={22} sw={1.8} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-cinzel)", color: C.txtPrimary, fontSize: 24, lineHeight: 1.2 }}>
                {so ? "Warbixinnada Ciidanka" : "Personnel Reports"}
              </h2>
              <p style={{ margin: "6px 0 0", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13, maxWidth: 520 }}>
                {so
                  ? "Soo saar warbixinnada ciidanka, imaanshaha, wareejinta iyo xayiraadaha — daabac ama soo deji Excel."
                  : "Generate agent, attendance, transfer and restriction reports — print or export to Excel."}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SecondaryButton C={C} onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? (so ? "Cusboonaysiinaya…" : "Refreshing…") : (so ? "Cusboonaysii" : "Refresh")}
            </SecondaryButton>
            <SecondaryButton C={C} onClick={handleExport} disabled={exportReport.isPending}>
              {exportReport.isPending ? (so ? "Soo dejinaya…" : "Exporting…") : (so ? "Soo deji Excel" : "Export Excel")}
            </SecondaryButton>
          </div>
        </div>
      </div>

      {/* Report type tabs */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 14,
        padding: 6,
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
      }}>
        {REPORT_TYPES.map((rt) => {
          const active = reportType === rt.id;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => setReportType(rt.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${active ? hexA(accent, 0.45) : "transparent"}`,
                background: active ? hexA(accent, isDark ? 0.18 : 0.12) : "transparent",
                color: active ? accent : C.txtSecondary,
                fontFamily: "var(--font-outfit)",
                fontSize: 12.5,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "background .15s, color .15s",
              }}
            >
              <Icon name={rt.icon} size={14} sw={active ? 2 : 1.6} />
              {so ? rt.labelSo : rt.labelEn}
            </button>
          );
        })}
      </div>

      {/* Filters toolbar — single row: section → district → date → view → actions */}
      {hasFilters && (
        <div style={{
          borderRadius: 12,
          border: `1px solid ${C.cardBdr}`,
          background: C.cardBg,
          boxShadow: C.cardShadow,
          marginBottom: 12,
          padding: "10px 12px",
          overflow: "visible",
        }}>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 8,
            minWidth: "min(100%, 720px)",
          }}>
            {showSearchFilter && (
              <FilterField label={so ? "Raadi" : "Search"} C={C} minWidth={150}>
                <TextInput C={C} value={search} onChange={setSearch} placeholder={so ? "ID, magac, telefoon" : "ID, name, phone"} />
              </FilterField>
            )}
            {showDepartmentFilter && (
              <FilterField label={so ? "Qaybta" : "Section"} C={C} minWidth={140}>
                <select value={department} onChange={(e) => { setDepartment(e.target.value); setCounty(""); }} style={selectStyle}>
                  <option value="">{so ? "Dhammaan qaybaha" : "All sections"}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FilterField>
            )}
            {showCountyFilter && (
              <FilterField label={so ? "Degmo" : "District"} C={C} minWidth={140}>
                <select value={county} onChange={(e) => setCounty(e.target.value)} style={selectStyle}>
                  <option value="">
                    {department
                      ? (so ? "Dhammaan degmooyinka qaybta" : "All districts in section")
                      : (so ? "Dhammaan degmooyinka" : "All districts")}
                  </option>
                  {districtOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FilterField>
            )}
            {showStatusFilter && (
              <FilterField label={so ? "Xaalad" : "Status"} C={C} minWidth={120}>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                  <option value="">{so ? "Dhammaan" : "All"}</option>
                  {reportType === "agents"
                    ? agentStatuses.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)
                    : (
                      <>
                        <option value="ACTIVE">{so ? "Firfircoon" : "Active"}</option>
                        <option value="RELEASED">{so ? "La furay" : "Released"}</option>
                      </>
                    )}
                </select>
              </FilterField>
            )}
            {showDateFilter && (
              <FilterField label={so ? "Muddada" : "Date range"} C={C} minWidth={240}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <DateRangePicker
                      from={dateFrom}
                      to={dateTo}
                      onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                      C={C as never}
                      accent={accent}
                      isDark={isDark}
                      so={so}
                    />
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const preset = DATE_PRESETS.find((p) => p.id === e.target.value);
                      if (preset) applyDatePreset(preset);
                      e.target.value = "";
                    }}
                    style={{ ...selectStyle, width: "auto", minWidth: 88, flexShrink: 0, fontSize: 11.5, padding: "9px 8px" }}
                    title={so ? "Degdeg" : "Quick range"}
                  >
                    <option value="">{so ? "Degdeg" : "Quick"}</option>
                    {DATE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{so ? preset.labelSo : preset.labelEn}</option>
                    ))}
                  </select>
                </div>
              </FilterField>
            )}
            {showAttendanceView && (
              <FilterField label={so ? "Nooca" : "View"} C={C} minWidth={168}>
                <div style={{ display: "flex", gap: 4, height: 40, alignItems: "stretch" }}>
                  {([
                    ["district", so ? "Degmo" : "District"],
                    ["detail", so ? "Faahfaahin" : "Detail"],
                  ] as const).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setAttendanceView(id)} style={{ ...chipStyle(attendanceView === id), flex: 1, height: "100%", padding: "0 10px" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </FilterField>
            )}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginLeft: "auto", flexShrink: 0, paddingBottom: 1 }}>
              <PrimaryButton accent={accent} onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? (so ? "…" : "…") : (so ? "Soo bandhig" : "Run")}
              </PrimaryButton>
              {activeFilters > 0 && (
                <SecondaryButton C={C} onClick={() => {
                  setCounty("");
                  setDepartment("");
                  setStatus("");
                  setSearch("");
                  setDateFrom(monthStart[0]);
                  setDateTo(localTodayIso());
                  setAttendanceView("district");
                }}>
                  {so ? "Nadiifi" : "Clear"}
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active report label */}
      <div style={{
        marginBottom: 12,
        fontSize: 12,
        color: C.txtMuted,
        fontFamily: "var(--font-outfit)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <span style={{ color: accent, fontWeight: 700 }}>{so ? activeReport.labelSo : activeReport.labelEn}</span>
        <span>·</span>
        <span>{data?.total ?? 0} {so ? "safa" : "rows"}</span>
        {reportType === "attendance" && dateFrom && dateTo && (
          <>
            <span>·</span>
            <span>{dateFrom} — {dateTo}</span>
          </>
        )}
      </div>

      {!isLoading && !isError && rows.length > 0 && (
        <KpiStrip
          total={data?.total ?? rows.length}
          showing={pageRows.length}
          page={safePage}
          totalPages={totalPages}
          accent={accent}
          C={C}
          so={so}
        />
      )}

      {/* Results table */}
      <div style={{
        borderRadius: 16,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        overflow: "hidden",
      }}>
        {isLoading ? (
          <div style={{ padding: 18 }}><ShimmerBlock h={280} /></div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ color: "#e0655a", marginBottom: 8, fontFamily: "var(--font-cinzel)", fontSize: 18 }}>
              {so ? "Warbixinta lama soo rari karin" : "Could not load report"}
            </div>
            <p style={{ color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13, margin: "0 0 16px" }}>
              {so ? "Server-ka ma jawaabin. Isku day mar kale." : "The server did not respond. Please try again."}
            </p>
            <PrimaryButton accent={accent} onClick={() => refetch()}>{so ? "Isku day mar kale" : "Try again"}</PrimaryButton>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hexA(accent, 0.1),
              color: accent,
            }}>
              <Icon name="file" size={24} sw={1.6} />
            </div>
            <div style={{ color: C.txtPrimary, fontFamily: "var(--font-cinzel)", fontSize: 17, marginBottom: 6 }}>
              {so ? "Wax xog ah lama helin" : "No data found"}
            </div>
            <p style={{ color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13, margin: 0 }}>
              {so ? "Isbeddel shaandhaynta ama dooro nooc kale oo warbixin." : "Adjust your filters or choose a different report type."}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto", maxHeight: "min(70vh, 720px)", overflowY: "auto" }}>
              <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{
                      padding: "11px 14px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: C.txtMuted,
                      background: C.tableHead,
                      borderBottom: `1px solid ${C.tableSep}`,
                      whiteSpace: "nowrap",
                    }}>
                      #
                    </th>
                    {columns.map((col) => (
                      <th key={col} style={{
                        padding: "11px 14px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: C.txtMuted,
                        background: C.tableHead,
                        borderBottom: `1px solid ${C.tableSep}`,
                        whiteSpace: "nowrap",
                      }}>
                        {formatHeader(col, so)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, idx) => {
                    const globalIdx = (safePage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr
                        key={globalIdx}
                        style={{
                          borderTop: `1px solid ${C.tableSep}`,
                          background: idx % 2 === 0 ? "transparent" : hexA(accent, isDark ? 0.03 : 0.02),
                          transition: "background .12s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = hexA(accent, isDark ? 0.08 : 0.05); }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : hexA(accent, isDark ? 0.03 : 0.02); }}
                      >
                        <td style={{ padding: "10px 14px", color: C.txtMuted, fontVariantNumeric: "tabular-nums" }}>{globalIdx}</td>
                        {columns.map((col) => {
                          const raw = cellValue(row, col);
                          const isStatus = col === "status" || col === "presence";
                          const isMono = col === "service_id" || col === "phone";
                          const isNumeric = typeof row[col] === "number";
                          return (
                            <td key={col} style={{
                              padding: "10px 14px",
                              color: col === "name" || col === "district" ? C.txtPrimary : isNumeric ? C.txtPrimary : C.txtSecondary,
                              fontWeight: col === "name" || col === "district" || isNumeric ? 600 : 400,
                              maxWidth: 240,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: isMono ? "ui-monospace, monospace" : undefined,
                              fontSize: isMono ? 11.5 : undefined,
                            }}>
                              {isStatus && raw !== "—" ? <StatusBadge value={raw} C={C} /> : raw}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 16px",
                borderTop: `1px solid ${C.tableSep}`,
                background: hexA(accent, 0.03),
              }}>
                <span style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  {so
                    ? `Muujinaya ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} ee ${rows.length}`
                    : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} of ${rows.length}`}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <SecondaryButton C={C} onClick={() => setPage(1)} disabled={safePage <= 1}>
                    {so ? "Bilow" : "First"}
                  </SecondaryButton>
                  <SecondaryButton C={C} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                    {so ? "Hore" : "Prev"}
                  </SecondaryButton>
                  <span style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    color: accent,
                    background: hexA(accent, 0.1),
                    border: `1px solid ${hexA(accent, 0.25)}`,
                    fontFamily: "var(--font-outfit)",
                  }}>
                    {safePage} / {totalPages}
                  </span>
                  <SecondaryButton C={C} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                    {so ? "Xiga" : "Next"}
                  </SecondaryButton>
                  <SecondaryButton C={C} onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>
                    {so ? "Ugu dambeeya" : "Last"}
                  </SecondaryButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
