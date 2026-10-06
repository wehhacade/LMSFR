"use client";

import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";

export type HubAnalyticsTheme = {
  accent: string;
  ink: string;
  inkSoft: string;
  isDark: boolean;
  txtMuted: string;
  txtPrimary: string;
  txtSecondary: string;
  gridLine: string;
  cardBg: string;
  cardBdr: string;
};

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "#6366f1", "#14b8a6", "#ec4899"];

export function buildHubAnalyticsTheme(
  accent: string,
  isDark: boolean,
  C: { txtMuted: string; txtPrimary: string; txtSecondary: string; tableSep: string; cardBdr: string; panelBg: string },
): HubAnalyticsTheme {
  return {
    accent,
    ink: isDark ? "#0b1020" : "#1e1b4b",
    inkSoft: isDark ? "#151b2e" : "#312e81",
    isDark,
    txtMuted: C.txtMuted,
    txtPrimary: C.txtPrimary,
    txtSecondary: C.txtSecondary,
    gridLine: isDark ? "rgba(148,163,184,0.12)" : "rgba(75,85,99,0.16)",
    cardBg: isDark ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.92)",
    cardBdr: isDark ? hexA(accent, 0.22) : "rgba(99,102,241,0.14)",
  };
}

export function HubAnalyticsKpiGrid({
  items,
  theme,
  loading,
}: {
  items: { label: string; value: number; icon: string; hint?: string }[];
  theme: HubAnalyticsTheme;
  loading?: boolean;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 14,
      marginBottom: 18,
    }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 16,
            padding: "18px 18px 16px",
            background: theme.isDark
              ? `linear-gradient(145deg, ${hexA(theme.inkSoft, 0.95)} 0%, ${hexA(theme.ink, 0.98)} 100%)`
              : `linear-gradient(145deg, #ffffff 0%, ${hexA("#6366f1", 0.04)} 100%)`,
            border: `1px solid ${theme.cardBdr}`,
            boxShadow: theme.isDark
              ? `0 16px 40px -24px rgba(0,0,0,0.55), inset 0 1px 0 ${hexA(theme.accent, 0.12)}`
              : "0 10px 30px -18px rgba(30,27,75,0.18)",
          }}
        >
          <div style={{
            position: "absolute", top: -20, right: -20, width: 88, height: 88,
            borderRadius: "50%", background: hexA(RANK_COLORS[i % RANK_COLORS.length], 0.12),
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(theme.accent, 0.14),
              border: `1px solid ${hexA(theme.accent, 0.22)}`,
              color: theme.accent,
            }}>
              <Icon name={item.icon} size={20} sw={1.8} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase", color: theme.txtMuted,
              fontFamily: "var(--font-outfit)",
            }}>
              KPI
            </span>
          </div>
          <div style={{
            marginTop: 16,
            fontFamily: "var(--font-cinzel)",
            fontSize: 32,
            fontWeight: 700,
            color: theme.txtPrimary,
            lineHeight: 1,
          }}>
            {loading ? "—" : item.value.toLocaleString()}
          </div>
          <div style={{
            marginTop: 8, fontSize: 13, fontWeight: 600, color: theme.txtSecondary,
            fontFamily: "var(--font-outfit)",
          }}>
            {item.label}
          </div>
          {item.hint && (
            <div style={{ marginTop: 4, fontSize: 11, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {item.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function HubAnalyticsTrendChart({
  points,
  theme,
}: {
  points: { label: string; count: number }[];
  theme: HubAnalyticsTheme;
}) {
  const max = Math.max(...points.map((p) => p.count), 1);
  const w = 640;
  const h = 200;
  const padX = 8;
  const padY = 12;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const coords = points.map((p, i) => {
    const x = padX + i * step;
    const y = padY + innerH - (p.count / max) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? padX} ${h - padY} L ${coords[0]?.x ?? padX} ${h - padY} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 28}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="hubTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexA(theme.accent, 0.35)} />
            <stop offset="100%" stopColor={hexA(theme.accent, 0.02)} />
          </linearGradient>
          <linearGradient id="hubTrendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={hexA(theme.accent, 0.55)} />
            <stop offset="100%" stopColor={theme.accent} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={w - padX}
            y1={padY + innerH * (1 - t)}
            y2={padY + innerH * (1 - t)}
            stroke={theme.gridLine}
            strokeWidth={1}
          />
        ))}
        <path d={areaPath} fill="url(#hubTrendFill)" />
        <path d={linePath} fill="none" stroke="url(#hubTrendLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={5} fill={theme.cardBg} stroke={theme.accent} strokeWidth={2.5} />
            {c.count > 0 && (
              <text x={c.x} y={c.y - 12} textAnchor="middle" fontSize={11} fontWeight="700" fill={theme.txtSecondary}>
                {c.count}
              </text>
            )}
            <text x={c.x} y={h + 18} textAnchor="middle" fontSize={11} fill={theme.txtMuted}>
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HubAnalyticsStatusPanel({
  segments,
  centerLabel,
  centerSub,
  theme,
}: {
  segments: { label: string; pct: number; count: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  theme: HubAnalyticsTheme;
}) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{
          width: 120, height: 120, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(${segments.map((s, i) => {
            const start = segments.slice(0, i).reduce((a, b) => a + b.pct, 0);
            return `${s.color} ${start}% ${start + s.pct}%`;
          }).join(", ")})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 12px 32px -12px ${hexA(theme.ink, 0.35)}`,
        }}>
          <div style={{
            width: 78, height: 78, borderRadius: "50%",
            background: theme.cardBg,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: `1px solid ${theme.cardBdr}`,
          }}>
            <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 22, fontWeight: 700, color: theme.txtPrimary }}>
              {centerLabel}
            </span>
            <span style={{ fontSize: 10, color: theme.txtMuted, marginTop: 2 }}>{centerSub}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 12 }}>
          {segments.map((s) => (
            <div key={s.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.txtPrimary, fontFamily: "var(--font-outfit)" }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 12, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  {s.count.toLocaleString()} · {total > 0 ? Math.round((s.count / total) * 100) : 0}%
                </span>
              </div>
              <div style={{
                height: 8, borderRadius: 999, background: theme.gridLine, overflow: "hidden",
              }}>
                <div style={{
                  width: `${s.pct}%`, height: "100%", borderRadius: 999,
                  background: `linear-gradient(90deg, ${hexA(s.color, 0.65)}, ${s.color})`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HubRankedDistribution({
  data,
  theme,
  emptyLabel,
  icon = "target",
}: {
  data: { name: string; total: number }[];
  theme: HubAnalyticsTheme;
  emptyLabel: string;
  icon?: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const grand = data.reduce((s, d) => s + d.total, 0);

  if (data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => {
        const pct = grand > 0 ? Math.round((d.total / grand) * 100) : 0;
        const barPct = Math.round((d.total / max) * 100);
        const rankColor = RANK_COLORS[i % RANK_COLORS.length];
        return (
          <div
            key={d.name}
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr auto",
              gap: 14,
              alignItems: "center",
              padding: "14px 16px",
              borderRadius: 14,
              background: theme.isDark ? hexA(theme.inkSoft, 0.55) : hexA("#6366f1", 0.03),
              border: `1px solid ${theme.cardBdr}`,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(rankColor, 0.14),
              border: `1px solid ${hexA(rankColor, 0.28)}`,
              color: rankColor,
              fontFamily: "var(--font-cinzel)",
              fontSize: 14,
              fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
              }}>
                <Icon name={icon} size={14} sw={1.8} />
                <span style={{
                  fontSize: 14, fontWeight: 600, color: theme.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={d.name}>
                  {d.name}
                </span>
              </div>
              <div style={{
                height: 10, borderRadius: 999, background: theme.gridLine, overflow: "hidden",
              }}>
                <div style={{
                  width: `${barPct}%`, height: "100%", borderRadius: 999,
                  background: `linear-gradient(90deg, ${hexA(rankColor, 0.55)}, ${rankColor})`,
                  boxShadow: `0 0 18px -4px ${hexA(rankColor, 0.55)}`,
                  transition: "width .6s cubic-bezier(.2,.7,.2,1)",
                }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontFamily: "var(--font-cinzel)", fontSize: 20, fontWeight: 700,
                color: theme.txtPrimary, lineHeight: 1,
              }}>
                {d.total.toLocaleString()}
              </div>
              <div style={{
                marginTop: 4, fontSize: 11, fontWeight: 700, color: rankColor,
                fontFamily: "var(--font-outfit)",
              }}>
                {pct}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HubAnalyticsShell({
  title,
  subtitle,
  children,
  theme,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  theme: HubAnalyticsTheme;
  badge?: string;
}) {
  return (
    <div style={{
      borderRadius: 18,
      overflow: "hidden",
      border: `1px solid ${theme.cardBdr}`,
      background: theme.isDark
        ? `linear-gradient(180deg, ${hexA(theme.inkSoft, 0.92)} 0%, ${hexA(theme.ink, 0.96)} 100%)`
        : "linear-gradient(180deg, #ffffff 0%, #f8f7ff 100%)",
      boxShadow: theme.isDark
        ? "0 20px 50px -30px rgba(0,0,0,0.55)"
        : "0 18px 40px -28px rgba(30,27,75,0.16)",
    }}>
      <div style={{
        padding: "18px 22px",
        borderBottom: `1px solid ${theme.cardBdr}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
            color: theme.accent, marginBottom: 6, fontFamily: "var(--font-outfit)",
          }}>
            Analytics insight
          </div>
          <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 17, fontWeight: 700, color: theme.txtPrimary }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: theme.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)" }}>
              {subtitle}
            </div>
          )}
        </div>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
            padding: "6px 10px", borderRadius: 999,
            background: hexA(theme.accent, 0.12),
            color: theme.accent,
            border: `1px solid ${hexA(theme.accent, 0.22)}`,
            fontFamily: "var(--font-outfit)",
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}
