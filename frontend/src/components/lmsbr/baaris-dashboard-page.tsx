"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useBaarisAnalytics, useBaarisStats } from "@/hooks/use-baaris";
import { HubStatusDonut } from "./hubkadhigis-charts";
import {
  AmnigaDistrictBarChart,
  AmnigaRegistrarBars,
  AmnigaWeeklyChart,
  type AmnigaChartTheme,
} from "./amniga-charts";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors & {
  cardBg: string;
  cardBdr: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  barTrack: string;
};

function useKpiCounter(targets: number[]) {
  const [vals, setVals] = useState(() => targets.map(() => 0));
  const rafRef = useRef(0);
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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <div style={{
      borderRadius: 14, overflow: "hidden", background: C.panelBg,
      border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, minWidth: 0,
    }}>
      <div style={{
        padding: "18px 22px", borderBottom: `1px solid ${C.tableSep}`,
        background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
      }}>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

export function BaarisDashboardPage({
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
  const so = lang === "so";
  const { data: stats, isLoading: statsLoading } = useBaarisStats(true);
  const { data: analytics, isLoading: analyticsLoading } = useBaarisAnalytics("7d", true);

  const kpiDefs = useMemo(() => [
    { icon: "users", label: so ? "Muwaadiniin" : "Citizens", value: stats?.total_citizens ?? 0, delta: stats?.deltas?.total_citizens },
    { icon: "badge", label: so ? "Maanta" : "Today", value: stats?.registered_today ?? 0, delta: stats?.deltas?.registered_today },
    { icon: "shield", label: so ? "Firfircoon" : "Active", value: stats?.active_records ?? 0, delta: null },
    { icon: "alert", label: so ? "Wanted" : "Wanted", value: stats?.wanted_total ?? 0, delta: null },
  ], [stats, so]);

  const kpiVals = useKpiCounter(kpiDefs.map((k) => k.value));
  const loading = statsLoading || analyticsLoading;

  const chartTheme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack,
  };

  const countiesForChart = (analytics?.counties_chart ?? []).map((c) => ({
    name: c.name,
    suspects: c.citizens,
    agents: 0,
    users: 0,
  }));

  const statusSegments = (analytics?.status_breakdown ?? []).map((s) => ({
    label: s.label,
    pct: s.pct,
    color: s.color,
    count: s.count,
  }));

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: accent,
            boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
          }} />
          <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent, fontWeight: 600 }}>
            {moduleName}
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "clamp(22px, 2.8vw, 30px)", color: C.txtPrimary, margin: 0 }}>
          {so ? "Bogga Hore — Baaris" : "Baaris Dashboard"}
        </h1>
        <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0" }}>{moduleTagline}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
        {kpiDefs.map((k, i) => (
          <div
            key={k.label}
            style={{
              position: "relative", overflow: "hidden", padding: "22px 20px", borderRadius: 14,
              background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
            }}
          >
            {!isDark && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg,${accent},${hexA(accent, 0.4)})`,
              }} />
            )}
            <div style={{
              width: 46, height: 46, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.14), color: accent, border: `1px solid ${hexA(accent, 0.25)}`,
            }}>
              <Icon name={k.icon} size={22} sw={1.8} />
            </div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 34, color: C.txtPrimary, marginTop: 18 }}>
              {loading ? "—" : kpiVals[i].toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8 }}>{k.label}</div>
            {k.delta && (
              <div style={{ fontSize: 12, marginTop: 6, color: k.delta.up ? "#46c08a" : "#e0655a" }}>
                {k.delta.up ? "+" : "-"}{k.delta.pct}%
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="baaris-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title={so ? "Isdiiwaangelinta toddobaadka" : "Weekly registrations"} subtitle={so ? "7 maalmood ee ugu dambeeyay" : "Last 7 days"} C={C} accent={accent} isDark={isDark}>
          <AmnigaWeeklyChart
            bars={(analytics?.weekly_trend ?? []).map((d) => d.count)}
            labels={(analytics?.weekly_trend ?? []).map((d) => d.label)}
            theme={chartTheme}
          />
        </Panel>
        <Panel title={so ? "Heerarka buuxinta" : "Coverage"} subtitle={so ? "Sawir · Telefoon · Dossier" : "Photo · Phone · Dossier"} C={C} accent={accent} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(analytics?.breakdown ?? []).map((b) => (
              <div key={b.key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: C.txtSecondary }}>{b.label}</span>
                  <span style={{ color: C.txtPrimary, fontWeight: 600 }}>{b.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: C.barTrack || hexA(accent, 0.1) }}>
                  <div style={{ width: `${b.pct}%`, height: "100%", borderRadius: 99, background: accent }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="baaris-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title={so ? "Degmooyinka" : "By district"} subtitle={so ? "Tirada muwaadiniinta" : "Citizen counts"} C={C} accent={accent} isDark={isDark}>
          <AmnigaDistrictBarChart
            data={countiesForChart}
            theme={chartTheme}
            emptyLabel={so ? "Degmo xog ah ma jirto" : "No district data"}
            valueKey="suspects"
          />
        </Panel>
        <Panel title={so ? "Xaaladaha" : "Status"} C={C} accent={accent} isDark={isDark}>
          {statusSegments.length > 0 ? (
            <HubStatusDonut
              segments={statusSegments}
              centerLabel={String(stats?.total_citizens ?? 0)}
              centerSub={so ? "Wadar" : "Total"}
              theme={chartTheme}
            />
          ) : (
            <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Xog ma jirto" : "No data"}</div>
          )}
        </Panel>
      </div>

      <div className="baaris-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginTop: 16 }}>
        <Panel title={so ? "Diiwaangeliyayaasha ugu sareeya" : "Top registrars"} C={C} accent={accent} isDark={isDark}>
          <AmnigaRegistrarBars
            rows={analytics?.top_registrars ?? []}
            theme={chartTheme}
            emptyLabel={so ? "Weli ma jiraan" : "None yet"}
          />
        </Panel>
        <Panel title={so ? "Dhaqdhaqaaqii ugu dambeeyay" : "Recent activity"} C={C} accent={accent} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(analytics?.recent_activity ?? []).length === 0 ? (
              <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Weli ma jiraan" : "No recent activity"}</div>
            ) : (
              (analytics?.recent_activity ?? []).map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                    borderBottom: `1px solid ${C.tableSep}`,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.txtPrimary, fontSize: 13, fontWeight: 600 }}>{row.name}</div>
                    <div style={{ color: C.txtMuted, fontSize: 11 }}>{row.zone} · {row.unit}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 8,
                    background: hexA(row.color, 0.15), color: row.color,
                  }}>
                    {row.kind === "wanted" ? "Wanted" : row.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
