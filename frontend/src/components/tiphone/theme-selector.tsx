"use client";

import { useTipTheme } from "./theme-provider";
import { rgba, type ThemeMode } from "@/lib/tiphone/theme";
import { so } from "@/lib/tiphone/i18n";

const OPTIONS: { id: ThemeMode; label: string; preview: [string, string] }[] = [
  { id: "light", label: so.themeLight, preview: ["#f5f1e8", "#ece8de"] },
  { id: "navy", label: so.themeNavy, preview: ["#12224B", "#070F26"] },
  { id: "warm", label: so.themeDark, preview: ["#3a2a16", "#1d160d"] },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { colors, mode, setMode } = useTipTheme();

  return (
    <div
      className={`inline-flex items-center gap-0.5 self-start border ${compact ? "rounded-xl p-0.5" : "rounded-[14px] p-[3px]"}`}
      style={{
        background: rgba(colors.lineRgb, 0.05),
        borderColor: rgba(colors.lineRgb, 0.12),
      }}
      role="radiogroup"
      aria-label="Muuqaalka"
    >
      {OPTIONS.map((opt) => {
        const selected = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setMode(opt.id)}
            className={`relative flex flex-col items-center justify-center rounded-[10px] border ${compact ? "min-w-[40px] px-1.5 py-1" : "min-w-[44px] px-1.5 py-1"}`}
            style={{
              borderColor: selected ? "rgba(201,168,76,0.45)" : "transparent",
              background: selected ? "rgba(201,168,76,0.12)" : "transparent",
            }}
          >
            <span
              className={`mb-0.5 block rounded-full ${compact ? "h-2.5 w-2.5" : "h-3 w-3"} ${selected ? "ring-1 ring-[#c9a84c]" : ""}`}
              style={{
                background: `linear-gradient(135deg, ${opt.preview[0]}, ${opt.preview[1]})`,
              }}
            />
            <span
              className={`${compact ? "text-[8px]" : "text-[9px]"} font-semibold leading-none`}
              style={{ color: selected ? "#c9a84c" : colors.inkMut }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
