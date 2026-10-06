"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import { useAmnigaAnalytics, useAmnigaStatsEnabled } from "@/hooks/use-amniga";
import { ShimmerBlock } from "./shimmer";
import { HubStatusDonut } from "./hubkadhigis-charts";
import {
  AmnigaDistrictBarChart,
  AmnigaRegistrarBars,
  AmnigaWeeklyChart,
  type AmnigaChartTheme,
} from "./amniga-charts";
import type { AccountsThemeColors } from "./accounts-shared";
import type { AmnigaRecentActivity } from "@/types/amniga";

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
  barTrack: string;
};

function formatAppLoginTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLoginAgo(
  iso: string | null | undefined,
  t: ReturnType<typeof getDict>,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return t.amnigaAgoJustNow;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t.amnigaAgoJustNow;
  if (mins === 1) return `1 ${t.amnigaAgoMinute}`;
  if (mins < 60) return `${mins} ${t.amnigaAgoMinutes}`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return `1 ${t.amnigaAgoHour}`;
  if (hours < 24) return `${hours} ${t.amnigaAgoHours}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `1 ${t.amnigaAgoDay}`;
  if (days < 7) return `${days} ${t.amnigaAgoDays}`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return `1 ${t.amnigaAgoWeek}`;
  return `${weeks} ${t.amnigaAgoWeeks}`;
}

function RecentLoginAvatar({ row, accent }: { row: AmnigaRecentActivity; accent: string }) {
  const photo = resolveMediaUrl(row.profile_url);
  const initials = (row.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.5)})`,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-cinzel)",
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials
      )}
    </div>
  );
}

function useKpiCounter(targets: number[]) {
  const [vals, setVals] = useState(() => targets.map(() => 0));
  const rafRef = useRef<number>(0);
  const key = targets.join(",");
  useEffect(() => {
    const dur = 1400;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVals(targets.map((v) => Math.round(v * e)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [key]); // eslint-disable-line
  return vals;
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
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 14,
      overflow: "hidden",
      background: C.panelBg,
      border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
      minWidth: 0,
    }}>
      <div style={{
        padding: "18px 22px",
        borderBottom: `1px solid ${C.tableSep}`,
        background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
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
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

const BREAKDOWN_KEYS: Record<string, keyof ReturnType<typeof getDict>> = {
  patrol_coverage: "amnigaPatrolCoverage",
  report_response: "amnigaReportResponse",
  case_closure: "amnigaCaseClosure",
};

const STATUS_LABELS: Record<string, keyof ReturnType<typeof getDict>> = {
  on_duty: "statusOnDuty",
  on_leave: "statusOnLeave",
  medical: "statusMedical",
  suspended: "statusSuspended",
  active: "statusActive",
  watching: "statusWatching",
  detained: "statusDetained",
  cleared: "statusCleared",
  Active: "amnigaStatusActive",
  Inactive: "amnigaStatusInactive",
  Joogey: "amnigaPresentJoogey",
  Maqan: "amnigaPresentMaqan",
  Xanuunsan: "amnigaPresentXanuunsan",
  Staff: "amnigaPresentStaff",
  Fakad: "amnigaPresentFakad",
  Fasax: "amnigaPresentFasax",
};

function labelFromDict(
  key: string | undefined,
  t: ReturnType<typeof getDict>,
  fallback: string,
): string {
  if (!key) return fallback;
  const dictKey = STATUS_LABELS[key] ?? STATUS_LABELS[key.toLowerCase()];
  if (!dictKey) return fallback;
  const value = t[dictKey];
  return typeof value === "string" ? value : fallback;
}

export function AmnigaDashboardPage({
  C,
  accent,
  isDark,
  moduleName,
  moduleTagline,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName: string;
  moduleTagline: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";

  const { data: stats, isLoading: statsLoading } = useAmnigaStatsEnabled(true);
  const { data: analytics, isLoading: analyticsLoading } = useAmnigaAnalytics("7d", true);

  const [districtMetric, setDistrictMetric] = useState<"suspects" | "agents" | "users">("suspects");

  const chartTheme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack,
  };

  const fmtDelta = (delta?: { pct: number; up: boolean } | null) =>
    delta ? `${delta.up ? "+" : "-"}${delta.pct}%` : "";

  const kpis = useMemo(() => {
    if (!stats) {
      return [
        { icon: "shield" as const, label: t.amnigaActivePatrols, value: 0, delta: "", up: true },
        { icon: "alert" as const, label: t.amnigaIncidentsToday, value: 0, delta: "", up: true },
        { icon: "users" as const, label: t.amnigaGuardsOnDuty, value: 0, delta: "", up: true },
        { icon: "clipboard" as const, label: t.amnigaDailyReports, value: 0, delta: "", up: true },
      ];
    }
    return [
      { icon: "shield" as const, label: t.amnigaActivePatrols, value: stats.active_patrols, delta: fmtDelta(stats.deltas.active_patrols), up: stats.deltas.active_patrols?.up ?? true },
      { icon: "alert" as const, label: t.amnigaIncidentsToday, value: stats.incidents_today, delta: fmtDelta(stats.deltas.incidents_today), up: stats.deltas.incidents_today?.up ?? true },
      { icon: "users" as const, label: t.amnigaGuardsOnDuty, value: stats.guards_on_duty, delta: fmtDelta(stats.deltas.guards_on_duty), up: stats.deltas.guards_on_duty?.up ?? true },
      { icon: "clipboard" as const, label: t.amnigaDailyReports, value: stats.daily_reports, delta: fmtDelta(stats.deltas.daily_reports), up: stats.deltas.daily_reports?.up ?? true },
    ];
  }, [stats, t]);

  const kpiVals = useKpiCounter(kpis.map((k) => k.value));

  const weeklyBars = analytics?.weekly_trend.map((p) => p.count) ?? [0, 0, 0, 0, 0, 0, 0];
  const dayLabels = so
    ? ["Isn", "Tal", "Arb", "Kha", "Jim", "Sab", "Axd"]
    : ["M", "T", "W", "T", "F", "S", "S"];

  const breakdown = (analytics?.breakdown ?? []).map((b) => ({
    label: BREAKDOWN_KEYS[b.key] ? t[BREAKDOWN_KEYS[b.key]] : t.breakdown,
    pct: b.pct,
  }));

  const countiesChart = analytics?.counties_chart ?? [];
  const topRegistrars = analytics?.top_registrars ?? [];
  const activity = analytics?.user_activity_summary;

  const agentSegments = (analytics?.force_status_breakdown ?? []).map((s) => ({
    label: labelFromDict(s.label, t, s.label),
    pct: s.pct,
    color: s.color,
    count: s.count,
  }));

  const suspectSegments = (analytics?.suspect_status_breakdown ?? []).map((s) => ({
    label: labelFromDict(s.label, t, s.label),
    pct: s.pct,
    color: s.color,
    count: s.count,
  }));

  const recentRows = analytics?.recent_activity ?? [];
  const loading = statsLoading || analyticsLoading;

  const metricTabs = [
    { id: "suspects" as const, label: t.amnigaChartSuspects },
    { id: "agents" as const, label: t.amnigaChartAgents },
    { id: "users" as const, label: t.amnigaChartUsers },
  ];

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: accent,
              boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
            }} />
            <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent, fontWeight: 600, fontFamily: "var(--font-outfit)" }}>
              {moduleName}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "clamp(22px, 2.8vw, 30px)", color: C.txtPrimary, margin: 0 }}>
            {t.amnigaDashboardTitle}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>{moduleTagline}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "22px 20px",
              borderRadius: 14,
              background: C.cardBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow,
              animation: `is-fadeUp .5s ease both`,
              animationDelay: `${0.05 + i * 0.07}s`,
            }}
          >
            {!isDark && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg,${accent},${hexA(accent, 0.4)})`,
                borderRadius: "14px 14px 0 0",
              }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{
                width: 46, height: 46, borderRadius: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(accent, 0.14), color: accent,
                border: `1px solid ${hexA(accent, 0.25)}`,
              }}>
                <Icon name={k.icon} size={22} sw={1.8} />
              </div>
              {k.delta && (
                <span style={{
                  fontSize: 12.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                  background: k.up ? (isDark ? "rgba(70,192,138,0.14)" : "rgba(5,150,105,0.12)") : (isDark ? "rgba(224,101,90,0.14)" : "rgba(220,38,38,0.1)"),
                  color: k.up ? (isDark ? "#46c08a" : "#059669") : (isDark ? "#e0655a" : "#dc2626"),
                }}>
                  {k.delta}
                </span>
              )}
            </div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 34, color: C.txtPrimary, marginTop: 18, lineHeight: 1 }}>
              {loading ? "—" : kpiVals[i].toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* District chart — main legacy-style chart */}
      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.amnigaDistrictChartTitle}
          subtitle={t.amnigaDistrictChartSub}
          C={C}
          accent={accent}
          isDark={isDark}
          action={(
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {metricTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDistrictMetric(tab.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1px solid ${districtMetric === tab.id ? hexA(accent, 0.45) : C.cardBdr}`,
                    background: districtMetric === tab.id ? hexA(accent, 0.14) : "transparent",
                    color: districtMetric === tab.id ? accent : C.txtMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        >
          {loading ? <ShimmerBlock h={300} /> : (
            <AmnigaDistrictBarChart
              data={countiesChart}
              theme={chartTheme}
              emptyLabel={t.amnigaNoData}
              valueKey={districtMetric}
            />
          )}
        </Panel>
      </div>

      {/* Charts row */}
      <div className="amniga-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title={t.amnigaActivityTrend} subtitle={t.thisWeek} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={200} /> : (
            <AmnigaWeeklyChart bars={weeklyBars} labels={dayLabels} theme={chartTheme} />
          )}
        </Panel>
        <Panel title={t.breakdown} subtitle={t.amnigaDashboardBreakdownSub} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={200} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {breakdown.map((bd, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
                    <span style={{ color: C.txtSecondary }}>{bd.label}</span>
                    <span style={{ color: accent, fontWeight: 600 }}>{bd.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: C.barTrack, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 6, width: `${bd.pct}%`, background: `linear-gradient(90deg,${hexA(accent, 0.6)},${accent})` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Donuts + user activity */}
      <div className="amniga-dash-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
        <Panel title={t.amnigaForceStatusMix} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={180} /> : agentSegments.length > 0 ? (
            <HubStatusDonut
              segments={agentSegments}
              centerLabel={String(agentSegments.reduce((s, x) => s + x.count, 0))}
              centerSub={t.amnigaGuardsOnDuty}
              theme={chartTheme}
              size={140}
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: C.txtMuted, fontSize: 13 }}>{t.amnigaNoData}</div>
          )}
        </Panel>
        <Panel title={t.amnigaSuspectStatusMix} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={180} /> : suspectSegments.length > 0 ? (
            <HubStatusDonut
              segments={suspectSegments}
              centerLabel={String(suspectSegments.reduce((s, x) => s + x.count, 0))}
              centerSub={t.amnigaSuspectsTotal}
              theme={chartTheme}
              size={140}
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: C.txtMuted, fontSize: 13 }}>{t.amnigaNoData}</div>
          )}
        </Panel>
        <Panel title={t.amnigaUserActivityTitle} subtitle={t.amnigaUserActivitySub} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={180} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: t.amnigaActivityTotalUsers, value: activity?.total_users ?? 0, color: "#3B82F6" },
                { label: t.amnigaActivityActive, value: activity?.active_users ?? 0, color: "#10B981" },
                { label: t.amnigaActivityLoggedToday, value: activity?.logged_today ?? 0, color: "#F59E0B" },
                { label: t.amnigaActivityNeverLogin, value: activity?.never_login ?? 0, color: "#EF4444" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    background: hexA(item.color, isDark ? 0.1 : 0.08),
                    border: `1px solid ${hexA(item.color, 0.2)}`,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontFamily: "var(--font-cinzel)" }}>
                    {item.value.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 4, lineHeight: 1.35, fontFamily: "var(--font-outfit)" }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Top registrars + recent activity */}
      <div className="amniga-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginTop: 16 }}>
        <Panel title={t.amnigaTopRegistrars} subtitle={t.amnigaTopRegistrarsSub} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={280} /> : (
            <AmnigaRegistrarBars rows={topRegistrars} theme={chartTheme} emptyLabel={t.amnigaNoData} />
          )}
        </Panel>
        <Panel title={t.recent} subtitle={t.amnigaRecentSub} C={C} accent={accent} isDark={isDark}>
          {loading ? <ShimmerBlock h={280} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr>
                    {[t.amnigaColUser, t.amnigaColZone, t.amnigaColOs, t.amnigaColTime].map((col) => (
                      <th key={col} style={{
                        textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 500,
                        letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted,
                        background: C.tableHead, fontFamily: "var(--font-outfit)",
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 24, textAlign: "center", color: C.txtMuted, fontSize: 13 }}>
                        {t.amnigaNoData}
                      </td>
                    </tr>
                  ) : recentRows.map((row) => {
                    const client = row.client || row.status;
                    const isMobile = client === "mobile" || row.kind === "app_login";
                    const clientLabel = isMobile ? t.amnigaClientMobile : t.amnigaClientWeb;
                    const clientColor = isMobile ? "#46c08a" : "#3B82F6";
                    return (
                      <tr key={`${row.kind}-${row.id}`} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <RecentLoginAvatar row={row} accent={accent} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: C.txtPrimary, fontWeight: 600, fontFamily: "var(--font-outfit)" }}>
                                {row.name || "—"}
                              </div>
                              <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)" }}>
                                {row.unit || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px", fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                          {row.zone || "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ fontSize: 13, color: C.txtPrimary, fontWeight: 600, fontFamily: "var(--font-outfit)" }}>
                            {row.os_name || row.device || "—"}
                          </div>
                          <span style={{
                            display: "inline-flex", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px",
                            borderRadius: 999, background: hexA(clientColor, 0.14), color: clientColor,
                            border: `1px solid ${hexA(clientColor, 0.28)}`,
                            fontFamily: "var(--font-outfit)",
                          }}>
                            {clientLabel}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ fontSize: 13, color: C.txtPrimary, fontWeight: 600, fontFamily: "var(--font-outfit)", whiteSpace: "nowrap" }}>
                            {formatLoginAgo(row.created_at, t)}
                          </div>
                          <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)", whiteSpace: "nowrap" }}>
                            {formatAppLoginTime(row.created_at)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .amniga-dash-grid-2,
          .amniga-dash-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
