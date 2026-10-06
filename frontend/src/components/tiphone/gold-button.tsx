"use client";

import { Loader2 } from "lucide-react";
import { useTipTheme } from "./theme-provider";
import { brandHoney } from "@/lib/tiphone/theme";

export function GoldButton({
  children,
  onClick,
  loading,
  disabled,
  type = "button",
  className = "",
  forceWarm = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  forceWarm?: boolean;
}) {
  const { colors: themeColors } = useTipTheme();
  const colors = forceWarm ? brandHoney : themeColors;
  const busy = loading || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold tracking-wide transition active:scale-[0.98] disabled:opacity-60 ${className}`}
      style={{
        background: `linear-gradient(90deg, ${colors.gold2}, ${colors.gold}, ${colors.goldDeep})`,
        color: colors.onGold,
        boxShadow: `0 8px 24px rgba(${colors.goldRgb}, 0.28)`,
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
