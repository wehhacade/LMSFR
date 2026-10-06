"use client";

import type { CSSProperties, ReactNode } from "react";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "../icon";
import { ShimmerBlock } from "../shimmer";
import type { SurveyThemeColors } from "./survey-theme";
import { formatCompletionPct } from "@/lib/survey-completion";
import { useLang } from "../lang-ctx";

export type SurveyKpiCtx = {
  todayResponses: number;
  totalResponses: number;
  completedPct: number;
  completedCount: number;
  completionTotal: number;
  totalSurveys: number;
  liveSurveys: number;
  draftSurveys: number;
  closedSurveys: number;
};

export type SurveyKpiDef = {
  label: string;
  hint: string;
  icon: "folder" | "check" | "grid" | "clipboard" | "file" | "archive";
  getValue: (ctx: SurveyKpiCtx) => string;
  getHint?: (ctx: SurveyKpiCtx) => string;
};

export const SURVEY_KPI_DEFS: SurveyKpiDef[] = [
  {
    label: "Responses today",
    hint: "Submitted today",
    icon: "folder",
    getValue: (c) => c.todayResponses.toLocaleString(),
    getHint: (c) => `${c.totalResponses.toLocaleString()} all time`,
  },
  {
    label: "Completion rate",
    hint: "Submissions completed",
    icon: "check",
    getValue: (c) => formatCompletionPct(c.completedPct, c.completedCount),
    getHint: (c) =>
      c.completionTotal > 0
        ? `${c.completedCount.toLocaleString()} of ${c.completionTotal.toLocaleString()} completed`
        : "Submissions completed",
  },
  { label: "Total surveys", hint: "Across all statuses", icon: "grid", getValue: (c) => String(c.totalSurveys) },
  { label: "Live surveys", hint: "Accepting responses", icon: "clipboard", getValue: (c) => String(c.liveSurveys) },
  { label: "Draft surveys", hint: "Awaiting publish", icon: "file", getValue: (c) => String(c.draftSurveys) },
  { label: "Closed surveys", hint: "No longer accepting", icon: "archive", getValue: (c) => String(c.closedSurveys) },
];

export function surveyPanelHeadBg(accent: string, isDark: boolean) {
  return isDark ? hexA(accent, 0.03) : "#FAFAF9";
}

export function SurveyPageRoot({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 4, paddingBottom: 48, animation: "is-fadeUp .45s ease both", fontFamily: "var(--font-outfit)" }}>
      {children}
    </div>
  );
}

/** Inline page title row — used when workspace duplicate header is hidden */
export function SurveyCompactPageHeader({
  C,
  accent,
  isDark,
  moduleLabel,
  title,
  subtitle,
  actions,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  moduleLabel: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="survey-compact-header"
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
            {moduleLabel}
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
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          flex: "1 1 280px",
          justifyContent: "flex-end",
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}

function KpiCellShimmer() {
  return (
    <>
      <ShimmerBlock w={46} h={46} radius={13} />
      <div style={{ marginTop: 18 }}><ShimmerBlock h={34} radius={8} /></div>
      <div style={{ marginTop: 10 }}><ShimmerBlock w="70%" h={13} radius={5} /></div>
    </>
  );
}

export function SurveyKpiStrip({
  C, accent, isDark, ctx, loading,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  ctx: SurveyKpiCtx;
  loading?: boolean;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const localizedKpis = SURVEY_KPI_DEFS.map((k) => {
    if (!so) return k;
    const map: Record<string, string> = {
      "Responses today": "Jawaabaha maanta",
      "Submitted today": "La gudbiyay maanta",
      "All time collected": "Wadarta dhammaan waqtiga",
      "Completion rate": "Heerka dhammaystirka",
      "Submissions completed": "Gudbin la dhammaystiray",
      "Total surveys": "Wadarta sahaminada",
      "Across all statuses": "Dhammaan xaaladaha",
      "Live surveys": "Sahaminada furan",
      "Accepting responses": "Qaadanaya jawaabo",
      "Draft surveys": "Sahaminada qabyo",
      "Awaiting publish": "Sugaya daabacaad",
      "Closed surveys": "Sahaminada xiran",
      "No longer accepting": "Hadda ma qaataan jawaabo",
    };
    return {
      ...k,
      label: map[k.label] ?? k.label,
      hint: map[k.hint] ?? k.hint,
      getHint: k.getHint
        ? (ctx: SurveyKpiCtx) => {
            const raw = k.getHint!(ctx);
            if (raw.endsWith("all time")) return `${ctx.totalResponses.toLocaleString()} dhammaan waqtiga`;
            return raw;
          }
        : undefined,
    };
  });

  return (
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
        {localizedKpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              padding: "22px 20px",
              borderRight: i < localizedKpis.length - 1 ? `1px solid ${C.tableSep}` : undefined,
            }}
          >
            {loading ? (
              <KpiCellShimmer />
            ) : (
              <>
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
                  {k.getValue(ctx)}
                </div>
                <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8, letterSpacing: ".02em" }}>{k.label}</div>
                <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 4 }}>
                  {k.getHint ? k.getHint(ctx) : k.hint}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SurveyPanel({
  C, accent, isDark, children, style,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{
      borderRadius: 14,
      overflow: "hidden",
      background: C.panelBg,
      border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SurveyPanelHeader({
  C, accent, isDark, title, sub, actions,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{
      padding: "20px 24px",
      borderBottom: `1px solid ${C.tableSep}`,
      background: surveyPanelHeadBg(accent, isDark),
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 17, color: C.txtPrimary }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 4 }}>{sub}</div>}
      </div>
      {actions}
    </div>
  );
}

export function SurveySearchField({
  C, isDark, value, onChange, placeholder, style,
}: {
  C: SurveyThemeColors;
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "9px 14px",
      borderRadius: 11,
      background: C.inputBg,
      border: `1px solid ${C.inputBdr}`,
      minWidth: 200,
      flex: "1 1 220px",
      maxWidth: 360,
      boxShadow: isDark ? "none" : "0 1px 2px rgba(26,54,93,0.04)",
      ...style,
    }}>
      <span style={{ display: "flex", color: C.txtMuted }}><Icon name="search" size={16} sw={1.8} /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        style={{
          border: "none", outline: "none", background: "transparent",
          color: C.txtPrimary, fontSize: 14, flex: 1, fontFamily: "inherit", minWidth: 0,
        }}
      />
    </div>
  );
}

export function surveySelectStyle(C: SurveyThemeColors): CSSProperties {
  const chevron = encodeURIComponent(C.txtMuted);
  return {
    padding: "9px 32px 9px 12px",
    borderRadius: 11,
    border: `1px solid ${C.inputBdr}`,
    backgroundColor: C.inputBg,
    color: C.txtPrimary,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    boxShadow: "0 1px 2px rgba(26,54,93,0.04)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${chevron}' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };
}

export function SurveyDateField({
  C, value, onChange, label,
}: {
  C: SurveyThemeColors;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      style={surveySelectStyle(C)}
    />
  );
}

export function SurveyEmptyState({
  C, accent, icon, title, message, action,
}: {
  C: SurveyThemeColors;
  accent: string;
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hexA(accent, 0.1), color: accent,
        border: `1px solid ${hexA(accent, 0.2)}`,
      }}>
        <Icon name={icon} size={28} sw={1.8} />
      </div>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 8 }}>
        {title}
      </div>
      <p style={{ fontSize: 14, color: C.txtMuted, margin: 0, lineHeight: 1.55, maxWidth: 360, marginInline: "auto" }}>
        {message}
      </p>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function SurveyErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: 11,
      background: "rgba(224,101,90,0.08)",
      border: "1px solid rgba(224,101,90,0.25)",
      color: "#c44a3f",
      fontSize: 14,
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <Icon name="alert" size={18} sw={1.8} />
      {message}
    </div>
  );
}

export function SurveyChartEmpty({
  C, accent, message, icon = "chart",
}: {
  C: SurveyThemeColors;
  accent: string;
  message: string;
  icon?: string;
}) {
  return (
    <div style={{
      minHeight: 180,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      color: C.txtMuted,
      fontSize: 13,
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hexA(accent, 0.1), color: accent,
      }}>
        <Icon name={icon} size={20} sw={1.8} />
      </span>
      {message}
    </div>
  );
}
