"use client";

import { hexA } from "@/lib/lmsbr/data";

export type AmnigaChartTheme = {
  accent: string;
  isDark: boolean;
  tableSep: string;
  txtMuted: string;
  txtPrimary: string;
  txtSecondary: string;
  barTrack?: string;
};

const DISTRICT_COLORS = [
  "#3B82F6", "#EC4899", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444",
  "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6", "#E11D48",
  "#A855F7", "#0EA5E9", "#22C55E", "#FB7185", "#7C3AED", "#2563EB",
  "#D97706", "#059669", "#DB2777",
];

function ChartGrid({ lines = 5, theme }: { lines?: number; theme: AmnigaChartTheme }) {
  return (
    <div style={{ position: "absolute", inset: "0 52px 36px 0", pointerEvents: "none" }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(i / (lines - 1)) * 100}%`,
            height: 1,
            background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(75,85,99,0.12)",
          }}
        />
      ))}
    </div>
  );
}

export function AmnigaDistrictBarChart({
  data,
  theme,
  emptyLabel,
  valueKey = "suspects",
  onSelect,
}: {
  data: { name: string; suspects: number; agents?: number; users?: number }[];
  theme: AmnigaChartTheme;
  emptyLabel: string;
  valueKey?: "suspects" | "agents" | "users";
  onSelect?: (name: string) => void;
}) {
  const chartH = 260;
  const values = data.map((d) => d[valueKey] ?? 0);
  const max = Math.max(...values, 1);
  const few = data.length <= 4;
  const colW = few ? Math.max(88, Math.min(140, Math.floor(520 / Math.max(data.length, 1)))) : 72;
  const labelAreaH = few ? 44 : 64;

  if (data.length === 0) {
    return (
      <div style={{ padding: "48px 12px", textAlign: "center", fontSize: 13, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "visible", paddingBottom: 8 }}>
      <ChartGrid theme={theme} />
      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        minHeight: chartH + labelAreaH,
        paddingLeft: 44,
        overflow: "visible",
      }}>
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: labelAreaH,
          width: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontSize: 10,
          color: theme.txtMuted,
          fontFamily: "var(--font-outfit)",
        }}>
          {[max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0].map((v, i) => (
            <span key={i} style={{ textAlign: "right", paddingRight: 6 }}>{v}</span>
          ))}
        </div>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: few ? 14 : 10,
          flex: 1,
          overflowX: "auto",
          overflowY: "visible",
          paddingBottom: labelAreaH,
          paddingTop: 8,
          minHeight: chartH + labelAreaH,
        }}>
          {data.map((row, i) => {
            const value = row[valueKey] ?? 0;
            const h = Math.max(value > 0 ? 6 : 2, Math.round((value / max) * (chartH - 12)));
            const color = DISTRICT_COLORS[i % DISTRICT_COLORS.length];
            return (
              <div
                key={row.name}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(row.name) : undefined}
                onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect(row.name); } : undefined}
                title={`${row.name}: ${value.toLocaleString()}`}
                style={{
                  flex: `0 0 ${colW}px`,
                  width: colW,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  height: chartH,
                  gap: 6,
                  cursor: onSelect ? "pointer" : "default",
                  position: "relative",
                }}
              >
                {value > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: theme.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                    {value}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    height: h,
                    borderRadius: "6px 6px 2px 2px",
                    background: `linear-gradient(180deg, ${hexA(color, 0.85)} 0%, ${color} 100%)`,
                    boxShadow: theme.isDark
                      ? `0 6px 20px -6px ${hexA(color, 0.55)}`
                      : `0 4px 12px -4px ${hexA(color, 0.35)}`,
                    transition: "height .6s cubic-bezier(.2,.7,.2,1)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    width: few ? colW + 8 : colW + 4,
                    marginTop: 8,
                    fontSize: few ? 12 : 10.5,
                    fontWeight: few ? 600 : 500,
                    color: theme.txtSecondary,
                    fontFamily: "var(--font-outfit)",
                    textAlign: "center",
                    lineHeight: 1.2,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                  }}
                  title={row.name}
                >
                  {row.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AmnigaRegistrarBars({
  rows,
  theme,
  emptyLabel,
}: {
  rows: { name: string; total: number; county_name?: string }[];
  theme: AmnigaChartTheme;
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);

  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 8px", textAlign: "center", fontSize: 13, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((row, i) => {
        const pct = Math.round((row.total / max) * 100);
        const color = DISTRICT_COLORS[i % DISTRICT_COLORS.length];
        return (
          <div key={`${row.name}-${i}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }} title={row.name}>
                  {i + 1}. {row.name}
                </div>
                {row.county_name && (
                  <div style={{ fontSize: 11, color: theme.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)" }}>
                    {row.county_name}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: "var(--font-cinzel)",
                fontWeight: 700,
                fontSize: 18,
                color,
                flexShrink: 0,
              }}>
                {row.total.toLocaleString()}
              </span>
            </div>
            <div style={{
              height: 7,
              borderRadius: 4,
              background: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(75,85,99,0.12)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${hexA(color, 0.65)}, ${color})`,
                transition: "width .7s cubic-bezier(.2,.7,.2,1)",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AmnigaWeeklyChart({
  bars,
  labels,
  theme,
}: {
  bars: number[];
  labels: string[];
  theme: AmnigaChartTheme;
}) {
  const max = Math.max(...bars, 1);
  const chartH = 180;

  return (
    <div style={{ position: "relative", height: chartH + 28 }}>
      <ChartGrid lines={5} theme={theme} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: chartH, padding: "0 4px" }}>
        {bars.map((v, i) => {
          const h = Math.max(v > 0 ? 4 : 2, Math.round((v / max) * (chartH - 8)));
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              {v > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: theme.txtSecondary, marginBottom: 6, fontFamily: "var(--font-outfit)" }}>
                  {v}
                </span>
              )}
              <div style={{
                width: "100%",
                maxWidth: 40,
                height: h,
                borderRadius: "7px 7px 3px 3px",
                background: `linear-gradient(180deg, ${hexA(theme.accent, theme.isDark ? 0.75 : 0.65)} 0%, ${theme.accent} 100%)`,
                boxShadow: theme.isDark ? `0 4px 18px -4px ${hexA(theme.accent, 0.5)}` : `0 2px 8px -2px ${hexA(theme.accent, 0.3)}`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, padding: "0 4px" }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
