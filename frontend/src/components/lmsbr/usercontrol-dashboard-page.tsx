"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useUserControlDashboard } from "@/hooks/use-accounts";
import { HubStatusDonut } from "./hubkadhigis-charts";
import { AmnigaWeeklyChart, type AmnigaChartTheme } from "./amniga-charts";
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
      borderRadius: 14, overflow: "hidden", background: C.panelBg,
      border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, minWidth: 0,
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: `1px solid ${C.tableSep}`,
        background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

function timeAgo(iso: string | null, so: boolean): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return so ? "hadda" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return so ? `${min} daqiiqo` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return so ? `${hr} saac` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return so ? `${d} maalin` : `${d}d ago`;
}

function LinkBtn({
  label, onClick, accent, isDark,
}: { label: string; onClick: () => void; accent: string; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 9, cursor: "pointer",
        border: `1px solid ${hexA(accent, isDark ? 0.35 : 0.28)}`,
        background: hexA(accent, isDark ? 0.12 : 0.08),
        color: accent, fontFamily: "var(--font-outfit)", fontSize: 12.5, fontWeight: 600,
      }}
    >
      {label}
      <Icon name="arrow" size={13} sw={2.1} />
    </button>
  );
}

export function UserControlDashboardPage({
  C,
  accent,
  isDark,
  moduleName,
  moduleTagline,
  onNavigate,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName: string;
  moduleTagline: string;
  onNavigate?: (menuId: string) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const { data, isLoading } = useUserControlDashboard(true);

  const chartTheme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack,
  };

  const roleLabels: Record<string, string> = {
    admin: t.ucAdmins,
    officer: t.ucOfficers,
    agent: t.agentsTitle,
    user: t.ucKpiUsers,
  };

  const kpis = useMemo(() => {
    const u = data?.users;
    const a = data?.audit;
    return [
      { icon: "users" as const, label: t.ucKpiUsers, value: u?.total ?? 0 },
      { icon: "check" as const, label: t.ucKpiActive, value: u?.active ?? 0 },
      { icon: "badge" as const, label: t.ucKpiLogins, value: a?.logins_today ?? 0 },
    ];
  }, [data, t]);

  const kpiVals = useKpiCounter(kpis.map((k) => k.value));

  const weeklyBars = data?.weekly_logins.map((p) => p.count) ?? [0, 0, 0, 0, 0, 0, 0];
  const dayLabels = so
    ? ["Isn", "Tal", "Arb", "Kha", "Jim", "Sab", "Axd"]
    : (data?.weekly_logins.map((p) => p.label.slice(0, 3)) ?? ["M", "T", "W", "T", "F", "S", "S"]);

  const roleSegments = (data?.role_breakdown ?? []).map((s) => ({
    label: roleLabels[s.key] ?? s.label,
    pct: s.pct,
    color: s.color,
    count: s.count,
  }));

  const healthRows = [
    { label: t.ucHealthActive, pct: data?.quick_stats.active_pct ?? 0, color: "#46c08a" },
    { label: t.ucHealthMobile, pct: data?.quick_stats.mobile_pct ?? 0, color: accent },
    { label: t.ucHealthStaff, pct: data?.quick_stats.staff_pct ?? 0, color: "#f0a04a" },
    { label: t.ucHealthSusp, pct: data?.quick_stats.suspended_pct ?? 0, color: "#e0655a" },
  ];

  const sideStats = [
    { label: t.ucAdmins, value: data?.users.admins ?? 0 },
    { label: t.ucOfficers, value: data?.users.officers ?? 0 },
    { label: t.ucSuspended, value: data?.users.suspended ?? 0 },
    { label: t.ucNeverLogin, value: data?.users.never_login ?? 0 },
    { label: t.ucJoinedWeek, value: data?.users.joined_week ?? 0 },
    { label: t.ucMobileUsers, value: data?.users.mobile ?? 0 },
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
            {t.ucDashTitle}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>
            {t.ucDashSub || moduleTagline}
          </p>
        </div>
        {onNavigate && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LinkBtn label={t.ucViewUsers} onClick={() => onNavigate("ucusers")} accent={accent} isDark={isDark} />
            <LinkBtn label={t.ucViewAudit} onClick={() => onNavigate("audittrails")} accent={accent} isDark={isDark} />
            <LinkBtn label={t.ucViewErrors} onClick={() => onNavigate("errorlogs")} accent={accent} isDark={isDark} />
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              position: "relative", overflow: "hidden", padding: "18px 16px", borderRadius: 14,
              background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
              animation: `is-fadeUp .5s ease both`, animationDelay: `${0.04 + i * 0.05}s`,
            }}
          >
            {!isDark && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg,${accent},${hexA(accent, 0.4)})`,
              }} />
            )}
            <div style={{
              width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.14), color: accent, border: `1px solid ${hexA(accent, 0.25)}`,
            }}>
              <Icon name={k.icon} size={18} sw={1.8} />
            </div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 28, color: C.txtPrimary, marginTop: 14, lineHeight: 1 }}>
              {isLoading ? "—" : kpiVals[i].toLocaleString()}
            </div>
            <div style={{ fontSize: 12.5, color: C.txtMuted, marginTop: 7 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="uc-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title={t.ucWeeklyLogins} subtitle={t.ucWeeklySub} C={C} accent={accent} isDark={isDark}>
          <AmnigaWeeklyChart bars={weeklyBars} labels={dayLabels} theme={chartTheme} />
          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", fontSize: 12.5, color: C.txtMuted }}>
            <span>{so ? "Toddobaadka" : "This week"}: <strong style={{ color: C.txtPrimary }}>{(data?.audit.logins_week ?? 0).toLocaleString()}</strong></span>
            <span>{so ? "Wadarta audit" : "Total audits"}: <strong style={{ color: C.txtPrimary }}>{(data?.audit.total_audits ?? 0).toLocaleString()}</strong></span>
          </div>
        </Panel>
        <Panel title={t.ucRoleMix} subtitle={t.ucRoleSub} C={C} accent={accent} isDark={isDark}>
          {roleSegments.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: C.txtMuted, fontSize: 13 }}>{t.ucNoData}</div>
          ) : (
            <HubStatusDonut
              segments={roleSegments}
              centerLabel={(data?.users.total ?? 0).toLocaleString()}
              centerSub={t.ucKpiUsers}
              theme={{
                accent,
                isDark,
                tableSep: C.tableSep,
                txtMuted: C.txtMuted,
                txtPrimary: C.txtPrimary,
                txtSecondary: C.txtSecondary,
              }}
            />
          )}
        </Panel>
      </div>

      {/* Health + event breakdown + side stats */}
      <div className="uc-dash-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title={t.ucHealth} C={C} accent={accent} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {healthRows.map((row) => (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: C.txtSecondary }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 600 }}>{row.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: C.barTrack, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 6, width: `${Math.min(100, row.pct)}%`,
                    background: `linear-gradient(90deg,${hexA(row.color, 0.55)},${row.color})`,
                    transition: "width 1s cubic-bezier(.2,.7,.2,1)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t.ucEventMix} subtitle={t.ucEventSub} C={C} accent={accent} isDark={isDark}>
          {(data?.event_breakdown.length ?? 0) === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: C.txtMuted, fontSize: 13 }}>{t.ucNoData}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(data?.event_breakdown ?? []).slice(0, 6).map((ev) => (
                <div key={ev.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: C.txtSecondary }}>{ev.label}</span>
                    <span style={{ color: C.txtMuted }}>{ev.count.toLocaleString()} · {ev.pct}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 6, background: C.barTrack, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${Math.min(100, ev.pct)}%`, borderRadius: 6,
                      background: ev.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={so ? "Tirakoobyada" : "Roster snapshot"}
          C={C}
          accent={accent}
          isDark={isDark}
          action={onNavigate ? <LinkBtn label={t.ucViewGroups} onClick={() => onNavigate("ucgroups")} accent={accent} isDark={isDark} /> : undefined}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {sideStats.map((s) => (
              <div key={s.label} style={{
                padding: "12px 12px", borderRadius: 10,
                background: isDark ? hexA(accent, 0.06) : "#F8FAFC",
                border: `1px solid ${C.tableSep}`,
              }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 20, color: C.txtPrimary }}>
                  {isLoading ? "—" : s.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Tables */}
      <div className="uc-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel
          title={t.ucRecentLogins}
          C={C}
          accent={accent}
          isDark={isDark}
          action={onNavigate ? <LinkBtn label={t.ucViewAudit} onClick={() => onNavigate("audittrails")} accent={accent} isDark={isDark} /> : undefined}
        >
          {(data?.recent_logins.length ?? 0) === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.txtMuted }}>{t.ucNoData}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(data?.recent_logins ?? []).map((row, i) => (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "12px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${C.tableSep}`,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.txtPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.user}
                    </div>
                    <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{row.county || "—"}</span>
                      <span>·</span>
                      <span>{row.os !== "—" ? row.os : row.browser}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{
                      display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                      background: row.channel === "mobile" ? hexA("#46c08a", 0.14) : hexA(accent, 0.12),
                      color: row.channel === "mobile" ? (isDark ? "#46c08a" : "#059669") : accent,
                    }}>
                      {row.channel === "mobile" ? t.ucChannelApp : t.ucChannelWeb}
                    </span>
                    <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 5 }}>{timeAgo(row.created_at, so)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t.ucTopUsers} C={C} accent={accent} isDark={isDark}>
          {(data?.top_active_users.length ?? 0) === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.txtMuted }}>{t.ucNoData}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(data?.top_active_users ?? []).map((u, i) => {
                const max = data?.top_active_users[0]?.count ?? 1;
                const pct = Math.round((u.count / max) * 100);
                return (
                  <div key={u.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: C.txtPrimary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: C.txtMuted, marginRight: 6 }}>{i + 1}.</span>
                        {u.name}
                      </span>
                      <span style={{ fontSize: 12, color: C.txtMuted, flexShrink: 0 }}>
                        {u.count.toLocaleString()} {t.ucActions}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 5, background: C.barTrack, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: 5,
                        background: `linear-gradient(90deg,${hexA(accent, 0.5)},${accent})`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="uc-dash-grid-2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel
          title={t.ucRecentAudits}
          C={C}
          accent={accent}
          isDark={isDark}
          action={onNavigate ? <LinkBtn label={t.ucViewAudit} onClick={() => onNavigate("audittrails")} accent={accent} isDark={isDark} /> : undefined}
        >
          {(data?.recent_audits.length ?? 0) === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.txtMuted }}>{t.ucNoData}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: C.txtMuted, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>
                    <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>{so ? "Isticmaale" : "User"}</th>
                    <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>{so ? "Ficil" : "Action"}</th>
                    <th style={{ padding: "0 0 10px 8px", fontWeight: 600 }}>{so ? "Waqti" : "When"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_audits ?? []).map((row) => (
                    <tr key={row.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={{ padding: "11px 8px 11px 0", color: C.txtPrimary, fontWeight: 500, whiteSpace: "nowrap" }}>{row.user}</td>
                      <td style={{ padding: "11px 8px", color: C.txtSecondary, maxWidth: 280 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.action}</div>
                        <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 2 }}>{row.module} · {row.event_type}</div>
                      </td>
                      <td style={{ padding: "11px 0 11px 8px", color: C.txtMuted, whiteSpace: "nowrap" }}>{timeAgo(row.created_at, so)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title={t.ucRecentErrors}
          C={C}
          accent={accent}
          isDark={isDark}
          action={onNavigate ? <LinkBtn label={t.ucViewErrors} onClick={() => onNavigate("errorlogs")} accent={accent} isDark={isDark} /> : undefined}
        >
          {(data?.recent_errors.length ?? 0) === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.txtMuted }}>{t.ucNoData}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(data?.recent_errors ?? []).map((err, i) => (
                <div
                  key={err.id}
                  style={{
                    padding: "12px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${C.tableSep}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e0655a" : "#dc2626", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {err.expected_error || "Error"}
                    </span>
                    {err.status_code != null && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.txtMuted, flexShrink: 0 }}>{err.status_code}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {err.path}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 4 }}>
                    {err.user} · {timeAgo(err.created_at, so)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .uc-dash-grid-3, .uc-dash-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
