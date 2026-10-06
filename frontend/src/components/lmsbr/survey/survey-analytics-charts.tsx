"use client";

import { useEffect, useMemo, useState } from "react";
import { useSurveyTheme } from "./survey-theme";
import { hexA } from "@/lib/lmsbr/data";
import { formatCompletionPct, formatCompletionShare } from "@/lib/survey-completion";

export type DonutSegment = {
  label: string;
  pct: number;
  count?: number;
  color: string;
};

function ChartGrid({ height, lines = 5 }: { height: number; lines?: number }) {
  const T = useSurveyTheme();
  return (
    <div style={{ position: "absolute", inset: `0 0 28px 0`, pointerEvents: "none" }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(i / (lines - 1)) * 100}%`,
            height: 1,
            background: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(75,85,99,0.14)",
          }}
        />
      ))}
    </div>
  );
}

/** Daily completion trend — stacked complete + partial bars */
export function StackedDailyCompletionChart({
  data,
  labels = [],
}: {
  data: { complete: number; partial: number }[];
  labels?: string[];
}) {
  const T = useSurveyTheme();
  const chartH = 220;
  const max = Math.max(...data.map((d) => d.complete + d.partial), 1);

  return (
    <div style={{ position: "relative", height: chartH + 28 }}>
      <ChartGrid height={chartH} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: chartH, padding: "0 4px" }}>
        {data.map((d, i) => {
          const total = d.complete + d.partial;
          const h = Math.max(total > 0 ? 6 : 4, Math.round((total / max) * (chartH - 8)));
          const completeH = total > 0 ? Math.round((d.complete / total) * h) : 0;
          const partialH = h - completeH;
          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}
            >
              <div style={{ width: "100%", maxWidth: 32, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: h }}>
                {partialH > 0 && (
                  <div style={{
                    width: "100%",
                    height: partialH,
                    borderRadius: completeH > 0 ? "0" : "6px 6px 2px 2px",
                    background: T.isDark ? "#f59e0b99" : "#f59e0b",
                  }} />
                )}
                {completeH > 0 && (
                  <div style={{
                    width: "100%",
                    height: completeH,
                    borderRadius: partialH > 0 ? "6px 6px 0 0" : "6px 6px 2px 2px",
                    background: T.isDark ? "#10b98199" : "#059669",
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {labels.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, padding: "0 4px" }}>
          {labels.map((l, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.dim, minWidth: 0 }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hourly submission activity — 24-hour bar chart */
export function HourlyActivityChart({ data }: { data: { hour: number; label: string; count: number }[] }) {
  const T = useSurveyTheme();
  const chartH = 180;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ position: "relative", height: chartH + 32 }}>
      <ChartGrid height={chartH} lines={4} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 3, height: chartH, padding: "0 2px" }}>
        {data.map((d) => {
          const h = Math.max(d.count > 0 ? 4 : 2, Math.round((d.count / max) * (chartH - 8)));
          return (
            <div
              key={d.hour}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}
              title={`${d.label}: ${d.count.toLocaleString()}`}
            >
              <div style={{
                width: "100%",
                maxWidth: 14,
                height: h,
                borderRadius: "4px 4px 1px 1px",
                background: `linear-gradient(180deg, ${hexA(T.accent, 0.7)}, ${T.accent})`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 8, padding: "0 2px" }}>
        {data.map((d) => (
          <div key={d.hour} style={{ flex: 1, textAlign: "center", fontSize: 9, color: T.dim, minWidth: 0 }}>
            {d.hour % 4 === 0 ? d.hour : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Daily completion trend — vertical gradient bars */
export function DailyCompletionChart({ bars, labels }: { bars: number[]; labels: string[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...bars, 1);
  const chartH = 220;

  return (
    <div style={{ position: "relative", height: chartH + 28 }}>
      <ChartGrid height={chartH} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: chartH, padding: "0 4px" }}>
        {bars.map((v, i) => {
          const h = Math.max(4, Math.round((v / max) * (chartH - 8)));
          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 32,
                  height: h,
                  borderRadius: "6px 6px 2px 2px",
                  background: `linear-gradient(180deg, ${hexA(T.accent, T.isDark ? 0.75 : 0.65)} 0%, ${T.accent} 100%)`,
                  boxShadow: T.isDark ? `0 4px 18px -4px ${hexA(T.accent, 0.5)}` : `0 2px 8px -2px ${hexA(T.accent, 0.3)}`,
                  transition: "height .6s cubic-bezier(.2,.7,.2,1)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, padding: "0 4px" }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.dim, minWidth: 0 }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function truncateLabel(name: string, max = 11): string {
  if (name.length <= max) return name;
  const parts = name.split(" ");
  if (parts.length > 1 && parts[0].length <= max - 2) return `${parts[0]} ${parts[1].slice(0, 3)}…`;
  return `${name.slice(0, max - 1)}…`;
}

/** Responses by survey — vertical bars with values on top */
export function SurveyVerticalBarChart({ data }: { data: { name: string; total: number }[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...data.map(d => d.total), 1);
  const chartH = 200;

  return (
    <div style={{ position: "relative", height: chartH + 44 }}>
      <ChartGrid height={chartH} lines={4} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: chartH, padding: "0 2px" }}>
        {data.map((d, i) => {
          const h = Math.max(8, Math.round((d.total / max) * (chartH - 24)));
          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0, maxWidth: 72 }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 6, lineHeight: 1 }}>
                {d.total}
              </span>
              <div
                style={{
                  width: "100%",
                  maxWidth: 40,
                  height: h,
                  borderRadius: "6px 6px 2px 2px",
                  background: T.isDark
                    ? `linear-gradient(180deg, ${hexA(T.accent, 0.85)}, ${T.accent})`
                    : `linear-gradient(180deg, ${hexA(T.accent, 0.8)}, ${T.accent})`,
                  boxShadow: T.isDark ? `0 4px 16px -6px ${T.accent}60` : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, padding: "0 2px" }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1, textAlign: "center", fontSize: 10, color: T.dim, lineHeight: 1.3,
              minWidth: 0, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis",
            }}
            title={d.name}
          >
            {truncateLabel(d.name)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Minimum visible arc (%) so tiny slices remain visible on the donut. */
function visualArcPcts(counts: number[], total: number, minPct = 2.5): number[] {
  if (total <= 0) return counts.map(() => 0);

  const raw = counts.map((c) => (c / total) * 100);
  const needsMin = raw.map((p, i) => counts[i] > 0 && p < minPct);
  if (!needsMin.some(Boolean)) return raw;

  const reserved = needsMin.filter(Boolean).length * minPct;
  const scalableSum = raw.reduce((sum, p, i) => sum + (needsMin[i] ? 0 : p), 0);
  const scale = scalableSum > 0 ? (100 - reserved) / scalableSum : 0;

  return raw.map((p, i) => {
    if (counts[i] <= 0) return 0;
    if (needsMin[i]) return minPct;
    return p * scale;
  });
}

/** Completion breakdown — donut chart + count legend (skew-safe). */
export function CompletionBreakdownPanel({
  segments,
  size = 132,
}: {
  segments: DonutSegment[];
  size?: number;
}) {
  const T = useSurveyTheme();
  const total = segments.reduce((sum, s) => sum + (s.count ?? 0), 0);
  const completed = segments.find((s) => s.label === "Completed");
  const completedCount = completed?.count ?? 0;
  const counts = segments.map((s) => s.count ?? 0);
  const arcPcts = visualArcPcts(counts, total);

  const r = Math.round(size * 0.36);
  const stroke = Math.round(size * 0.11);
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const centerMain = Math.round(size * 0.2);
  const centerSub = Math.max(9, Math.round(size * 0.085));

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      flexWrap: "wrap",
      width: "100%",
      padding: "4px 0",
    }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={T.track}
            strokeWidth={stroke}
          />
          {segments.map((s, i) => {
            const count = counts[i];
            if (count <= 0) return null;
            const dash = (arcPcts[i] / 100) * circumference;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
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
          padding: "0 8px",
          textAlign: "center",
        }}>
          <span style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: centerMain,
            fontWeight: 700,
            color: T.text,
            lineHeight: 1,
            letterSpacing: "-.02em",
          }}>
            {completedCount.toLocaleString()}
          </span>
          <span style={{ fontSize: centerSub, color: T.dim, marginTop: 3 }}>completed</span>
          {total > 0 && (
            <span style={{ fontSize: Math.max(8, centerSub - 1), color: T.dim, marginTop: 4, lineHeight: 1.25 }}>
              {formatCompletionShare(completedCount, total)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 148, flex: "1 1 140px" }}>
        {segments.map((s) => {
          const count = s.count ?? 0;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: T.muted }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>
                {count.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: T.dim, minWidth: 52, textAlign: "right" }}>
                {formatCompletionShare(count, total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Completion breakdown — donut with legend */
export function AnalyticsDonutChart({
  pct,
  segments,
  size = 168,
  completedCount = 0,
}: {
  pct: number;
  segments: DonutSegment[];
  size?: number;
  completedCount?: number;
}) {
  const T = useSurveyTheme();
  const r = Math.round(size * 0.345);
  const stroke = Math.round(size * 0.107);
  const c = 2 * Math.PI * r;
  let offset = 0;
  const centerPct = Math.round(size * 0.179);
  const centerLabel = formatCompletionPct(pct, completedCount);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap", padding: "4px 0" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={T.track} strokeWidth={stroke}
          />
          {segments.map((s, i) => {
            const dash = (s.pct / 100) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: centerPct, fontWeight: 700, color: T.text, lineHeight: 1, letterSpacing: "-.02em" }}>
            {centerLabel}
          </span>
          <span style={{ fontSize: 11, color: T.dim, marginTop: 3 }}>completed</span>
          {completedCount > 0 && (
            <span style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
              {completedCount.toLocaleString()} total
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 140 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: "right" }}>
              {typeof s.count === "number" ? `${s.count.toLocaleString()} · ` : ""}
              {formatCompletionPct(s.pct, s.count ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Analytics KPI card — matches Pulse reference layout */
export function AnalyticsKpi({
  label, value, sub, delta, showBar, barPct = 65, blue,
}: {
  label: string;
  value: string;
  sub?: string;
  delta: string;
  showBar?: boolean;
  barPct?: number;
  blue?: boolean;
}) {
  const T = useSurveyTheme();
  const deltaColor = blue ? T.accent : T.green;

  return (
    <div style={{
      padding: "20px 22px", borderRadius: 14,
      background: T.card, border: `1px solid ${T.cardBdr}`, boxShadow: T.cardShadow,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: T.muted }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor, whiteSpace: "nowrap" }}>{delta}</span>
      </div>
      <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 32, fontWeight: 700, color: T.text, letterSpacing: "-.03em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: T.dim, marginTop: 8 }}>{sub}</div>}
      {showBar && (
        <div style={{ marginTop: 18, height: 3, borderRadius: 2, background: T.track, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${barPct}%`,
            background: `linear-gradient(90deg, ${hexA(T.accent, 0.65)}, ${T.accent})`,
            borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  );
}

/** Daily trend — smooth area line chart */
export function DailyAreaTrendChart({ bars, labels }: { bars: number[]; labels: string[] }) {
  const T = useSurveyTheme();
  const max = Math.max(...bars, 1);
  const w = 100;
  const h = 56;
  const pad = 4;
  const points = bars.map((v, i) => {
    const x = pad + (i / Math.max(bars.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return { x, y, v };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={200} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="surveyAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexA(T.accent, 0.35)} />
            <stop offset="100%" stopColor={hexA(T.accent, 0.02)} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={pad}
            x2={w - pad}
            y1={h - pad - pct * (h - pad * 2)}
            y2={h - pad - pct * (h - pad * 2)}
            stroke={T.isDark ? "rgba(255,255,255,0.06)" : T.tableSep}
            strokeWidth={0.4}
          />
        ))}
        <polygon points={area} fill="url(#surveyAreaFill)" />
        <polyline
          points={line}
          fill="none"
          stroke={T.accent}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={T.accent} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 2px" }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: T.dim, minWidth: 0 }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Survey comparison — horizontal bars (ranked), paginated to keep height tidy */
export function SurveyHorizontalBarChart({
  data,
  pageSize = 6,
  labels,
}: {
  data: { name: string; total: number }[];
  pageSize?: number;
  labels?: { prev: string; next: string; of: string };
}) {
  const T = useSurveyTheme();
  const [page, setPage] = useState(0);
  const max = Math.max(...data.map((d) => d.total), 1);
  const sorted = useMemo(() => [...data].sort((a, b) => b.total - a.total), [data]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const prevLabel = labels?.prev ?? "Prev";
  const nextLabel = labels?.next ?? "Next";
  const ofLabel = labels?.of ?? "of";

  useEffect(() => {
    setPage(0);
  }, [data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 0 4px", minHeight: pageSize * 36 }}>
        {slice.map((d, i) => {
          const pct = Math.round((d.total / max) * 100);
          return (
            <div key={`${d.name}-${safePage * pageSize + i}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: T.muted,
                    fontFamily: "var(--font-outfit)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={d.name}
                >
                  {truncateLabel(d.name, 28)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, flexShrink: 0 }}>
                  {d.total.toLocaleString()}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: T.track, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${hexA(T.accent, 0.55)}, ${T.accent})`,
                  transition: "width .45s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${T.isDark ? "rgba(255,255,255,0.08)" : "rgba(75,85,99,0.12)"}`,
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage <= 0}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${T.isDark ? "rgba(255,255,255,0.12)" : "rgba(75,85,99,0.18)"}`,
              background: "transparent",
              color: safePage <= 0 ? T.dim : T.text,
              fontFamily: "var(--font-outfit)",
              fontSize: 12,
              fontWeight: 600,
              cursor: safePage <= 0 ? "default" : "pointer",
              opacity: safePage <= 0 ? 0.45 : 1,
            }}
          >
            {prevLabel}
          </button>
          <span style={{ fontSize: 12, color: T.dim, fontFamily: "var(--font-outfit)" }}>
            {safePage + 1} {ofLabel} {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${T.isDark ? "rgba(255,255,255,0.12)" : "rgba(75,85,99,0.18)"}`,
              background: "transparent",
              color: safePage >= totalPages - 1 ? T.dim : T.text,
              fontFamily: "var(--font-outfit)",
              fontSize: 12,
              fontWeight: 600,
              cursor: safePage >= totalPages - 1 ? "default" : "pointer",
              opacity: safePage >= totalPages - 1 ? 0.45 : 1,
            }}
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Completion — stacked segment bar with stat rows */
export function CompletionSegmentBar({
  pct,
  segments,
}: {
  pct: number;
  segments: { label: string; pct: number; color: string }[];
}) {
  const T = useSurveyTheme();

  return (
    <div style={{ width: "100%", padding: "8px 4px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontFamily: "var(--font-cinzel)",
          fontSize: 42,
          fontWeight: 700,
          color: T.text,
          lineHeight: 1,
          letterSpacing: "-.02em",
        }}>
          {pct}%
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 6 }}>submissions completed</div>
      </div>
      <div style={{
        display: "flex",
        height: 10,
        borderRadius: 5,
        overflow: "hidden",
        background: T.track,
        marginBottom: 18,
      }}>
        {segments.filter((s) => s.pct > 0).map((s) => (
          <div
            key={s.label}
            style={{ width: `${s.pct}%`, background: s.color, transition: "width .4s ease" }}
            title={`${s.label}: ${s.pct}%`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: T.muted }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 36, textAlign: "right" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashboard — stacked vertical bars (complete + partial) with grid */
export function DashboardStackedBarChart({
  data,
  height = 200,
}: {
  data: { name: string; complete: number; partial: number; total: number }[];
  height?: number;
}) {
  const T = useSurveyTheme();
  const max = Math.max(...data.map(d => d.total), 1);
  const chartH = height;

  return (
    <div style={{ position: "relative", height: chartH + 36 }}>
      <ChartGrid height={chartH} lines={4} />
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 8,
        height: chartH,
        padding: "0 2px",
      }}>
        {data.map((d, i) => {
          const h = Math.max(12, Math.round((d.total / max) * (chartH - 24)));
          const completeH = d.total > 0 ? (d.complete / d.total) * 100 : 0;
          return (
            <div
              key={i}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "flex-end", height: "100%", minWidth: 0, maxWidth: 72,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 6, lineHeight: 1 }}>
                {d.total}
              </span>
              <div style={{
                width: "100%", maxWidth: 40, height: h, borderRadius: "6px 6px 2px 2px",
                overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end",
                boxShadow: T.isDark ? `0 4px 16px -6px ${hexA(T.accent, 0.35)}` : "none",
              }}>
                <div style={{ height: `${100 - completeH}%`, background: T.isDark ? hexA(T.accent, 0.35) : `${T.accent}55` }} />
                <div style={{
                  height: `${completeH}%`,
                  background: `linear-gradient(180deg, ${hexA(T.accent, 0.85)}, ${T.accent})`,
                }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, padding: "0 2px" }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1, textAlign: "center", fontSize: 10, color: T.dim, lineHeight: 1.3,
              minWidth: 0, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis",
            }}
            title={d.name}
          >
            {truncateLabel(d.name)}
          </div>
        ))}
      </div>
    </div>
  );
}
