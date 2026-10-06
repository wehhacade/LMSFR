"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { formatRecordDate, recordStatus } from "@/lib/record-display";
import { Icon } from "./icon";
import { useDisarmamentRecords, useDisarmamentStats, useHubkadhigisAnalytics } from "@/hooks/use-hubkadhigis";
import { ShimmerBlock, ShimmerSuspectList } from "./shimmer";
import { HubkadhigisFormModal } from "./hubkadhigis-form-modal";
import { HubDashboardInsightGrid, HubStatusDonut, HubWeeklyChart } from "./hubkadhigis-charts";
import { usePermissions } from "@/hooks/use-permissions";
import type { AccountsThemeColors } from "./accounts-shared";

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
};

function HubPanel({
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

function StatusPill({ status, t }: { status: ReturnType<typeof recordStatus>; t: ReturnType<typeof getDict> }) {
  const handed = status === "handed_over";
  const color = handed ? "#059669" : "#C69049";
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color, fontFamily: "var(--font-outfit)", whiteSpace: "nowrap" }}>
      {handed ? t.hubStatusHandedOver : t.hubStatusRegistered}
    </span>
  );
}

export function HubkadhigisDashboardPage({
  C,
  accent,
  isDark,
  moduleName,
  moduleTagline,
  onViewAllRecords,
  onOpenRecord,
  registerAddAction,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName: string;
  moduleTagline: string;
  onViewAllRecords: () => void;
  onOpenRecord: (id: number) => void;
  registerAddAction?: (fn: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { canAdd } = usePermissions();
  const allowAdd = canAdd("records");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: stats } = useDisarmamentStats();
  const { data: analytics, isLoading: analyticsLoading } = useHubkadhigisAnalytics();
  const { data, isLoading: recordsLoading } = useDisarmamentRecords({ page: 1, search: "" });

  useEffect(() => {
    registerAddAction?.(() => setModalOpen(true));
  }, [registerAddAction]);

  const records = data?.results ?? [];
  const latest = records.slice(0, 4);
  const chartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
  };

  const handedSegment = analytics?.status_breakdown.find(s => s.label === "Handed over");
  const handedPct = handedSegment?.pct ?? 0;

  const kpis = [
    { label: t.hubTotal, value: stats?.total ?? 0, icon: "archive" as const },
    { label: t.hubThisMonth, value: stats?.this_month ?? 0, icon: "calendar" as const },
    { label: t.hubWithWeapon, value: stats?.with_weapon ?? 0, icon: "target" as const },
    { label: t.hubWithImages, value: stats?.with_images ?? 0, icon: "clipboard" as const },
  ];

  return (
    <>
      <HubkadhigisFormModal open={modalOpen} onClose={() => setModalOpen(false)} editId={null} C={C} accent={accent} />
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
          {allowAdd && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px",
                borderRadius: 10, border: isDark ? `1px solid ${hexA(accent, 0.4)}` : "none",
                background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.65)})`,
                color: "#fff", fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14,
                cursor: "pointer",
                boxShadow: isDark ? `0 12px 28px -12px ${hexA(accent, 0.42)}` : `0 4px 14px -4px ${hexA(accent, 0.45)}`,
                transition: ".3s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              <Icon name="plus" size={17} sw={2} />
              {t.hubAddRecord}
            </button>
          )}
        </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {!stats ? kpis.map((_, i) => (
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
                <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8, letterSpacing: ".02em" }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hub-dash-grid-2" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}>
          <HubPanel title={t.hubWeeklyTrend} subtitle="Last 7 days" C={C} accent={accent} isDark={isDark}>
            {analyticsLoading || !analytics ? (
              <ShimmerBlock h={220} radius={10} />
            ) : (
              <HubWeeklyChart
                bars={analytics.weekly_trend.map(p => p.count)}
                labels={analytics.weekly_trend.map(p => p.label)}
                theme={chartTheme}
              />
            )}
          </HubPanel>

          <HubPanel title={t.hubStatusBreakdown} C={C} accent={accent} isDark={isDark}>
            {analyticsLoading || !analytics ? (
              <ShimmerBlock h={180} radius={10} />
            ) : (
              <HubStatusDonut
                segments={analytics.status_breakdown.map(s => ({
                  label: s.label === "Handed over" ? t.hubStatusHandedOver : t.hubStatusRegistered,
                  pct: s.pct,
                  color: s.color,
                  count: s.count,
                }))}
                centerLabel={`${handedPct}%`}
                centerSub={t.hubHandedOverShare}
                theme={chartTheme}
              />
            )}
          </HubPanel>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}>
          <HubPanel title={t.hubByWeaponType} C={C} accent={accent} isDark={isDark}>
            {analyticsLoading || !analytics ? (
              <ShimmerBlock h={160} radius={10} />
            ) : (
              <HubDashboardInsightGrid
                data={analytics.by_weapon_type}
                theme={chartTheme}
                emptyLabel={t.hubNoResults}
              />
            )}
          </HubPanel>

          <HubPanel title={t.hubByForceUnit} C={C} accent={accent} isDark={isDark}>
            {analyticsLoading || !analytics ? (
              <ShimmerBlock h={160} radius={10} />
            ) : (
              <HubDashboardInsightGrid
                data={analytics.by_force_unit}
                theme={chartTheme}
                emptyLabel={t.hubNoResults}
              />
            )}
          </HubPanel>
        </div>

        <HubPanel
          title={t.hubLatestActivity}
          subtitle={recordsLoading ? "…" : `${data?.count ?? 0} records in registry`}
          C={C}
          accent={accent}
          isDark={isDark}
          action={(
            <button
              type="button"
              onClick={onViewAllRecords}
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
              {t.hubViewAllRecords}
              <Icon name="arrow" size={13} sw={2.1} />
            </button>
          )}
        >
          {recordsLoading ? (
            <ShimmerSuspectList rows={3} />
          ) : latest.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: C.txtMuted, fontSize: 14, fontFamily: "var(--font-outfit)" }}>
              {t.hubNoResults}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {latest.map((r, i) => {
                const status = recordStatus(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpenRecord(r.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                      padding: "14px 4px",
                      border: "none",
                      borderTop: i === 0 ? "none" : `1px solid ${C.tableSep}`,
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background .2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: hexA(accent, 0.12), color: accent,
                    }}>
                      <Icon name="archive" size={18} sw={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>
                        {r.person_name}
                      </div>
                      <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)" }}>
                        {r.reference_number}
                        {r.weapon_type_name ? ` · ${r.weapon_type_name}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                        {formatRecordDate(r.surrender_date ?? r.created_at) ?? "—"}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <StatusPill status={status} t={t} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </HubPanel>
      </div>
    </>
  );
}
