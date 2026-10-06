"use client";

import { hexA } from "@/lib/lmsbr/data";
import type { getDict } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors & { txtMuted?: string };

export function bailCaseLabel(count: number, t: ReturnType<typeof getDict>) {
  if (count === 1) return `1 ${t.colCase}`;
  return `${count} ${t.bailCases}`;
}

export function BailCountBadge({
  count,
  accent,
  C,
  t,
  variant = "pill",
}: {
  count: number;
  accent: string;
  C: ThemeColors;
  t: ReturnType<typeof getDict>;
  variant?: "pill" | "chip" | "overlay";
}) {
  // The first case is the initial registration, not a repeat. Only show the
  // badge when the suspect appears for a second time or more.
  if (!count || count <= 1) return null;

  const label = bailCaseLabel(count, t);
  const hint = t.bailCaseHint;

  if (variant === "overlay") {
    return (
      <span
        title={hint}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 28,
          height: 28,
          padding: "0 8px",
          borderRadius: 999,
          background: "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(15,23,42,0.72))",
          border: `1px solid ${hexA(accent, 0.55)}`,
          boxShadow: `0 4px 14px ${hexA(accent, 0.35)}`,
          color: "#fff",
          fontFamily: "var(--font-outfit)",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: ".02em",
        }}
      >
        {count}×
      </span>
    );
  }

  if (variant === "chip") {
    return (
      <span
        title={hint}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          background: hexA(accent, 0.1),
          border: `1px solid ${hexA(accent, 0.22)}`,
          color: C.txtSecondary ?? accent,
          fontFamily: "var(--font-outfit)",
          fontSize: "12.5px",
        }}
      >
        <span style={{ display: "flex", color: accent, opacity: 0.9 }}>
          <Icon name="shield" size={13} sw={2} />
        </span>
        <span style={{ fontWeight: 600, color: accent }}>{label}</span>
      </span>
    );
  }

  return (
    <span
      title={hint}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px 5px 6px",
        borderRadius: 12,
        background: `linear-gradient(135deg, ${hexA(accent, 0.16)}, ${hexA(accent, 0.06)})`,
        border: `1px solid ${hexA(accent, 0.28)}`,
        boxShadow: `0 2px 8px ${hexA(accent, 0.12)}`,
        fontFamily: "var(--font-outfit)",
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hexA(accent, 0.2),
          color: accent,
          flexShrink: 0,
        }}
      >
        <Icon name="shield" size={14} sw={2} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: accent, letterSpacing: ".02em" }}>{count}</span>
        <span style={{ fontSize: "10px", fontWeight: 500, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
          {count === 1 ? t.colCase : t.bailCases}
        </span>
      </span>
    </span>
  );
}
