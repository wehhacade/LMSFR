"use client";

import { useColorPalette } from "./color-palette-ctx";
import { useTheme } from "./theme-ctx";
import { Icon } from "./icon";
import { NAVY_BASE } from "@/lib/lmsbr/palette";

type Props = {
  btnBg: string;
  btnBdr: string;
  menuInactive: string;
  inline?: boolean;
};

const PALETTE_SWATCHES = [
  { id: "gold" as const, color: "#c69049", ring: "rgba(198,144,73,0.5)", title: "Gold palette (dark)" },
  { id: "navy" as const, color: NAVY_BASE, ring: "rgba(100,140,220,0.45)", title: "Navy palette (dark)" },
];

export function ColorToggle({ btnBg, btnBdr, menuInactive, inline }: Props) {
  const { palette, setPalette } = useColorPalette();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const onA = (active: boolean) =>
    active ? "linear-gradient(120deg,#c69049,#a36f2a)" : "transparent";

  return (
    <div
      title="Appearance"
      style={{
        display: "flex",
        alignItems: "center",
        gap: inline ? "3px" : "2px",
        background: btnBg,
        border: `1px solid ${btnBdr}`,
        borderRadius: inline ? "10px" : "9px",
        padding: "3px",
        flexShrink: inline ? 0 : 1,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {/* Light / dark */}
      <button
        type="button"
        title={isDark ? "Light mode" : "Dark mode"}
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "24px",
          height: inline ? "26px" : "24px",
          borderRadius: "6px",
          cursor: "pointer",
          border: "none",
          transition: ".25s",
          background: onA(!isDark),
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: isDark ? "#1e293b" : "#FAFAF9",
            border: isDark ? "1.5px solid rgba(148,163,184,0.45)" : "1.5px solid #E5E7EB",
            boxShadow: !isDark ? "none" : "none",
            color: isDark ? "#c69049" : "#C69049",
          }}
        >
          <Icon name={isDark ? "moon" : "sun"} size={10} sw={2.2} />
        </span>
      </button>

      {PALETTE_SWATCHES.map(({ id, color, ring, title }) => {
        const active = isDark && palette === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            onClick={() => {
              if (!isDark) toggle();
              setPalette(id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: inline ? "26px" : "24px",
              borderRadius: "6px",
              cursor: "pointer",
              border: "none",
              transition: ".25s",
              background: onA(active),
              opacity: isDark ? 1 : 0.55,
            }}
          >
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: color,
                border: id === "navy" ? "1.5px solid rgba(214,176,114,0.35)" : "none",
                boxShadow: active ? `0 0 0 2px ${ring}` : "none",
                transition: ".25s",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
