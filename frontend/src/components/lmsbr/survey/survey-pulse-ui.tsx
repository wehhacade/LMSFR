"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icon";
import type { PulseResponse, PulseSurvey, TimeRange } from "@/types/surveys";
import { SurveyDeadlineCell } from "./survey-deadline";
import { STATUS_COLORS } from "@/types/surveys";
import { useSurveyTheme } from "./survey-theme";
import { useLang } from "../lang-ctx";

export { SurveyThemeProvider, useSurveyTheme } from "./survey-theme";

export function PulseShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-outfit)", animation: "is-fadeUp .4s ease both" }}>
      {children}
    </div>
  );
}

/** Right-aligned toolbar — search + range only (title lives in breadcrumb) */
export function SurveyToolbar({
  search,
  onSearch,
  range,
  onRange,
}: {
  search: string;
  onSearch: (v: string) => void;
  range: TimeRange;
  onRange: (r: TimeRange) => void;
}) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 8,
        background: T.inputBg, border: `1px solid ${T.inputBdr}`, minWidth: 160,
      }}>
        <span style={{ display: "flex", color: T.dim }}><Icon name="search" size={14} sw={1.8} /></span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={so ? "Raadi sahamin..." : "Search surveys..."}
          style={{ border: "none", outline: "none", background: "transparent", color: T.text, fontSize: 13, flex: 1, fontFamily: "inherit", minWidth: 0 }}
        />
      </div>
      <TimeRangeToggle value={range} onChange={onRange} />
    </div>
  );
}

export function PulsePageHeader({
  section, title, search, onSearch, range, onRange, extra,
}: {
  section: string;
  title: string;
  search?: string;
  onSearch?: (v: string) => void;
  range?: TimeRange;
  onRange?: (r: TimeRange) => void;
  extra?: ReactNode;
}) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
      <div>
        <div style={{ fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: T.dim, fontWeight: 600, marginBottom: "6px" }}>
          {section}
        </div>
        <h1 style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-.01em" }}>
          {title}
        </h1>
        {extra}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {onSearch !== undefined && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 12px", borderRadius: "9px",
            background: T.inputBg, border: `1px solid ${T.inputBdr}`, minWidth: "180px",
          }}>
            <span style={{ display: "flex", color: T.dim }}><Icon name="search" size={15} sw={1.8} /></span>
            <input
              value={search ?? ""}
              onChange={e => onSearch(e.target.value)}
              placeholder={so ? "Raadi sahamin..." : "Search surveys..."}
              style={{ border: "none", outline: "none", background: "transparent", color: T.text, fontSize: "13px", flex: 1, fontFamily: "inherit" }}
            />
          </div>
        )}
        {range !== undefined && onRange && <TimeRangeToggle value={range} onChange={onRange} />}
      </div>
    </div>
  );
}

/** "Last 90d" / "All time" — for panel subtitles, not the toggle itself. */
export function rangeWindowLabel(range: TimeRange, so: boolean): string {
  if (range === "all") return so ? "Wakhtiga oo dhan" : "All time";
  return so ? `Ugu dambeeyay ${range}` : `Last ${range}`;
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "All",
};

export function TimeRangeToggle({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const T = useSurveyTheme();
  const opts: TimeRange[] = ["all", "7d", "30d", "90d"];
  return (
    <div style={{
      display: "flex",
      background: T.inputBg,
      border: `1px solid ${T.inputBdr}`,
      borderRadius: 11,
      padding: 3,
      boxShadow: T.isDark ? "none" : "0 1px 2px rgba(26,54,93,0.04)",
    }}>
      {opts.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", transition: ".2s",
          background: value === o
            ? (T.isDark ? T.accent : `linear-gradient(120deg, ${T.accent}, ${T.accent}cc)`)
            : "transparent",
          color: value === o ? "#fff" : T.muted,
          boxShadow: value === o && !T.isDark ? `0 2px 8px ${T.accentSoft}` : "none",
        }}>
          {TIME_RANGE_LABELS[o]}
        </button>
      ))}
    </div>
  );
}

export function FilterTabs({ tabs, active, onChange, compact }: { tabs: string[]; active: string; onChange: (t: string) => void; compact?: boolean }) {
  const T = useSurveyTheme();
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: compact ? 0 : "20px", flexWrap: "wrap" }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          padding: "8px 16px", borderRadius: "20px", border: `1px solid ${active === tab ? T.accent : T.cardBdr}`, cursor: "pointer",
          fontSize: "13px", fontWeight: 600, fontFamily: "inherit", transition: ".2s",
          background: active === tab
            ? (T.isDark ? T.accent : `linear-gradient(120deg, ${T.accent}, ${T.accent}cc)`)
            : T.isDark ? T.card : "#fff",
          color: active === tab ? "#fff" : T.muted,
          boxShadow: active === tab ? `0 4px 14px -4px ${T.accentSoft}` : "none",
        }}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export function PulseCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const T = useSurveyTheme();
  return (
    <div style={{
      padding: "18px 20px", borderRadius: 12,
      background: T.card, border: `1px solid ${T.cardBdr}`, boxShadow: T.cardShadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

/** WAAXDA-style compact metric tile with corner icon */
export function MetricTile({
  label,
  value,
  hint,
  icon,
  trend = "neutral",
  active,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  trend?: "up" | "down" | "neutral";
  active?: boolean;
}) {
  const T = useSurveyTheme();
  const trendColor = trend === "up" ? T.green : trend === "down" ? "#ef4444" : T.muted;
  const activeBorder = T.isDark ? "#3b82f6" : "#2563eb";

  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 6,
      background: T.isDark ? T.card : "#fff",
      border: `1px solid ${active ? activeBorder : T.cardBdr}`,
      boxShadow: active ? `0 0 0 1px ${activeBorder}30` : T.isDark ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: T.dim,
          fontFamily: "var(--font-outfit)",
          lineHeight: 1.25,
        }}>
          {label}
        </span>
        <span style={{ display: "flex", color: T.accent, flexShrink: 0, marginTop: -1 }}>
          <Icon name={icon} size={15} sw={1.65} />
        </span>
      </div>
      <div style={{
        fontFamily: "var(--font-outfit)",
        fontSize: 20,
        fontWeight: 700,
        color: T.text,
        letterSpacing: "-.02em",
        lineHeight: 1,
        marginBottom: 5,
      }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
        {trend !== "neutral" && (
          <span style={{
            display: "flex",
            color: trendColor,
            flexShrink: 0,
            lineHeight: 0,
            transform: trend === "up" ? "rotate(-90deg)" : "rotate(90deg)",
          }}>
            <Icon name="arrow" size={10} sw={2.2} />
          </span>
        )}
        <span style={{
          fontSize: 10,
          color: T.muted,
          fontFamily: "var(--font-outfit)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {hint}
        </span>
      </div>
    </div>
  );
}

export function MetricTilesRow({ children, cols = 6 }: { children: ReactNode; cols?: number }) {
  return (
    <div
      className="metric-tiles-row"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 8,
        marginBottom: 10,
      }}
    >
      {children}
      <style>{`
        @media (max-width: 1280px) { .metric-tiles-row { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        @media (max-width: 720px) { .metric-tiles-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
        @media (max-width: 420px) { .metric-tiles-row { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const T = useSurveyTheme();
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? T.dim;
  const { lang } = useLang();
  const so = lang === "so";
  const label = so
    ? ({
        draft: "Qabyo",
        live: "Furan",
        closed: "Xiran",
        complete: "Dhammaystiran",
        partial: "Qayb ahaan",
      }[status] ?? status)
    : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{
      fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "20px",
      background: `${color}18`, color, border: `1px solid ${color}40`,
      textTransform: "capitalize",
    }}>
      {label}
    </span>
  );
}

export function RespondentCell({ name, email, color }: { name: string; email: string; color: string }) {
  const T = useSurveyTheme();
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{
        width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg,${color},${color}88)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "12px", fontWeight: 700,
      }}>
        {initials}
      </div>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: T.text }}>{name}</div>
        <div style={{ fontSize: "12px", color: T.dim }}>{email}</div>
      </div>
    </div>
  );
}

export function StackedBarChart({ data }: { data: { name: string; complete: number; partial: number; total: number }[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "220px", paddingTop: "20px" }}>
      {data.map((d, i) => {
        const h = (d.total / max) * 100;
        const completeH = d.total > 0 ? (d.complete / d.total) * 100 : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "11px", color: T.muted, fontWeight: 600 }}>{d.total}</span>
            <div style={{ width: "100%", height: `${h}%`, borderRadius: "6px 6px 2px 2px", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ height: `${100 - completeH}%`, background: T.isDark ? "#60a5fa" : `${T.accent}88` }} />
              <div style={{ height: `${completeH}%`, background: T.accent }} />
            </div>
            <span style={{ fontSize: "10px", color: T.dim, textAlign: "center", lineHeight: 1.2, maxWidth: "70px" }}>{d.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ pct, segments }: { pct: number; segments: { label: string; pct: number; color: string }[] }) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: "140px", height: "140px", flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke={T.track} strokeWidth="14" />
          {segments.map((s, i) => {
            const dash = (s.pct / 100) * c;
            const el = (
              <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "28px", fontWeight: 700, color: T.text }}>{pct}%</span>
          <span style={{ fontSize: "11px", color: T.dim }}>{so ? "dhammaystiran" : "completed"}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: T.muted, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendBars({ bars, labels }: { bars: number[]; labels: string[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...bars, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "180px" }}>
      {bars.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
          <div style={{
            width: "100%", borderRadius: "4px 4px 1px 1px",
            height: `${Math.round((v / max) * 100)}%`,
            background: `linear-gradient(180deg,${T.isDark ? "#22d3ee" : T.accent},${T.accent})`,
            boxShadow: T.isDark ? `0 0 14px ${T.accent}40` : "none",
          }} />
          <span style={{ fontSize: "10px", color: T.dim }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function HBarChart({ data }: { data: { name: string; total: number }[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", color: T.text }}>{d.name}</span>
            <span style={{ fontSize: "13px", color: T.muted, fontWeight: 600 }}>{d.total}</span>
          </div>
          <div style={{ height: "8px", borderRadius: "4px", background: T.track, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${(d.total / max) * 100}%`,
              background: `linear-gradient(90deg,${T.accent},${T.isDark ? "#22d3ee" : T.accent})`, borderRadius: "4px",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResponsesTable({
  rows,
  bare,
  onRowClick,
}: {
  rows: PulseResponse[];
  bare?: boolean;
  onRowClick?: (id: number) => void;
}) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  const cols = so
    ? ["QOFKA JAWAABAY", "SAHAMIN", "LA GUDBIYAY", "MUDDADA", "JAWAABAHA", "XAALAD"]
    : ["RESPONDENT", "SURVEY", "SUBMITTED", "DEADLINE", "ANSWERS", "STATUS"];

  const table = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{
                textAlign: "left", padding: "14px 20px", fontSize: "11px", fontWeight: 600,
                letterSpacing: ".08em", color: T.dim, background: T.tableHead,
                borderBottom: `1px solid ${T.tableSep}`,
              }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.id}
              style={{
                borderBottom: `1px solid ${T.tableSep}`,
                transition: ".15s",
                cursor: onRowClick ? "pointer" : "default",
              }}
              onClick={() => onRowClick?.(r.id)}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = T.tableHov; }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
            >
              <td style={{ padding: "14px 20px" }}><RespondentCell name={r.name} email={r.email} color={r.avatar} /></td>
              <td style={{ padding: "14px 20px", fontSize: "14px", color: T.muted }}>{r.survey}</td>
              <td style={{ padding: "14px 20px", fontSize: "14px", color: T.muted }}>{r.submitted}</td>
              <td style={{ padding: "14px 20px" }}>
                <SurveyDeadlineCell
                  deadlineAt={r.deadlineAt}
                  isExpired={r.isDeadlineExpired}
                  daysRemaining={r.deadlineDaysRemaining}
                  so={so}
                  mutedColor={T.dim}
                />
              </td>
              <td style={{ padding: "14px 20px", fontSize: "14px", color: T.muted }}>{r.duration}</td>
              <td style={{ padding: "14px 20px" }}><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (bare) return table;
  return <PulseCard style={{ padding: 0, overflow: "hidden" }}>{table}</PulseCard>;
}

export function SurveyCard({
  survey,
  onClick,
  onEdit,
  accent: accentProp,
  isDark: isDarkProp,
}: {
  survey: PulseSurvey;
  onClick?: () => void;
  onEdit?: () => void;
  accent?: string;
  isDark?: boolean;
}) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  const accent = accentProp ?? T.accent;
  const isDark = isDarkProp ?? T.isDark;
  return (
    <div
      style={{ cursor: onClick ? "pointer" : "default", transition: "transform .2s, box-shadow .2s" }}
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = isDark ? "0 12px 28px -12px rgba(0,0,0,.45)" : "0 8px 24px -8px rgba(26,54,93,.12)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
        el.style.boxShadow = "";
      }}
    >
      <div style={{
        position: "relative",
        overflow: "hidden",
        padding: "18px 20px",
        height: "100%",
        borderRadius: 14,
        background: T.card,
        border: `1px solid ${T.cardBdr}`,
        boxShadow: T.cardShadow,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
            borderRadius: "14px 14px 0 0",
          }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <StatusBadge status={survey.status} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {onEdit && (
              <button
                type="button"
                title={so ? "Wax ka beddel sahamin" : "Edit survey"}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.cardBdr}`,
                  background: T.inputBg, color: accent, cursor: "pointer", padding: 0,
                }}
              >
                <Icon name="edit" size={14} sw={1.8} />
              </button>
            )}
          </div>
        </div>
        <div style={{
          fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 600,
          color: T.text, marginBottom: 8, lineHeight: 1.35,
        }}>
          {survey.title}
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 16, lineHeight: 1.45 }}>{survey.meta}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginTop: "auto" }}>
          <span>{survey.responses.toLocaleString()} {so ? "jawaabo" : "responses"}</span>
          <span style={{ color: accent, fontWeight: 600 }}>{so ? "Eeg →" : "View →"}</span>
        </div>
        {survey.completion > 0 && (
          <div style={{ height: 4, borderRadius: 3, background: T.track, overflow: "hidden", marginTop: 10 }}>
            <div style={{ height: "100%", width: `${survey.completion}%`, background: `linear-gradient(90deg, ${accent}, ${accent}99)`, borderRadius: 3 }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function NewSurveyButton({ label, onClick }: { label: string; onClick?: () => void }) {
  const T = useSurveyTheme();
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      padding: "10px 18px", borderRadius: "10px", border: "none", cursor: "pointer",
      background: `linear-gradient(135deg,${T.accent},${T.isDark ? "#2563eb" : T.accent})`,
      color: "#fff", fontSize: "14px", fontWeight: 600, fontFamily: "inherit",
      boxShadow: `0 8px 20px -6px ${T.accent}80`,
    }}>
      <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span>
      {label}
    </button>
  );
}

export function SurveySectionTitle({ title, sub, sans }: { title: string; sub?: string; sans?: boolean }) {
  const T = useSurveyTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: sans ? "var(--font-outfit)" : "var(--font-outfit)", fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export type SurveyViewMode = "grid" | "table";

export function SurveyViewToggle({ mode, onChange }: { mode: SurveyViewMode; onChange: (m: SurveyViewMode) => void }) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  const btn = (m: SurveyViewMode, label: string, icon: string) => {
    const on = mode === m;
    return (
      <button
        type="button"
        onClick={() => onChange(m)}
        title={label}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, transition: ".2s",
          background: on
            ? (T.isDark ? T.accent : `linear-gradient(120deg, ${T.accent}, ${T.accent}cc)`)
            : "transparent",
          color: on ? "#fff" : T.muted,
          boxShadow: on && !T.isDark ? `0 2px 8px ${T.accentSoft}` : "none",
        }}
      >
        <Icon name={icon} size={14} sw={1.8} />
        {label}
      </button>
    );
  };
  return (
    <div style={{
      display: "flex", padding: 3, borderRadius: 11,
      background: T.inputBg, border: `1px solid ${T.inputBdr}`,
      boxShadow: T.isDark ? "none" : "0 1px 2px rgba(26,54,93,0.04)",
    }}>
      {btn("grid", so ? "Kaarar" : "Cards", "grid")}
      {btn("table", so ? "Jadwal" : "Table", "list")}
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "", label: "all" },
  { value: "draft", label: "draft" },
  { value: "live", label: "live" },
  { value: "closed", label: "closed" },
] as const;

export function SurveyStatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {STATUS_FILTERS.map((f) => {
        const on = value === f.value;
        return (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => onChange(f.value)}
            style={{
              padding: "7px 14px", borderRadius: 20, border: `1px solid ${on ? T.accent : T.cardBdr}`,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, transition: ".2s",
              background: on
                ? (T.isDark ? T.accent : `linear-gradient(120deg, ${T.accent}, ${T.accent}cc)`)
                : T.isDark ? T.card : "#fff",
              color: on ? "#fff" : T.muted,
              boxShadow: on ? `0 2px 10px -4px ${T.accentSoft}` : "none",
            }}
          >
            {so
              ? ({ all: "Dhammaan", draft: "Qabyo", live: "Furan", closed: "Xiran" }[f.label] ?? f.label)
              : ({ all: "All", draft: "Draft", live: "Live", closed: "Closed" }[f.label] ?? f.label)}
          </button>
        );
      })}
    </div>
  );
}

function formatSurveyDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SurveysDataTable({
  surveys,
  onOpen,
  onEdit,
  bare,
}: {
  surveys: import("@/types/surveys").Survey[];
  onOpen: (id: number) => void;
  onEdit?: (survey: import("@/types/surveys").Survey) => void;
  bare?: boolean;
}) {
  const T = useSurveyTheme();
  const { lang } = useLang();
  const so = lang === "so";
  const cols = so
    ? ["SAHAMIN", "XAALAD", "JAWAABO", "QAYBO", "LA ABUURAY", "LA CUSBOONAYSIIYAY", "FICILLO"]
    : ["SURVEY", "STATUS", "RESPONSES", "SECTIONS", "CREATED", "UPDATED", "ACTIONS"];

  const actionBtn = (title: string, onClick: () => void, icon: string) => (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.cardBdr}`,
        background: T.inputBg, color: T.accent, cursor: "pointer", padding: 0,
      }}
    >
      <Icon name={icon} size={14} sw={1.8} />
    </button>
  );

  const table = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c || "action"}
                style={{
                  textAlign: "left", padding: "13px 24px", fontSize: 11, fontWeight: 500,
                  letterSpacing: ".08em", textTransform: "uppercase", color: T.dim,
                  background: T.tableHead, borderBottom: `1px solid ${T.tableSep}`,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {surveys.map((s) => (
            <tr
              key={s.id}
              onClick={() => onOpen(s.id)}
              style={{ borderBottom: `1px solid ${T.tableSep}`, cursor: "pointer", transition: ".15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = T.tableHov; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
            >
              <td style={{ padding: "14px 24px", maxWidth: 280 }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{s.name}</div>
                {s.description && (
                  <div style={{
                    fontSize: 12, color: T.dim, lineHeight: 1.4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260,
                  }}>
                    {s.description}
                  </div>
                )}
              </td>
              <td style={{ padding: "14px 24px" }}><StatusBadge status={s.status} /></td>
              <td style={{ padding: "14px 24px", fontSize: 13, fontWeight: 600, color: T.text }}>
                {s.response_count.toLocaleString()}
              </td>
              <td style={{ padding: "14px 24px", fontSize: 13, color: T.muted }}>{s.section_count}</td>
              <td style={{ padding: "14px 24px", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>
                {formatSurveyDate(s.created_at)}
              </td>
              <td style={{ padding: "14px 24px", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>
                {formatSurveyDate(s.updated_at)}
              </td>
              <td style={{ padding: "14px 24px" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {onEdit && actionBtn(so ? "Wax ka beddel sahamin" : "Edit survey", () => onEdit(s), "edit")}
                  {actionBtn(so ? "Fur sahamin" : "Open survey", () => onOpen(s.id), "arrow")}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (bare) return table;
  return <PulseCard style={{ padding: 0, overflow: "hidden" }}>{table}</PulseCard>;
}
