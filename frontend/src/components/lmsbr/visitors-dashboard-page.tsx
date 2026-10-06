"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useVisitorsAnalytics, useVisitorsStats } from "@/hooks/use-visitors";
import { HubStatusDonut } from "./hubkadhigis-charts";
import {
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

type VisitReportType = "daily" | "weekly" | "monthly";

function todayInputValue() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
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

function formatVisited(iso: string | null | undefined, lang: "en" | "so") {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "so" ? "so-SO" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeVisitTime(iso: string | null | undefined, so: boolean) {
  if (!iso) return "—";
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return so ? "Hadda" : "Just now";
  if (minutes < 60) return so ? `${minutes} daqiiqo ka hor` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return so ? `${hours} saac ka hor` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return so ? `${days} maalin ka hor` : `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return so ? `${weeks} isbuuc ka hor` : `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return so ? `${months} bil ka hor` : `${months} month${months === 1 ? "" : "s"} ago`;
}

export function VisitorsDashboardPage({
  C,
  accent,
  isDark,
  moduleName,
  moduleTagline,
  onViewAll,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName: string;
  moduleTagline: string;
  onViewAll?: () => void;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const [reportType, setReportType] = useState<VisitReportType>("daily");
  const [reportDate, setReportDate] = useState(todayInputValue);
  const { data: stats, isLoading: statsLoading } = useVisitorsStats(true);
  const reportRange = reportType === "daily" ? "1d" : reportType === "weekly" ? "7d" : "30d";
  const { data: analytics, isLoading: analyticsLoading } = useVisitorsAnalytics(reportRange, reportDate, true);

  const kpiDefs = useMemo(() => [
    { icon: "users", label: so ? "Wadarta booqdayaasha" : "Total visitors", value: stats?.total ?? 0, delta: null as null | { pct: number; up: boolean }, color: accent },
    { icon: "clock", label: so ? "Booqday maanta" : "Visited today", value: stats?.today ?? 0, delta: stats?.deltas?.today ?? null, color: "#46c08a" },
    { icon: "check", label: so ? "La xaqiijiyey" : "Verified", value: stats?.verified ?? 0, delta: null, color: "#1877F2" },
    { icon: "users", label: so ? "Sawir leh" : "With photo", value: stats?.with_photo ?? 0, delta: null, color: "#e6b25c" },
  ], [stats, so]);

  const kpiVals = useKpiCounter(kpiDefs.map((k) => k.value));
  const loading = statsLoading || analyticsLoading;
  const total = stats?.total ?? 0;
  const verifiedPct = total ? Math.round(((stats?.verified ?? 0) / total) * 100) : 0;

  const chartTheme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack,
  };

  const statusSegments = (analytics?.status_breakdown ?? []).map((s) => ({
    label: s.label === "Verified"
      ? (so ? "Verified" : "Verified")
      : (so ? "Pending" : "Pending"),
    pct: s.pct,
    color: s.color,
    count: s.count,
  }));

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
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
            {so ? "Bogga Hore — Booqdeyaal" : "Visitors Dashboard"}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0" }}>{moduleTagline}</p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            style={{
              padding: "10px 14px", borderRadius: 10, border: `1px solid ${hexA(accent, 0.35)}`,
              background: hexA(accent, isDark ? 0.14 : 0.08), color: accent, cursor: "pointer",
              fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13,
            }}
          >
            {so ? "Eeg liiska" : "View list"}
          </button>
        )}
      </div>

      <div style={{
        marginBottom: 16, padding: "15px 18px", borderRadius: 14,
        background: `linear-gradient(110deg,${hexA(accent, isDark ? 0.2 : 0.1)},${C.cardBg})`,
        border: `1px solid ${hexA(accent, 0.22)}`, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            color: accent, background: hexA(accent, 0.14),
          }}>
            <Icon name="chart" size={18} sw={2} />
          </div>
          <div>
            <div style={{ color: C.txtPrimary, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-outfit)" }}>
              {so ? "Soo koobidda maanta" : "Today's summary"}
            </div>
            <div style={{ marginTop: 2, color: C.txtMuted, fontSize: 12.5 }}>
              {so ? "Xogta muhiimka ah ee diiwaangelinta booqdayaasha" : "Key visitor registration information"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, fontFamily: "var(--font-outfit)" }}>
          <span style={{ color: C.txtSecondary }}><strong style={{ color: "#46c08a" }}>{stats?.today ?? 0}</strong> {so ? "maanta" : "today"}</span>
          <span style={{ color: C.txtSecondary }}><strong style={{ color: "#1877F2" }}>{verifiedPct}%</strong> {so ? "xaqiijisan" : "verified"}</span>
          <span style={{ color: C.txtSecondary }}><strong style={{ color: accent }}>{stats?.this_week ?? 0}</strong> {so ? "todobaadkan" : "this week"}</span>
          <span style={{ color: C.txtSecondary }}><strong style={{ color: "#e6b25c" }}>{stats?.with_nira ?? 0}</strong> NIRA</span>
        </div>
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
                background: `linear-gradient(90deg,${k.color},${hexA(k.color, 0.4)})`,
              }} />
            )}
            <div style={{
              width: 46, height: 46, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(k.color, 0.14), color: k.color, border: `1px solid ${hexA(k.color, 0.25)}`,
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

      <div className="visitors-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel
          title={so ? "Booqashooyinka" : "Visits"}
          subtitle={so
            ? (reportType === "daily" ? "Hal maalin" : reportType === "weekly" ? "7 maalmood" : "30 maalmood")
            : (reportType === "daily" ? "Daily report" : reportType === "weekly" ? "Weekly report" : "Monthly report")}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".09em", color: C.txtMuted, textTransform: "uppercase", marginBottom: 7 }}>
                {so ? "Nooca warbixinta" : "Report type"}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {([
                  ["daily", so ? "Maalinle" : "Daily"],
                  ["weekly", so ? "Toddobaadle" : "Weekly"],
                  ["monthly", so ? "Bille" : "Monthly"],
                ] as const).map(([value, label]) => {
                  const active = reportType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReportType(value)}
                      style={{
                        padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-outfit)",
                        fontSize: 12.5, fontWeight: 700, border: `1px solid ${active ? hexA(accent, 0.65) : C.cardBdr}`,
                        background: active ? hexA(accent, isDark ? 0.25 : 0.12) : C.cardBg,
                        color: active ? accent : C.txtSecondary,
                      }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "grid", gap: 7 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".09em", color: C.txtMuted, textTransform: "uppercase" }}>
                {so ? "Taariikhda" : "Date"}
              </span>
              <input
                type="date"
                value={reportDate}
                max={todayInputValue()}
                onChange={(event) => setReportDate(event.target.value)}
                style={{
                  minHeight: 35, padding: "6px 10px", borderRadius: 9, border: `1px solid ${C.inputBdr}`,
                  background: C.cardBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 12.5,
                }}
              />
            </label>
          </div>
          <AmnigaWeeklyChart
            bars={(analytics?.weekly_trend ?? []).map((d) => d.count)}
            labels={(analytics?.weekly_trend ?? []).map((d) => d.label)}
            theme={chartTheme}
          />
        </Panel>
        <Panel
          title={so ? "Xaaladda verified" : "Verification status"}
          subtitle={so ? "Verified vs pending" : "Verified vs pending"}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          {statusSegments.length > 0 ? (
            <HubStatusDonut
              segments={statusSegments}
              centerLabel={String(stats?.total ?? 0)}
              centerSub={so ? "Wadar" : "Total"}
              theme={chartTheme}
            />
          ) : (
            <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Xog ma jirto" : "No data"}</div>
          )}
        </Panel>
      </div>

      <div className="visitors-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginTop: 16 }}>
        <Panel
          title={so ? "Booqdayaasha ugu badan" : "Most frequent visitors"}
          subtitle={so ? "Tirada booqashooyinka qof kasta" : "Ranked by number of visits"}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          <AmnigaRegistrarBars
            rows={(analytics?.top_visitors ?? []).map((row) => ({
              name: row.name,
              total: row.count,
            }))}
            theme={chartTheme}
            emptyLabel={so ? "Weli booqasho lama diiwaangelin" : "No visits recorded yet"}
          />
        </Panel>
        <Panel
          title={so ? "Qaybaha ugu badan ee la booqdo" : "Most visited destinations"}
          subtitle={so ? "Meelaha ay booqdayaashu ugu badan yihiin" : "Destinations ranked by visits"}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          <AmnigaRegistrarBars
            rows={(analytics?.top_destinations ?? []).map((row) => ({
              name: row.name,
              total: row.count,
            }))}
            theme={chartTheme}
            emptyLabel={so ? "Weli meel lama diiwaangelin" : "No destinations recorded yet"}
          />
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel
          title={so ? "Booqashooyinkii ugu dambeeyay" : "Recent visitors"}
          subtitle={so ? "Waxaa loo kala saaray waqtiga booqashada" : "Ordered by latest visit time"}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(analytics?.recent_activity ?? []).length === 0 ? (
              <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Weli ma jiraan" : "No recent activity"}</div>
            ) : (
              (analytics?.recent_activity ?? []).map((row) => (
                <div
                  key={row.id}
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
                    <div style={{ color: C.txtMuted, fontSize: 11 }}>
                      {(row.phone || "—") + (row.nira ? ` · ${row.nira}` : "")}
                      {row.registered_by ? ` · ${so ? "Diiwaangeliyey" : "Registered by"}: ${row.registered_by}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.txtSecondary, fontWeight: 600 }}>{formatVisited(row.visited_at, lang)}</div>
                    <div style={{ fontSize: 10.5, color: accent, fontWeight: 600, marginTop: 2 }}>{relativeVisitTime(row.visited_at, so)}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 8,
                      background: hexA(row.color, 0.15), color: row.color,
                    }}>
                      {row.verified ? "Verified" : (so ? "Pending" : "Pending")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
