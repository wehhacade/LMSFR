"use client";

import { hexA } from "@/lib/lmsbr/data";

type ChartTheme = {
  accent: string;
  isDark: boolean;
  tableSep: string;
  txtMuted: string;
  txtPrimary: string;
  txtSecondary: string;
};

function ChartGrid({ lines = 5, theme }: { lines?: number; theme: ChartTheme }) {
  return (
    <div style={{ position: "absolute", inset: "0 0 28px 0", pointerEvents: "none" }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(i / (lines - 1)) * 100}%`,
            height: 1,
            background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(75,85,99,0.14)",
          }}
        />
      ))}
    </div>
  );
}

export function HubWeeklyChart({
  bars,
  labels,
  theme,
}: {
  bars: number[];
  labels: string[];
  theme: ChartTheme;
}) {
  const max = Math.max(...bars, 1);
  const chartH = 200;

  return (
    <div style={{ position: "relative", height: chartH + 28 }}>
      <ChartGrid lines={5} theme={theme} />
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: chartH,
        padding: "0 4px",
      }}>
        {bars.map((v, i) => {
          const h = Math.max(4, Math.round((v / max) * (chartH - 8)));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                minWidth: 0,
              }}
            >
              {v > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: theme.txtSecondary, marginBottom: 6 }}>
                  {v}
                </span>
              )}
              <div
                style={{
                  width: "100%",
                  maxWidth: 36,
                  height: h,
                  borderRadius: "6px 6px 2px 2px",
                  background: `linear-gradient(180deg, ${hexA(theme.accent, theme.isDark ? 0.75 : 0.65)} 0%, ${theme.accent} 100%)`,
                  boxShadow: theme.isDark ? `0 4px 18px -4px ${hexA(theme.accent, 0.5)}` : `0 2px 8px -2px ${hexA(theme.accent, 0.3)}`,
                  transition: "height .6s cubic-bezier(.2,.7,.2,1)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, padding: "0 4px" }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: theme.txtMuted, minWidth: 0 }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HubStatusDonut({
  segments,
  centerLabel,
  centerSub,
  theme,
  size = 156,
}: {
  segments: { label: string; pct: number; color: string; count: number }[];
  centerLabel: string;
  centerSub: string;
  theme: ChartTheme;
  size?: number;
}) {
  const track = theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(75,85,99,0.16)";
  const r = Math.round(size * 0.345);
  const stroke = Math.round(size * 0.1);
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 28,
      flexWrap: "wrap",
      padding: "8px 0",
    }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          {segments.filter(s => s.pct > 0).map((s, i) => {
            const dash = (s.pct / 100) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: Math.round(size * 0.17),
            fontWeight: 700,
            color: theme.txtPrimary,
            lineHeight: 1,
          }}>
            {centerLabel}
          </span>
          <span style={{ fontSize: 11, color: theme.txtMuted, marginTop: 4, textAlign: "center", maxWidth: size * 0.7 }}>
            {centerSub}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 130 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: theme.txtMuted, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.txtPrimary }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncateLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function InsightRing({
  pct,
  color,
  size = 54,
  track,
}: {
  pct: number;
  color: string;
  size?: number;
  track: string;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 700, fill: color, fontFamily: "var(--font-outfit)" }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

const INSIGHT_PALETTE = ["#7C3AED", "#2563EB", "#0891B2", "#059669", "#D97706", "#DB2777"];

export function HubDashboardInsightGrid({
  data,
  theme,
  emptyLabel,
}: {
  data: { name: string; total: number }[];
  theme: ChartTheme;
  emptyLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const track = theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(75,85,99,0.16)";

  if (data.length === 0) {
    return (
      <div style={{ padding: "32px 8px", textAlign: "center", fontSize: 13, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {data.map((d, i) => {
        const pct = (d.total / max) * 100;
        const color = INSIGHT_PALETTE[i % INSIGHT_PALETTE.length];
        return (
          <div
            key={`${d.name}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: theme.isDark ? "rgba(255,255,255,0.04)" : `linear-gradient(135deg, ${hexA(color, 0.06)} 0%, #fff 100%)`,
              border: `1px solid ${theme.isDark ? "rgba(255,255,255,0.08)" : hexA(color, 0.16)}`,
            }}
          >
            <InsightRing pct={pct} color={color} track={track} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: theme.txtMuted,
                fontFamily: "var(--font-outfit)",
              }}>
                #{i + 1}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                }}
                title={d.name}
              >
                {d.name}
              </div>
              <div style={{
                fontFamily: "var(--font-cinzel)",
                fontWeight: 700,
                fontSize: 22,
                color,
                lineHeight: 1.1,
                marginTop: 4,
              }}>
                {d.total.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HubHorizontalBars({
  data,
  theme,
  emptyLabel,
}: {
  data: { name: string; total: number }[];
  theme: ChartTheme;
  emptyLabel: string;
}) {
  const max = Math.max(...data.map(d => d.total), 1);

  if (data.length === 0) {
    return (
      <div style={{ padding: "32px 8px", textAlign: "center", fontSize: 13, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
      {data.map((d, i) => {
        const pct = Math.round((d.total / max) * 100);
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
              <span
                style={{ fontSize: 13, color: theme.txtSecondary, fontFamily: "var(--font-outfit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={d.name}
              >
                {truncateLabel(d.name)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.txtPrimary, flexShrink: 0 }}>{d.total}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(75,85,99,0.16)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${hexA(theme.accent, 0.65)}, ${theme.accent})`,
                transition: "width .5s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
