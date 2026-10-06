"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTipTheme } from "./theme-provider";
import { brandHoney, rgba } from "@/lib/tiphone/theme";

export function FloatingInput({
  label,
  value,
  onChange,
  error,
  icon,
  type = "text",
  forceWarm = false,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  icon?: ReactNode;
  forceWarm?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const { colors: themeColors } = useTipTheme();
  const colors = forceWarm ? brandHoney : themeColors;
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const floated = focused || value.length > 0;

  return (
    <div className="w-full">
      <div
        className="relative flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 transition"
        style={{
          background: rgba(colors.surfRgb, 0.85),
          borderColor: error
            ? rgba(colors.roseRgb, 0.55)
            : focused
              ? rgba(colors.goldRgb, 0.45)
              : rgba(colors.lineRgb, 0.12),
        }}
      >
        {icon ? <span className="shrink-0 opacity-90">{icon}</span> : null}
        <div className="relative min-w-0 flex-1">
          <label
            className="pointer-events-none absolute left-0 transition-all"
            style={{
              color: error ? colors.rose : focused ? colors.gold : colors.ink3,
              top: floated ? -2 : 10,
              fontSize: floated ? 11 : 14,
              fontWeight: floated ? 600 : 400,
            }}
          >
            {label}
          </label>
          <input
            {...rest}
            type={isPassword && !show ? "password" : isPassword ? "text" : type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            className="w-full bg-transparent pt-3.5 text-[15px] outline-none"
            style={{ color: colors.ink0 }}
          />
        </div>
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="shrink-0 p-1"
            style={{ color: colors.inkMut }}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 px-1 text-xs" style={{ color: colors.rose }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
