"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "../lang-ctx";
import { useTheme } from "../theme-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { usePersonnelDashboard } from "@/hooks/use-personnel";
import { fmtNum, useKpiCounter } from "@/hooks/use-kpi-counter";
import { ShimmerBlock } from "../shimmer";
import { Icon } from "../icon";
import type { PersonnelPageProps } from "./personnel-page-props";
import type { DistrictStat } from "@/types/personnel";

function attendanceBarColor(pct: number, isDark: boolean): string {
  if (pct >= 80) return isDark ? "#46c08a" : "#059669";
  if (pct >= 50) return isDark ? "#e0a84a" : "#d97706";
  if (pct > 0) return isDark ? "#e0655a" : "#dc2626";
  return isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
}

function formatDate(iso: string | undefined, so: boolean): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(so ? "so-SO" : undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<string, { en: string; so: string; color: string }> = {
  ACTIVE: { en: "Active", so: "Firfircoon", color: "#46c08a" },
  TRANSFERRED: { en: "Transferred", so: "Badal", color: "#5b9fd4" },
  ON_LEAVE: { en: "On Leave", so: "Fasax", color: "#e0a84a" },
  ABSENT: { en: "Absent", so: "Maqan", color: "#e0655a" },
  ABSCONDED: { en: "Absconded", so: "Fakad", color: "#c44a3f" },
  INJURED: { en: "Injured", so: "Dhaawac", color: "#b8860b" },
  ARRESTED: { en: "Arrested", so: "Xabsi", color: "#8b5cf6" },
  RELEASED: { en: "Released", so: "La sii daayay", color: "#94a3b8" },
  UNKNOWN: { en: "Unknown", so: "Aan la aqoon", color: "#94a3b8" },
};

function KpiCard({
  label,
  value,
  icon,
  color,
  C,
  accent,
  isDark,
  delay = 0,
  sub,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  C: PersonnelPageProps["C"];
  accent: string;
  isDark: boolean;
  delay?: number;
  sub?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "20px 18px",
        borderRadius: 16,
        background: C.cardBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.cardShadow,
        animation: "is-fadeUp .5s ease both",
        animationDelay: `${delay}s`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${hexA(color, 0.35)})`,
          borderRadius: "16px 16px 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: hexA(color, isDark ? 0.08 : 0.06),
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hexA(color, 0.14),
            color,
            border: `1px solid ${hexA(color, 0.28)}`,
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} sw={1.8} />
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-cinzel)",
          fontWeight: 700,
          fontSize: 32,
          color: C.txtPrimary,
          marginTop: 16,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtNum(value)}
      </div>
      <div style={{ fontSize: 12.5, color: C.txtMuted, marginTop: 8, fontFamily: "var(--font-outfit)", lineHeight: 1.35 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: hexA(accent, 0.85), marginTop: 4, fontFamily: "var(--font-outfit)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  C,
  accent,
  isDark,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  C: PersonnelPageProps["C"];
  accent: string;
  isDark: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: C.cardBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.cardShadow,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "18px 22px",
          borderBottom: `1px solid ${C.tableSep}`,
          background: isDark ? hexA(accent, 0.03) : hexA("#fafaf9", 1),
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
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
      <div style={{ padding: "4px 0 8px" }}>{children}</div>
    </div>
  );
}

function DistrictRow({
  row,
  rank,
  C,
  isDark,
  so,
}: {
  row: DistrictStat;
  rank: number;
  C: PersonnelPageProps["C"];
  isDark: boolean;
  so: boolean;
}) {
  const barColor = attendanceBarColor(row.attendance_pct, isDark);
  return (
    <tr style={{ borderTop: `1px solid ${C.tableSep}`, transition: "background .15s" }}>
      <td style={{ padding: "13px 18px", width: 36, color: C.txtMuted, fontSize: 12, fontFamily: "var(--font-outfit)" }}>
        {rank}
      </td>
      <td style={{ padding: "13px 10px", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontWeight: 500 }}>
        {row.county_name}
      </td>
      <td style={{ padding: "13px 10px", color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontVariantNumeric: "tabular-nums" }}>
        {fmtNum(row.total_agents)}
      </td>
      <td style={{ padding: "13px 10px", color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontVariantNumeric: "tabular-nums" }}>
        {fmtNum(row.present_today)}
      </td>
      <td style={{ padding: "13px 18px 13px 10px", minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 99, background: C.barTrack, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, row.attendance_pct)}%`,
                height: "100%",
                borderRadius: 99,
                background: `linear-gradient(90deg, ${hexA(barColor, 0.85)}, ${barColor})`,
                transition: "width .6s ease",
              }}
            />
          </div>
          <span
            style={{
              color: row.attendance_pct > 0 ? barColor : C.txtMuted,
              minWidth: 40,
              textAlign: "right",
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {row.attendance_pct}%
          </span>
        </div>
      </td>
    </tr>
  );
}

export function PersonnelDashboardPage({ C, accent }: PersonnelPageProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const so = lang === "so";
  const { data, isLoading } = usePersonnelDashboard();

  const primaryKpis = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: so ? "Wadarta Ciidanka" : "Total Agents",
        value: data.total_agents,
        icon: "users",
        color: accent,
      },
      {
        label: so ? "Joogta Maanta" : "Present Today",
        value: data.present_today,
        icon: "check",
        color: isDark ? "#46c08a" : "#059669",
      },
      {
        label: so ? "Maqan Maanta" : "Absent Today",
        value: data.absent_today,
        icon: "close",
        color: isDark ? "#e0655a" : "#dc2626",
      },
      {
        label: so ? "Fasax Maanta" : "Excused Today",
        value: data.excused_today,
        icon: "calendar",
        color: isDark ? "#e0a84a" : "#d97706",
      },
    ];
  }, [data, so, accent, isDark]);

  const restrictionKpis = useMemo(() => {
    if (!data) return [];
    const alerts = data.restriction_alerts;
    const items = [
      {
        label: so ? "Xayiraad Firfircoon" : "Active Restrictions",
        value: data.active_restrictions,
        icon: "lock",
        color: isDark ? "#a78bfa" : "#7c3aed",
      },
    ];
    if (alerts) {
      items.push(
        {
          label: so ? "Xayiraad Dhacday" : "Expired Restrictions",
          value: alerts.expired,
          icon: "alert",
          color: isDark ? "#e0655a" : "#dc2626",
        },
        {
          label: so ? "Dhamaanaya 7 Maalmood" : "Expiring in 7 Days",
          value: alerts.expiring_within_7_days,
          icon: "clock",
          color: isDark ? "#e0a84a" : "#d97706",
        },
      );
    }
    return items;
  }, [data, so, isDark]);

  const kpiVals = useKpiCounter(primaryKpis.map((k) => k.value));
  const restrictionVals = useKpiCounter(restrictionKpis.map((k) => k.value));

  const sortedDistricts = useMemo(() => {
    const rows = [...(data?.district_stats ?? [])];
    return rows.sort((a, b) => b.total_agents - a.total_agents || b.attendance_pct - a.attendance_pct);
  }, [data?.district_stats]);

  const statusBreakdown = useMemo(() => {
    const counts = data?.status_counts ?? {};
    const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
    return Object.entries(counts)
      .map(([code, count]) => {
        const meta = STATUS_LABELS[code] ?? STATUS_LABELS.UNKNOWN;
        return {
          code,
          label: so ? meta.so : meta.en,
          count,
          pct: Math.round((count / total) * 100),
          color: meta.color,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data?.status_counts, so]);

  const attendanceRate = useMemo(() => {
    if (!data || data.total_agents === 0) return 0;
    return Math.round((data.present_today / data.total_agents) * 100);
  }, [data]);

  const recordedToday = (data?.present_today ?? 0) + (data?.absent_today ?? 0) + (data?.excused_today ?? 0);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "is-fadeUp .35s ease both" }}>
        <ShimmerBlock h={100} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <ShimmerBlock h={130} />
          <ShimmerBlock h={130} />
          <ShimmerBlock h={130} />
          <ShimmerBlock h={130} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <ShimmerBlock h={360} />
          <ShimmerBlock h={360} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "is-fadeUp .45s ease both", paddingBottom: 40 }}>
      {/* Hero */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: accent,
                boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
              }}
            />
            <span
              style={{
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: accent,
                fontWeight: 600,
                fontFamily: "var(--font-outfit)",
              }}
            >
              {so ? "Maamulka Ciidanka" : "Personnel"}
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-cinzel)",
              fontWeight: 600,
              fontSize: "clamp(22px, 2.8vw, 30px)",
              color: C.txtPrimary,
              margin: 0,
            }}
          >
            {so ? "Dashboard-ka Ciidanka" : "Personnel Dashboard"}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.5, fontFamily: "var(--font-outfit)" }}>
            {so ? "Warbixinta maalinlaha ah ee ciidanka iyo imaanshaha" : "Daily agent operations and attendance overview"}
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            border: `1px solid ${C.cardBdr}`,
            background: C.cardBg,
            boxShadow: C.cardShadow,
            fontFamily: "var(--font-outfit)",
            fontSize: 12.5,
            color: C.txtSecondary,
          }}
        >
          <Icon name="calendar" size={15} sw={1.8} />
          {formatDate(data?.date, so)}
        </div>
      </div>

      {/* Primary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {primaryKpis.map((kpi, i) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpiVals[i]}
            icon={kpi.icon}
            color={kpi.color}
            C={C}
            accent={accent}
            isDark={isDark}
            delay={0.05 + i * 0.06}
          />
        ))}
      </div>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.65fr) minmax(280px, 1fr)",
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* District attendance */}
        <Panel
          title={so ? "Imaanshaha Degmooyinka" : "District Attendance"}
          subtitle={
            so
              ? `${sortedDistricts.length} degmo · ${fmtNum(recordedToday)} diiwaan maanta`
              : `${sortedDistricts.length} districts · ${fmtNum(recordedToday)} records today`
          }
          C={C}
          accent={accent}
          isDark={isDark}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.tableHead, textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  <th style={{ padding: "10px 18px", width: 36 }}>#</th>
                  <th style={{ padding: "10px 10px" }}>{so ? "Degmo" : "District"}</th>
                  <th style={{ padding: "10px 10px" }}>{so ? "Ciidanka" : "Agents"}</th>
                  <th style={{ padding: "10px 10px" }}>{so ? "Joogta" : "Present"}</th>
                  <th style={{ padding: "10px 18px 10px 10px" }}>{so ? "Heerka" : "Rate"}</th>
                </tr>
              </thead>
              <tbody>
                {sortedDistricts.map((row, i) => (
                  <DistrictRow key={row.county_id} row={row} rank={i + 1} C={C} isDark={isDark} so={so} />
                ))}
                {!sortedDistricts.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px 18px", textAlign: "center", color: C.txtMuted }}>
                      {so ? "Weli ma jiraan degmooyin" : "No district data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Sidebar summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Attendance ring card */}
          <div
            style={{
              borderRadius: 16,
              padding: "22px 20px",
              background: C.cardBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow,
              animation: "is-fadeUp .55s ease both",
              animationDelay: "0.15s",
            }}
          >
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 15, color: C.txtPrimary, marginBottom: 4 }}>
              {so ? "Imaanshaha Maanta" : "Today's Attendance"}
            </div>
            <div style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 18 }}>
              {so ? "Boqolkiiba ciidanka joogta" : "Present rate across all agents"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  position: "relative",
                  width: 96,
                  height: 96,
                  flexShrink: 0,
                }}
              >
                <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke={C.barTrack} strokeWidth="8" />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke={attendanceBarColor(attendanceRate, isDark)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(attendanceRate / 100) * 251.2} 251.2`}
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-cinzel)",
                    fontWeight: 700,
                    fontSize: 22,
                    color: C.txtPrimary,
                  }}
                >
                  {attendanceRate}%
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: so ? "Joogta" : "Present", value: data?.present_today ?? 0, color: isDark ? "#46c08a" : "#059669" },
                  { label: so ? "Maqan" : "Absent", value: data?.absent_today ?? 0, color: isDark ? "#e0655a" : "#dc2626" },
                  { label: so ? "Fasax" : "Excused", value: data?.excused_today ?? 0, color: isDark ? "#e0a84a" : "#d97706" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtNum(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Restriction mini KPIs */}
          <div
            style={{
              borderRadius: 16,
              padding: "18px 18px 14px",
              background: C.cardBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow,
              animation: "is-fadeUp .55s ease both",
              animationDelay: "0.22s",
            }}
          >
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 15, color: C.txtPrimary, marginBottom: 14 }}>
              {so ? "Xayiraadaha" : "Restrictions"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {restrictionKpis.map((kpi, i) => (
                <div
                  key={kpi.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: hexA(kpi.color, isDark ? 0.08 : 0.06),
                    border: `1px solid ${hexA(kpi.color, 0.18)}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hexA(kpi.color, 0.15),
                        color: kpi.color,
                      }}
                    >
                      <Icon name={kpi.icon} size={15} sw={1.8} />
                    </div>
                    <span style={{ fontSize: 12.5, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{kpi.label}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: kpi.color, fontFamily: "var(--font-cinzel)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(restrictionVals[i])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status breakdown */}
          {statusBreakdown.length > 0 && (
            <div
              style={{
                borderRadius: 16,
                padding: "18px 18px 14px",
                background: C.cardBg,
                border: `1px solid ${C.cardBdr}`,
                boxShadow: C.cardShadow,
                animation: "is-fadeUp .55s ease both",
                animationDelay: "0.28s",
              }}
            >
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 15, color: C.txtPrimary, marginBottom: 14 }}>
                {so ? "Xaaladaha Ciidanka" : "Agent Status"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {statusBreakdown.map((item) => (
                  <div key={item.code}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontFamily: "var(--font-outfit)", fontSize: 12 }}>
                      <span style={{ color: C.txtSecondary }}>{item.label}</span>
                      <span style={{ color: C.txtPrimary, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmtNum(item.count)}
                        <span style={{ color: C.txtMuted, fontWeight: 400, marginLeft: 4 }}>({item.pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: C.barTrack, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${item.pct}%`,
                          height: "100%",
                          borderRadius: 99,
                          background: `linear-gradient(90deg, ${hexA(item.color, 0.8)}, ${item.color})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restriction alerts */}
      {(data?.restriction_alerts?.items?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <Panel
            title={so ? "Digniinaha Xayiraadaha" : "Restriction Alerts"}
            subtitle={so ? "Xayiraadaha dhacay ama dhamaanaya" : "Expired or expiring restrictions requiring attention"}
            C={C}
            accent={accent}
            isDark={isDark}
            action={(
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 99,
                  background: hexA("#e0655a", 0.12),
                  border: `1px solid ${hexA("#e0655a", 0.3)}`,
                  color: "#e0655a",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                <Icon name="alert" size={13} sw={2} />
                {data!.restriction_alerts!.items.length}
              </span>
            )}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.tableHead, textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    <th style={{ padding: "10px 22px" }}>{so ? "Aqoonsi" : "Service ID"}</th>
                    <th style={{ padding: "10px 16px" }}>{so ? "Magac" : "Name"}</th>
                    <th style={{ padding: "10px 16px" }}>{so ? "Sabab" : "Reason"}</th>
                    <th style={{ padding: "10px 22px" }}>{so ? "Dhamaadka" : "End Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.restriction_alerts!.items.map((item) => (
                    <tr key={item.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={{ padding: "12px 22px", color: C.txtPrimary, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        {item.agent__service_id || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{item.agent__personal_fullname}</td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{item.reason}</td>
                      <td style={{ padding: "12px 22px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: hexA("#e0655a", 0.1),
                            color: "#e0655a",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {item.end_date}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
