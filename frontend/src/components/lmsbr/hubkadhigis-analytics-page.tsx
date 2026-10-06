"use client";

import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { useDisarmamentStats, useHubkadhigisAnalytics } from "@/hooks/use-hubkadhigis";
import { ShimmerBlock } from "./shimmer";
import { Icon } from "./icon";
import {
  HubAnalyticsKpiGrid,
  HubAnalyticsShell,
  HubAnalyticsStatusPanel,
  HubAnalyticsTrendChart,
  HubRankedDistribution,
  buildHubAnalyticsTheme,
} from "./hubkadhigis-analytics-charts";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors & {
  cardBdr: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  txtMuted: string;
  txtSecondary: string;
  txtPrimary: string;
};

export function HubkadhigisAnalyticsPage({
  C,
  accent,
  isDark,
  moduleName,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName?: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: stats, isLoading: statsLoading } = useDisarmamentStats();
  const { data: analytics, isLoading } = useHubkadhigisAnalytics();

  const analyticsAccent = isDark ? "#a5b4fc" : "#4f46e5";
  const theme = buildHubAnalyticsTheme(analyticsAccent, isDark, C);

  const handedSegment = analytics?.status_breakdown.find((s) => s.label === "Handed over");
  const handedPct = handedSegment?.pct ?? 0;

  const kpis = [
    { label: t.hubTotal, value: stats?.total ?? 0, icon: "archive", hint: "Registry volume" },
    { label: t.hubThisMonth, value: stats?.this_month ?? 0, icon: "calendar", hint: "New this month" },
    { label: t.hubWithWeapon, value: stats?.with_weapon ?? 0, icon: "target", hint: "Weapon assigned" },
    { label: t.hubWithImages, value: stats?.with_images ?? 0, icon: "grid", hint: "Photo evidence" },
  ];

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        marginBottom: 18,
        padding: "26px 28px",
        background: isDark
          ? `linear-gradient(135deg, ${theme.ink} 0%, ${hexA(theme.inkSoft, 0.95)} 55%, ${hexA(analyticsAccent, 0.18)} 100%)`
          : `linear-gradient(135deg, #1e1b4b 0%, #4338ca 48%, ${hexA(accent, 0.85)} 100%)`,
        color: "#fff",
        boxShadow: isDark ? "0 24px 60px -28px rgba(0,0,0,0.65)" : "0 20px 50px -24px rgba(67,56,202,0.45)",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.12,
          backgroundImage: "radial-gradient(circle at 20% 20%, #fff 0, transparent 35%), radial-gradient(circle at 80% 0%, #fff 0, transparent 28%)",
        }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            {moduleName && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10,
                fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.72)", fontFamily: "var(--font-outfit)", fontWeight: 600,
              }}>
                <Icon name="chart" size={14} sw={2} />
                {moduleName} · Intelligence
              </div>
            )}
            <h1 style={{
              fontFamily: "var(--font-cinzel)", fontWeight: 700,
              fontSize: "clamp(26px, 3.4vw, 36px)", margin: 0, lineHeight: 1.1,
            }}>
              {t.hubAnalyticsTitle}
            </h1>
            <p style={{
              margin: "10px 0 0", maxWidth: 560, fontSize: 14, lineHeight: 1.55,
              color: "rgba(255,255,255,0.78)", fontFamily: "var(--font-outfit)",
            }}>
              {t.hubAnalyticsSub}
            </p>
          </div>
          <div style={{
            alignSelf: "flex-end",
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.16)",
            fontFamily: "var(--font-outfit)", fontSize: 12,
          }}>
            <div style={{ opacity: 0.75, marginBottom: 4 }}>Handed-over share</div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 24, fontWeight: 700 }}>{handedPct}%</div>
          </div>
        </div>
      </div>

      <HubAnalyticsKpiGrid items={kpis} theme={theme} loading={statsLoading} />

      <div className="hub-dash-grid-2" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.55fr) minmax(300px, 1fr)",
        gap: 16,
        marginBottom: 16,
      }}>
        <HubAnalyticsShell title={t.hubWeeklyTrend} subtitle="Volume curve · last 7 days" theme={theme} badge="Trend">
          {isLoading || !analytics ? (
            <ShimmerBlock h={220} radius={12} />
          ) : (
            <HubAnalyticsTrendChart
              points={analytics.weekly_trend.map((p) => ({ label: p.label, count: p.count }))}
              theme={theme}
            />
          )}
        </HubAnalyticsShell>

        <HubAnalyticsShell title={t.hubStatusBreakdown} subtitle="Registry status composition" theme={theme} badge="Mix">
          {isLoading || !analytics ? (
            <ShimmerBlock h={180} radius={12} />
          ) : (
            <HubAnalyticsStatusPanel
              segments={analytics.status_breakdown.map((s) => ({
                label: s.label === "Handed over" ? t.hubStatusHandedOver : t.hubStatusRegistered,
                pct: s.pct,
                color: s.color,
                count: s.count,
              }))}
              centerLabel={`${handedPct}%`}
              centerSub={t.hubHandedOverShare}
              theme={theme}
            />
          )}
        </HubAnalyticsShell>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 16,
      }}>
        <HubAnalyticsShell title={t.hubByWeaponType} subtitle="Ranked distribution" theme={theme} badge="Weapons">
          {isLoading || !analytics ? (
            <ShimmerBlock h={220} radius={12} />
          ) : (
            <HubRankedDistribution
              data={analytics.by_weapon_type}
              theme={theme}
              emptyLabel={t.hubNoResults}
              icon="target"
            />
          )}
        </HubAnalyticsShell>

        <HubAnalyticsShell title={t.hubByForceUnit} subtitle="Ranked distribution" theme={theme} badge="Units">
          {isLoading || !analytics ? (
            <ShimmerBlock h={220} radius={12} />
          ) : (
            <HubRankedDistribution
              data={analytics.by_force_unit}
              theme={theme}
              emptyLabel={t.hubNoResults}
              icon="shield"
            />
          )}
        </HubAnalyticsShell>
      </div>
    </div>
  );
}
