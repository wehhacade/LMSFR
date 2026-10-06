"use client";

import type { ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useDhacdooyinkaAnalytics } from "@/hooks/use-dhacdooyinka";
import { ShimmerBlock, ShimmerSuspectList } from "./shimmer";
import { HubDashboardInsightGrid, HubWeeklyChart } from "./hubkadhigis-charts";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors;

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
  children: ReactNode;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  action?: ReactNode;
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
      <div style={{ padding: "20px 22px", flex: 1 }}>{children}</div>
    </div>
  );
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const COVERAGE_LABELS: Record<string, keyof ReturnType<typeof getDict>> = {
  "With victims": "dhacdoDashWithVictims",
  "With documents": "dhacdoDashWithDocs",
  "With GPS": "dhacdoDashWithGps",
};

export function DhacdooyinkaDashboardPage({
  C,
  accent,
  isDark,
  moduleName,
  moduleTagline,
  onViewAllEvents,
  onOpenEvent,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName: string;
  moduleTagline: string;
  onViewAllEvents: () => void;
  onOpenEvent: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data, isLoading } = useDhacdooyinkaAnalytics();

  const chartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
  };

  const kpis = [
    { label: t.dhacdoDashTotal, value: data?.total ?? 0, icon: "calendar" as const },
    { label: t.dhacdoDashThisMonth, value: data?.this_month ?? 0, icon: "clock" as const },
    { label: t.dhacdoDashVictims, value: data?.victims_total ?? 0, icon: "users" as const },
    { label: t.dhacdoDashCasualties, value: data?.casualties ?? 0, icon: "alert" as const },
  ];

  const secondary = [
    { label: t.dhacdoDashDeaths, value: data?.deaths ?? 0, color: "#dc2626" },
    { label: t.dhacdoDashInjuries, value: data?.injuries ?? 0, color: "#2563eb" },
    { label: t.dhacdoDashThisWeek, value: data?.this_week ?? 0, color: accent },
    { label: t.dhacdoDashSections, value: data?.sections_total ?? 0, color: "#059669" },
    { label: t.dhacdoDashTypes, value: data?.types_total ?? 0, color: "#7c3aed" },
  ];

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div
        className="hub-compact-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: accent,
              boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
            }} />
            <span style={{
              fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
              color: accent, fontWeight: 600, fontFamily: "var(--font-outfit)",
            }}>
              {moduleName}
            </span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-cinzel)",
            fontWeight: 600,
            fontSize: "clamp(22px, 2.8vw, 30px)",
            color: C.txtPrimary,
            margin: 0,
            lineHeight: 1.15,
          }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>
            {moduleTagline}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAllEvents}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px",
            borderRadius: 10, border: `1px solid ${C.inputBdr}`,
            background: C.inputBg, color: C.txtSecondary,
            fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}
        >
          {t.dhacdoDashViewAll}
          <Icon name="arrow" size={14} sw={2} />
        </button>
      </div>

      {/* Primary KPIs */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        marginBottom: 16,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`,
            borderRadius: "14px 14px 0 0",
          }} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {isLoading || !data ? kpis.map((_, i) => (
            <div key={i} style={{ padding: "20px 22px", borderRight: i < kpis.length - 1 ? `1px solid ${C.tableSep}` : undefined }}>
              <ShimmerBlock w={46} h={46} radius={13} />
              <div style={{ marginTop: 18 }}><ShimmerBlock h={34} radius={8} /></div>
              <div style={{ marginTop: 10 }}><ShimmerBlock w="70%" h={13} radius={5} /></div>
            </div>
          )) : kpis.map((k, i) => (
            <div
              key={k.label}
              style={{
                padding: "22px 20px",
                borderRight: i < kpis.length - 1 ? `1px solid ${C.tableSep}` : undefined,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(accent, 0.14), color: accent,
                border: `1px solid ${hexA(accent, 0.25)}`,
              }}>
                <Icon name={k.icon} size={22} sw={1.8} />
              </div>
              <div style={{
                fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 34,
                color: C.txtPrimary, marginTop: 18, lineHeight: 1,
              }}>
                {k.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8, letterSpacing: ".02em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary stats strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}>
        {secondary.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: C.panelBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.panelShadow,
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
              color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 6,
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 24,
              color: s.color, lineHeight: 1,
            }}>
              {isLoading ? "—" : s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly trend + coverage */}
      <div className="dhacdo-dash-grid-2" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)",
        gap: 16,
        marginBottom: 16,
      }}>
        <Panel title={t.dhacdoDashWeekly} subtitle={t.dhacdoDashThisWeek} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={220} radius={10} />
          ) : (
            <HubWeeklyChart
              bars={data.weekly_trend.map((p) => p.count)}
              labels={data.weekly_trend.map((p) => p.label)}
              theme={chartTheme}
            />
          )}
        </Panel>

        <Panel title={t.dhacdoDashCoverage} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={180} radius={10} />
          ) : data.coverage.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: C.txtMuted, fontSize: 14 }}>
              {t.dhacdoDashNoData}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {data.coverage.map((item) => {
                const labelKey = COVERAGE_LABELS[item.label];
                const label = labelKey ? t[labelKey] : item.label;
                return (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
                      <span style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{label}</span>
                      <span style={{ color: item.color, fontWeight: 600, fontFamily: "var(--font-outfit)" }}>
                        {item.count} · {item.pct}%
                      </span>
                    </div>
                    <div style={{
                      height: 8, borderRadius: 6,
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(75,85,99,0.12)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 6, width: `${item.pct}%`,
                        background: `linear-gradient(90deg, ${hexA(item.color, 0.55)}, ${item.color})`,
                        transition: "width 1s cubic-bezier(.2,.7,.2,1)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Breakdown grids */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}>
        <Panel title={t.dhacdoDashByType} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={160} radius={10} />
          ) : (
            <HubDashboardInsightGrid
              data={data.by_event_type}
              theme={chartTheme}
              emptyLabel={t.dhacdoDashNoData}
            />
          )}
        </Panel>

        <Panel title={t.dhacdoDashByRegion} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={160} radius={10} />
          ) : (
            <HubDashboardInsightGrid
              data={data.by_region}
              theme={chartTheme}
              emptyLabel={t.dhacdoDashNoData}
            />
          )}
        </Panel>

        <Panel title={t.dhacdoDashByPerpetrator} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={160} radius={10} />
          ) : (
            <HubDashboardInsightGrid
              data={data.by_perpetrator}
              theme={chartTheme}
              emptyLabel={t.dhacdoDashNoData}
            />
          )}
        </Panel>

        <Panel title={t.dhacdoDashVictimsGender} C={C} accent={accent} isDark={isDark}>
          {isLoading || !data ? (
            <ShimmerBlock h={160} radius={10} />
          ) : (
            <HubDashboardInsightGrid
              data={data.victims_by_gender}
              theme={chartTheme}
              emptyLabel={t.dhacdoDashNoData}
            />
          )}
        </Panel>
      </div>

      {/* Recent events */}
      <Panel
        title={t.dhacdoDashRecent}
        subtitle={isLoading ? "…" : `${data?.total ?? 0} ${t.dhacdoDashTotal.toLowerCase()}`}
        C={C}
        accent={accent}
        isDark={isDark}
        action={(
          <button
            type="button"
            onClick={onViewAllEvents}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${C.inputBdr}`,
              background: C.inputBg,
              color: C.txtSecondary,
              fontFamily: "var(--font-outfit)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.dhacdoDashViewAll}
            <Icon name="arrow" size={13} sw={2.1} />
          </button>
        )}
      >
        {isLoading ? (
          <ShimmerSuspectList rows={4} />
        ) : !data?.recent.length ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: C.txtMuted, fontSize: 14, fontFamily: "var(--font-outfit)" }}>
            {t.dhacdoDashNoData}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead }}>
                  {[t.dhacdoColTx, t.dhacdoColWaaxda, t.dhacdoNoocaType, t.dhacdoColVictims, t.dhacdoDhimasho, t.dhacdoDhaawac, t.dhacdoColDate].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 600,
                        letterSpacing: ".06em", textTransform: "uppercase", color: C.txtMuted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderTop: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                    onClick={() => onOpenEvent(row.id)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px", fontSize: 13, fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>
                      {row.tixraac_lambar || "—"}
                    </td>
                    <td style={{ padding: "14px", fontSize: 13, color: C.txtSecondary, maxWidth: 200 }}>
                      {row.location_display}
                    </td>
                    <td style={{ padding: "14px", fontSize: 13, color: C.txtSecondary }}>
                      {row.nooca_dhacdada_name || "—"}
                    </td>
                    <td style={{ padding: "14px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", minWidth: 28, justifyContent: "center",
                        padding: "3px 10px", borderRadius: 8,
                        background: hexA(accent, 0.12), color: accent, fontSize: 12, fontWeight: 600,
                      }}>
                        {row.victim_count}
                      </span>
                    </td>
                    <td style={{ padding: "14px", fontSize: 13, color: C.txtPrimary, textAlign: "center" }}>
                      {row.dhimasho ?? "0"}
                    </td>
                    <td style={{ padding: "14px", fontSize: 13, color: C.txtPrimary, textAlign: "center" }}>
                      {row.dhaawac ?? "0"}
                    </td>
                    <td style={{ padding: "14px", fontSize: 12, color: C.txtMuted, whiteSpace: "nowrap" }}>
                      {formatShortDate(row.date_recorded)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
