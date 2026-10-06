"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { statusLabel, tuhunkaColor, tuhunkaLabel } from "@/lib/lmsbr/suspect-utils";
import { Icon } from "./icon";
import { useAmnigaDistrictProfile } from "@/hooks/use-amniga";
import { ShimmerBlock } from "./shimmer";
import { AmnigaRegistrarBars, AmnigaWeeklyChart, type AmnigaChartTheme } from "./amniga-charts";
import type { AccountsThemeColors } from "./accounts-shared";
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
  inputBg?: string;
  inputBdr?: string;
  barTrack?: string;
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_SO = ["Jan", "Feb", "Mar", "Abr", "May", "Jun", "Lul", "Ago", "Seb", "Okt", "Nof", "Dis"];

function formatTrendLabel(iso: string, grain: "day" | "month", so: boolean) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const months = so ? MONTHS_SO : MONTHS_EN;
  if (grain === "month") return `${months[m - 1]} ${y}`;
  return `${String(d || 1).padStart(2, "0")} ${months[m - 1]}`;
}

function formatLastLogin(iso: string | null, neverLabel: string, so: boolean) {
  if (!iso) return neverLabel;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return neverLabel;
  const startOf = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return so ? "Maanta" : "Today";
  if (diffDays === 1) return so ? "Shalay" : "Yesterday";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AmnigaDistrictProfilePanel({
  district,
  dateFrom,
  dateTo,
  periodLabel,
  C,
  accent,
  isDark,
  onBack,
  onOpenSuspect,
}: {
  district: string;
  dateFrom: string;
  dateTo: string;
  periodLabel: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  onBack: () => void;
  onOpenSuspect: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const { data, isLoading, isFetching, isError, error } = useAmnigaDistrictProfile(district, dateFrom, dateTo);
  const summary = data?.summary;
  const errorDetail =
    (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail
    || (so ? "Warbixinta degmada lama soo qaadi karo." : "Could not load this district profile.");
  const theme: AmnigaChartTheme = {
    accent,
    isDark,
    tableSep: C.tableSep,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    barTrack: C.barTrack ?? C.tableSep,
  };

  const kpis = [
    { label: t.dailyReportSuspectsRegistered, value: summary?.suspects_registered ?? 0, color: "#7c6cf0", icon: "badge" as const },
    { label: t.dailyReportCaptureCount, value: summary?.capture_count ?? 0, color: "#5b9fd4", icon: "map" as const },
    { label: t.dailyReportResidenceCount, value: summary?.residence_count ?? 0, color: "#46c08a", icon: "home" as const },
    { label: t.dailyReportRegistrarsInDistrict, value: summary?.registrar_count ?? 0, color: "#e6b25c", icon: "users" as const },
    { label: t.dailyReportActiveOfficers, value: summary?.active_users ?? 0, color: "#46c08a", icon: "check" as const },
    { label: t.dailyReportShareOfPeriod, value: summary?.share_pct ?? 0, color: "#e0655a", icon: "chart" as const, suffix: "%" },
  ];

  const trendBars = (data?.trend ?? []).map((row) => row.total);
  const trendLabels = (data?.trend ?? []).map((row) => formatTrendLabel(row.date, data?.trend_grain ?? "day", so));

  return (
    <div style={{ animation: "is-fadeUp .35s ease both" }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: 4,
              width: 38,
              height: 38,
              borderRadius: 11,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              color: C.txtPrimary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transform: "rotate(180deg)",
              flexShrink: 0,
            }}
            aria-label={t.dailyReportBackToActivity}
          >
            <Icon name="arrow" size={16} sw={2.1} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
                color: isDark ? accent : "#c69049", fontWeight: 700, fontFamily: "var(--font-outfit)",
              }}>
                {t.dailyReportDistrictProfile}
              </span>
              {isFetching && !isLoading && (
                <span style={{ fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>…</span>
              )}
            </div>
            <h2 style={{
              margin: 0,
              fontFamily: "var(--font-cinzel)",
              fontWeight: 700,
              fontSize: "clamp(22px, 2.8vw, 30px)",
              color: C.txtPrimary,
            }}>
              {data?.district.name || district}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {[data?.district.region, periodLabel, t.dailyReportDistrictProfileSub].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            borderRadius: 10,
            border: `1px solid ${C.cardBdr}`,
            background: C.panelBg,
            color: C.txtSecondary,
            fontFamily: "var(--font-outfit)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.dailyReportBackToActivity}
        </button>
      </div>

      {isError && !isLoading ? (
        <div style={{
          marginBottom: 16,
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${hexA("#e0655a", 0.35)}`,
          background: hexA("#e0655a", isDark ? 0.14 : 0.08),
          color: isDark ? "#f0a8a2" : "#9b3b34",
          fontFamily: "var(--font-outfit)",
          fontSize: 13.5,
          fontWeight: 600,
        }}>
          {errorDetail}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: "16px 14px",
              borderRadius: 14,
              background: C.cardBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow,
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(kpi.color, isDark ? 0.16 : 0.12),
              color: kpi.color,
              border: `1px solid ${hexA(kpi.color, 0.25)}`,
            }}>
              <Icon name={kpi.icon} size={16} sw={1.9} />
            </div>
            {isLoading ? <ShimmerBlock h={28} w="50%" /> : (
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 26, color: kpi.color, lineHeight: 1 }}>
                {kpi.value.toLocaleString()}{kpi.suffix || ""}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
        <ProfilePanel title={t.dailyReportActivityTrend} C={C} accent={accent} isDark={isDark}>
          {isLoading ? <ShimmerBlock h={180} /> : !(trendBars.length) ? (
            <Empty label={t.dailyReportNoData} C={C} />
          ) : (
            <AmnigaWeeklyChart bars={trendBars} labels={trendLabels} theme={theme} />
          )}
        </ProfilePanel>
        <ProfilePanel title={t.dailyReportStatusMix} C={C} accent={accent} isDark={isDark}>
          {isLoading ? <ShimmerBlock h={180} /> : !(data?.status_breakdown.length) ? (
            <Empty label={t.dailyReportNoData} C={C} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: C.barTrack ?? C.tableSep }}>
                {data.status_breakdown.map((slice) => (
                  <div key={slice.key} title={`${slice.label}: ${slice.total}`} style={{ width: `${Math.max(slice.pct, slice.total ? 2 : 0)}%`, background: slice.color }} />
                ))}
              </div>
              {data.status_breakdown.map((slice) => (
                <div key={slice.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-outfit)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.txtSecondary, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: slice.color }} />
                    {slice.label}
                  </span>
                  <span style={{ fontWeight: 700, color: C.txtPrimary, fontSize: 13 }}>{slice.total} · {slice.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </ProfilePanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <ProfilePanel
          title={t.dailyReportTopRegistrarsDistrict}
          subtitle={t.dailyReportTopRegistrarsDistrictSub}
          C={C}
          accent={accent}
          isDark={isDark}
        >
          {isLoading ? <ShimmerBlock h={220} /> : (
            <AmnigaRegistrarBars
              rows={data?.top_registrars ?? []}
              theme={theme}
              emptyLabel={t.dailyReportNoRegistrars}
            />
          )}
        </ProfilePanel>

        <ProfilePanel
          title={t.dailyReportAssignedOfficers}
          subtitle={t.dailyReportAssignedOfficersSub}
          C={C}
          accent={accent}
          isDark={isDark}
          bodyStyle={{ padding: "8px 14px 14px" }}
        >
          {isLoading ? <ShimmerBlock h={220} /> : !(data?.assigned_officers.length) ? (
            <Empty label={t.dailyReportNoOfficers} C={C} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={th(C)}>#</th>
                    <th style={th(C)}>{t.dailyReportColName}</th>
                    <th style={{ ...th(C), textAlign: "right" }}>{t.dailyReportDistrictRegs}</th>
                    <th style={{ ...th(C), textAlign: "right" }}>{t.dailyReportPeriodRegs}</th>
                    <th style={th(C)}>{t.dailyReportLastLogin}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assigned_officers.map((row, i) => (
                    <tr key={row.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={td(C)}>{i + 1}</td>
                      <td style={td(C)}>
                        <div style={{ fontWeight: 600, color: C.txtPrimary }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2 }}>
                          {row.phone || "—"} · {row.is_active ? t.amnigaStatusActive : t.amnigaStatusInactive}
                        </div>
                      </td>
                      <td style={{ ...td(C), textAlign: "right", fontWeight: 700, color: C.txtPrimary }}>{row.district_registrations}</td>
                      <td style={{ ...td(C), textAlign: "right" }}>{row.period_registrations}</td>
                      <td style={{ ...td(C), fontSize: 12 }}>{formatLastLogin(row.last_login, t.amnigaActivityNeverLogin, so)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ProfilePanel>
      </div>

      <ProfilePanel
        title={t.dailyReportRecentSuspects}
        subtitle={t.dailyReportRecentSuspectsSub}
        C={C}
        accent={accent}
        isDark={isDark}
        bodyStyle={{ padding: 0 }}
      >
        {isLoading ? (
          <div style={{ padding: 20 }}><ShimmerBlock h={180} /></div>
        ) : !(data?.recent_suspects.length) ? (
          <Empty label={t.dailyReportNoData} C={C} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ background: C.tableHead }}>
                  <th style={{ ...th(C), padding: "12px 16px" }}>{t.dailyReportColName}</th>
                  <th style={{ ...th(C), padding: "12px 16px" }}>{t.dailyReportColStatus}</th>
                  <th style={{ ...th(C), padding: "12px 16px" }}>{t.dailyReportRegistrar}</th>
                  <th style={{ ...th(C), padding: "12px 16px" }}>{t.dailyReportColPhone}</th>
                  <th style={{ ...th(C), padding: "12px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {data.recent_suspects.map((row) => {
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
                    <tr key={row.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={{ ...td(C), padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: C.txtPrimary }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{formatTime(row.created_at)}</div>
                      </td>
                      <td style={{ ...td(C), padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-flex",
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
                      <td style={{ ...td(C), padding: "14px 16px" }}>{row.registrar_name || "—"}</td>
                      <td style={{ ...td(C), padding: "14px 16px" }}>{row.phone || "—"}</td>
                      <td style={{ ...td(C), padding: "14px 16px" }}>
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
      </ProfilePanel>
    </div>
  );
}

function ProfilePanel({
  title,
  subtitle,
  children,
  C,
  accent,
  isDark,
  bodyStyle,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  bodyStyle?: CSSProperties;
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
        padding: "16px 20px",
        borderBottom: `1px solid ${C.tableSep}`,
        background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
      }}>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 15.5, color: C.txtPrimary }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)" }}>{subtitle}</div>
        )}
      </div>
      <div style={{ padding: "18px 20px", ...bodyStyle }}>{children}</div>
    </div>
  );
}

function Empty({ label, C }: { label: string; C: ThemeColors }) {
  return (
    <div style={{ padding: "28px 12px", textAlign: "center", color: C.txtMuted, fontSize: 13.5, fontFamily: "var(--font-outfit)" }}>
      {label}
    </div>
  );
}

function th(C: ThemeColors): CSSProperties {
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

function td(C: ThemeColors): CSSProperties {
  return {
    padding: "12px 8px",
    fontSize: 13.5,
    color: C.txtSecondary,
    fontFamily: "var(--font-outfit)",
    verticalAlign: "middle",
  };
}
